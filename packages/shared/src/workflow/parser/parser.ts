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
import type { Step, Action, StepNumber, Substep } from '../types.js';
import {
  extractStepHeader,
  extractSubstepHeader,
  parseConditional,
  convertToTransitions,
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
        const text = extractText(firstParagraph);
        const conditional = parseConditional(text);
        if (conditional) {
          pendingConditionals.push(conditional);
        } else if (currentStep.pendingSubstep) {
          currentStep.pendingSubstep.content += ' - ' + text + '\n';
        } else {
          // Accumulate list items to step content (for step-level workflow extraction)
          currentStep.content += ' - ' + text + '\n';
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

function validateWorkflow(steps: Step[]): void {
  if (steps.length === 0) {
    throw new WorkflowSyntaxError(
      "Workflow must contain at least one step (heading starting with '##')"
    );
  }

  // Conformance Rule 2: Step Pattern
  // Workflow contains EITHER static steps OR exactly one dynamic template
  const staticSteps = steps.filter(s => !s.isDynamic);
  const dynamicSteps = steps.filter(s => s.isDynamic);

  if (staticSteps.length > 0 && dynamicSteps.length > 0) {
    throw new WorkflowSyntaxError(
      'Invalid step pattern: workflow must contain static steps OR exactly one dynamic step template, not both.'
    );
  }

  if (dynamicSteps.length > 1) {
    throw new WorkflowSyntaxError(
      'Invalid step pattern: workflow can have exactly one dynamic step template (## {N}.), not multiple.'
    );
  }

  // Validate static step sequencing (only for static workflows - skip for dynamic)
  if (staticSteps.length > 0) {
    for (let i = 0; i < steps.length; i++) {
      const expected = i + 1;
      if (steps[i].number !== expected) {
        throw new WorkflowSyntaxError(
          `Steps must be numbered sequentially. Expected step ${String(expected)}, found step ${String(steps[i].number)}.`
        );
      }
    }
  }

  for (const step of steps) {
    // CRITICAL: Use stepLabel for ALL error messages to handle dynamic steps
    const stepLabel = step.isDynamic ? '{N}' : String(step.number);

    // Validate: cannot have both workflows and substeps (existing validation)
    if (step.workflows?.length && step.substeps?.length) {
      throw new WorkflowSyntaxError(
        `Step ${stepLabel}: Cannot have both workflows and substeps`
      );
    }

    // Validate: cannot have both body content and workflows
    const hasBody = step.command || step.prompts.length > 0;
    if (hasBody && step.workflows?.length) {
      throw new WorkflowSyntaxError(
        `Step ${stepLabel}: Cannot have both body (command/prompts) and workflow list`
      );
    }

    if (step.transitions) {
      // Pass stepLabel to validateAction for proper error messages
      // Keep current signature but pass 0 for dynamic steps (GOTO validation is skipped for dynamic workflows anyway)
      const stepNum = step.isDynamic ? 0 : step.number!;
      validateAction(step.transitions.pass, stepNum, steps.length, steps);
      validateAction(step.transitions.fail, stepNum, steps.length, steps);
    }
  }
}

function validateAction(
  action: Action,
  stepNum: number,
  totalSteps: number,
  steps: Step[]
): void {
  if (action.type === 'GOTO') {
    const targetStep = action.target.step as number;
    const targetSubstep = action.target.substep;

    // Validate step exists
    if (targetStep < 1 || targetStep > totalSteps) {
      throw new WorkflowSyntaxError(
        `Step ${String(stepNum)}: GOTO target step ${String(targetStep)} does not exist (workflow has ${String(totalSteps)} steps).`
      );
    }

    // Validate substep (if specified)
    if (targetSubstep) {
      const step = steps[targetStep - 1];

      // Step must have substeps
      if (!step.substeps || step.substeps.length === 0) {
        throw new WorkflowSyntaxError(
          `Step ${String(stepNum)}: GOTO ${String(targetStep)}.${targetSubstep} invalid - step ${String(targetStep)} has no substeps.`
        );
      }

      // Reject GOTO into dynamic substeps
      const hasDynamic = step.substeps.some(s => s.isDynamic);
      if (hasDynamic) {
        throw new WorkflowSyntaxError(
          `Step ${String(stepNum)}: Cannot GOTO substep of dynamic step. Use GOTO ${String(targetStep)} instead.`
        );
      }

      // Substep must exist
      const substepExists = step.substeps.some(s => s.id === targetSubstep);
      if (!substepExists) {
        throw new WorkflowSyntaxError(
          `Step ${String(stepNum)}: GOTO ${String(targetStep)}.${targetSubstep} invalid - substep does not exist.`
        );
      }
    }

    // Step-level self-reference check only
    if (targetStep === stepNum && !targetSubstep) {
      throw new WorkflowSyntaxError(
        `Step ${String(stepNum)}: GOTO self creates infinite loop (use RETRY instead)`
      );
    }
  }

  // Recurse into RETRY exhaustion action
  if (action.type === 'RETRY') {
    validateAction(action.then, stepNum, totalSteps, steps);
  }
}