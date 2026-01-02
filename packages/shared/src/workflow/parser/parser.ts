// src/workflow/parser/parser.ts

import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';
import type { Node } from 'unist';
import type {
  Code,
  Heading,
  ListItem,
  Paragraph,
  PhrasingContent
} from 'mdast';
import type { Step, Action, StepNumber, Substep, Workflow } from '../types.js';
import {
  extractStepHeader,
  extractSubstepHeader,
  parseConditional,
  convertConditionals,
  extractWorkflowList
} from './helpers.js';
import { WorkflowSyntaxError, type ParsedConditional } from './types.js';

/**
 * Type guard to narrow Node to Heading
 */
function isHeading(node: Node): node is Heading {
  return node.type === 'heading' && 'depth' in node;
}

/**
 * Extract plain text from mdast node
 */
function extractText(node: PhrasingContent | Heading | Paragraph | ListItem): string {
  if (node.type === 'text') {
    return (node).value;
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => extractText(child as PhrasingContent)).join('');
  }
  return '';
}

/**
 * Check if paragraph contains **Prompt:** marker
 */
function hasPromptMarker(node: Paragraph): boolean {
  for (const child of node.children) {
    if (child.type === 'strong') {
      const text = extractText(child);
      if (text.trim() === 'Prompt:') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract prompt text (everything after **Prompt:** marker)
 */
function extractPromptText(node: Paragraph): string {
  let foundMarker = false;
  let promptText = '';

  for (const child of node.children) {
    if (child.type === 'strong' && extractText(child).trim() === 'Prompt:') {
      foundMarker = true;
      continue;
    }
    if (foundMarker) {
      promptText += extractText(child);
    }
  }

  return promptText.trim();
}

interface SubstepBuilder {
  id: string;
  description: string;
  agentType?: string;
  isDynamic: boolean;
  content: string;
}

interface StepBuilder {
  number: StepNumber;
  description: string;
  command?: { code: string };
  prompts: { text: string }[];
  substeps: Substep[];
  pendingSubstep?: SubstepBuilder;
}

/**
 * Parse workflow markdown into Step array
 */
export function parseWorkflow(markdown: string): Step[] {
  // Parse markdown to AST
  const tree = fromMarkdown(markdown);

  // State for walking
  const steps: Step[] = [];
  let currentStep: StepBuilder | null = null;
  let pendingConditionals: ParsedConditional[] = [];
  let implicitText = '';

  // Helper to finalize pending substep
  const finalizePendingSubstep = () => {
    if (currentStep?.pendingSubstep) {
      const workflows = extractWorkflowList(currentStep.pendingSubstep.content);
      const substep: Substep = {
        id: currentStep.pendingSubstep.id,
        description: currentStep.pendingSubstep.description,
        agentType: currentStep.pendingSubstep.agentType,
        isDynamic: currentStep.pendingSubstep.isDynamic,
        workflows: workflows.length > 0 ? workflows : undefined
      };
      currentStep.substeps.push(substep);
      currentStep.pendingSubstep = undefined;
    }
  };

  // Walk AST nodes
  visit(tree, (node: Node) => {
    // Handle H1 headings - reject if they look like step headers
    if (isHeading(node) && node.depth === 1) {
      const headingText = extractText(node);
      const looksLikeStep = /^\d+[.:\-)\s]/.test(headingText);
      if (looksLikeStep) {
        throw new WorkflowSyntaxError(
          `H1 headers (# ...) cannot be used as step headers. Use H2 (## ${headingText}) instead.`
        );
      }
    }

    // Handle H2 headings - these are step headers
    if (isHeading(node) && node.depth === 2) {
      finalizePendingSubstep();

      if (currentStep) {
        steps.push(finalizeStep(currentStep, pendingConditionals, implicitText));
        pendingConditionals = [];
        implicitText = '';
      }

      const headingText = extractText(node);
      const parsed = extractStepHeader(headingText);
      if (parsed) {
        currentStep = {
          number: parsed.number,
          description: parsed.description,
          prompts: [],
          substeps: []
        };
      }
    }

    // Handle H3 headings - these are substep headers
    if (isHeading(node) && node.depth === 3 && currentStep) {
      finalizePendingSubstep();

      const headingText = extractText(node);
      const parsed = extractSubstepHeader(headingText);

      if (parsed) {
        if (parsed.stepNumber !== currentStep.number) {
          throw new WorkflowSyntaxError(
            `Substep ${headingText} does not belong to step ${String(currentStep.number)}`
          );
        }

        const duplicateId = currentStep.substeps.find((s) => s.id === parsed.id);
        if (duplicateId) {
          throw new WorkflowSyntaxError(
            `Duplicate substep ID '${parsed.id}' in step ${String(currentStep.number)}`
          );
        }

        const hasStatic = currentStep.substeps.some((s) => !s.isDynamic);
        const hasDynamic = currentStep.substeps.some((s) => s.isDynamic);
        if ((hasStatic && parsed.isDynamic) || (hasDynamic && !parsed.isDynamic)) {
          throw new WorkflowSyntaxError(
            `Cannot mix static and dynamic substeps in step ${String(currentStep.number)}`
          );
        }

        currentStep.pendingSubstep = {
          id: parsed.id,
          description: parsed.description,
          agentType: parsed.agentType,
          isDynamic: parsed.isDynamic,
          content: ''
        };
      }
    }

    // Handle code blocks
    if (node.type === 'code' && currentStep) {
      const codeNode = node as Code;
      const lang = codeNode.lang?.split(/\s+/)[0];

      if (lang === 'bash') {
        if (currentStep.command) {
          throw new WorkflowSyntaxError(
            `Multiple code blocks per step not allowed in Step ${String(currentStep.number)}.`
          );
        }
        currentStep.command = { code: codeNode.value };
      }
    }

    // Handle paragraphs
    if (node.type === 'paragraph' && currentStep) {
      const paragraphNode = node as Paragraph;

      if (hasPromptMarker(paragraphNode)) {
        const promptText = extractPromptText(paragraphNode);
        if (promptText) {
          currentStep.prompts.push({ text: promptText });
        }
        return;
      }

      const text = extractText(paragraphNode);
      const lines = text.split('\n');
      let hasConditional = false;

      for (const line of lines) {
        const conditional = parseConditional(line);
        if (conditional) {
          pendingConditionals.push(conditional);
          hasConditional = true;
        } else if (line.trim()) {
          implicitText += line.trim() + '\n';
        }
      }

      if (hasConditional) {
        return;
      }
    }

    // Handle list items
    if (node.type === 'listItem' && currentStep) {
      const listItemNode = node as ListItem;
      const firstParagraph = listItemNode.children.find((c) => c.type === 'paragraph');
      if (firstParagraph) {
        const text = extractText(firstParagraph as Paragraph);
        const conditional = parseConditional(text);
        if (conditional) {
          pendingConditionals.push(conditional);
        } else if (currentStep.pendingSubstep) {
          currentStep.pendingSubstep.content += ' - ' + text + '\n';
        }
      }
    }
  });

  finalizePendingSubstep();

  if (currentStep) {
    steps.push(finalizeStep(currentStep, pendingConditionals, implicitText));
  }

  validateWorkflow(steps);

  return steps;
}

function finalizeStep(
  step: StepBuilder,
  pendingConditionals: ParsedConditional[],
  implicitText: string
): Step {
  if (!step.command && step.prompts.length === 0 && implicitText.trim()) {
    step.prompts.push({ text: implicitText.trim() });
  }

  const conditions = convertConditionals(pendingConditionals);

  return {
    number: step.number,
    description: step.description,
    command: step.command,
    prompts: step.prompts,
    conditions: conditions ?? undefined,
    substeps: step.substeps.length > 0 ? step.substeps : undefined
  };
}

function validateWorkflow(steps: Step[]): void {
  if (steps.length === 0) {
    throw new WorkflowSyntaxError(
      "Workflow must contain at least one step (heading starting with '##')"
    );
  }

  for (let i = 0; i < steps.length; i++) {
    const expected = i + 1;
    if (steps[i].number !== expected) {
      throw new WorkflowSyntaxError(
        `Steps must be numbered sequentially. Expected step ${String(expected)}, found step ${String(steps[i].number)}.`
      );
    }
  }

  for (const step of steps) {
    if (step.conditions) {
      validateAction(step.conditions.pass, step.number, steps.length);
      validateAction(step.conditions.fail, step.number, steps.length);
    }
  }
}

function validateAction(action: Action, stepNum: number, totalSteps: number): void {
  if (action.type === 'GOTO') {
    const target = action.step as number;
    if (target < 1 || target > totalSteps) {
      throw new WorkflowSyntaxError(
        `Step ${String(stepNum)}: GOTO target Step ${String(target)} does not exist.`
      );
    }
    if (target === stepNum) {
      throw new WorkflowSyntaxError(
        `Step ${String(stepNum)}: GOTO self creates infinite loop (use RETRY instead)`
      );
    }
  }
}