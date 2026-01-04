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
import type { Step, StepNumber, Substep } from '../types.js';
import {
  extractStepHeader,
  extractSubstepHeader,
  parseConditional,
  convertToTransitions,
  extractWorkflowList
} from './helpers.js';
import { WorkflowSyntaxError, type ParsedConditional } from './types.js';
import { validateWorkflow } from './validator.js';

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
  number?: StepNumber;           // Optional - undefined for dynamic steps
  isDynamic: boolean;            // Required - true for {N} steps, false for static
  description: string;
  command?: { code: string };
  prompts: { text: string }[];
  substeps: Substep[];
  pendingSubstep?: SubstepBuilder;
  content: string;  // Accumulated step body content for workflow extraction
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
  const finalizePendingSubstep = (): void => {
    if (currentStep?.pendingSubstep) {
      const workflows = extractWorkflowList(currentStep.pendingSubstep.content);
      const substep: Substep = {
        id: currentStep.pendingSubstep.id,
        description: currentStep.pendingSubstep.description,
        agentType: currentStep.pendingSubstep.agentType,
        isDynamic: currentStep.pendingSubstep.isDynamic,
        prompts: [],  // ADD THIS - empty for now
        workflows: workflows.length > 0 ? workflows : undefined
      };
      currentStep.substeps.push(substep);
      currentStep.pendingSubstep = undefined;
    }
  };

  // Walk AST nodes
  visit(tree, (node: Node, _index, parent: any) => {
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

    // Reject H4+ headings (Conformance Rule 1)
    if (isHeading(node) && node.depth >= 4) {
      throw new WorkflowSyntaxError(
        `H4+ headings are not allowed in workflows. Found heading at depth ${node.depth}. Use ## for steps and ### for substeps only.`
      );
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
          isDynamic: parsed.isDynamic,
          description: parsed.description,
          prompts: [],
          substeps: [],
          content: ''
        };
      }
    }

    // Handle H3 headings - these are substep headers
    if (isHeading(node) && node.depth === 3 && currentStep) {
      finalizePendingSubstep();

      const headingText = extractText(node);
      const parsed = extractSubstepHeader(headingText);

      if (parsed) {
        // Validate substep parent matches current step
        if (currentStep.isDynamic) {
          if (parsed.stepRef !== '{N}') {
            throw new WorkflowSyntaxError(
              `Substep ${headingText} uses numeric prefix but parent step is dynamic ({N})`
            );
          }
        } else {
          if (parsed.stepRef === '{N}') {
            throw new WorkflowSyntaxError(
              `Substep ${headingText} uses {N} prefix but parent step ${String(currentStep.number)} is static`
            );
          }
          if (parsed.stepRef !== currentStep.number) {
            throw new WorkflowSyntaxError(
              `Substep ${headingText} does not belong to step ${String(currentStep.number)}`
            );
          }
        }

        const duplicateId = currentStep.substeps.find((s) => s.id === parsed.id);
        if (duplicateId) {
          const stepLabel = currentStep.isDynamic ? '{N}' : String(currentStep.number);
          throw new WorkflowSyntaxError(
            `Duplicate substep ID '${parsed.id}' in step ${stepLabel}`
          );
        }

        const hasStatic = currentStep.substeps.some((s) => !s.isDynamic);
        const hasDynamic = currentStep.substeps.some((s) => s.isDynamic);
        if ((hasStatic && parsed.isDynamic) || (hasDynamic && !parsed.isDynamic)) {
          const stepLabel = currentStep.isDynamic ? '{N}' : String(currentStep.number);
          throw new WorkflowSyntaxError(
            `Cannot mix static and dynamic substeps in step ${stepLabel}`
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
          const stepLabel = currentStep.isDynamic ? '{N}' : String(currentStep.number);
          throw new WorkflowSyntaxError(
            `Multiple code blocks per step not allowed in Step ${stepLabel}.`
          );
        }
        currentStep.command = { code: codeNode.value };
      }
    }

    // Handle paragraphs - SKIP if inside a list item to avoid double-processing
    if (node.type === 'paragraph' && currentStep && parent?.type !== 'listItem') {
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
      const firstParagraph = listItemNode.children.find((c) => c.type === 'paragraph') as Paragraph | undefined;
      if (firstParagraph) {
        const text = extractText(firstParagraph);
        const conditional = parseConditional(text);
        if (conditional) {
          pendingConditionals.push(conditional);
        } else if (currentStep.pendingSubstep) {
          currentStep.pendingSubstep.content += ' - ' + text + '\n';
        } else {
          // Accumulate list items to step content (for step-level workflow extraction)
          const itemText = ' - ' + text + '\n';
          currentStep.content += itemText;

          // AND to implicitText (so they appear in the prompt)
          // BUT only if it doesn't look like a workflow reference
          if (!/^\S+\.workflow\.md$/.test(text.trim())) {
            implicitText += itemText;
          }
        }
      }
    }
  });

  finalizePendingSubstep();

  // currentStep may have been set during H2 heading processing
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (currentStep) {
    steps.push(finalizeStep(currentStep, pendingConditionals, implicitText));
  }

  // Use the spec-aligned validator
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

  const transitions = convertToTransitions(pendingConditionals);
  const workflows = extractWorkflowList(step.content);

  return {
    number: step.number,
    isDynamic: step.isDynamic,
    description: step.description,
    command: step.command,
    prompts: step.prompts,
    transitions: transitions ?? undefined,
    substeps: step.substeps.length > 0 ? step.substeps : undefined,
    workflows: workflows.length > 0 ? workflows : undefined
  };
}