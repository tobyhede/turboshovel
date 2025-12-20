// src/workflow/parser/parser.ts

import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';
import type { Root, Heading, Code, Paragraph, List, ListItem, Strong, Text, PhrasingContent } from 'mdast';
import type { Step, Action, StepNumber } from '../types';
import { extractStepHeader, parseConditional, convertConditionals } from './helpers';
import { WorkflowSyntaxError, type ParsedConditional } from './types';

/**
 * Extract plain text from mdast node
 */
function extractText(node: PhrasingContent | Heading | Paragraph | ListItem): string {
  if (node.type === 'text') {
    return (node as Text).value;
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
      promptText += extractText(child as PhrasingContent);
    }
  }

  return promptText.trim();
}

interface StepBuilder {
  number: StepNumber;
  description: string;
  command?: { code: string };
  prompts: { text: string }[];
}

/**
 * Parse workflow markdown into Step array
 *
 * Uses mdast-util-from-markdown to parse markdown into AST,
 * then walks the tree to extract workflow semantics.
 * This mirrors the Rust pulldown-cmark pattern.
 */
export function parseWorkflow(markdown: string): Step[] {
  // Parse markdown to AST
  const tree = fromMarkdown(markdown) as Root;

  // State for walking
  const steps: Step[] = [];
  let currentStep: StepBuilder | null = null;
  let pendingConditionals: ParsedConditional[] = [];
  let implicitText = '';

  // Walk AST nodes
  visit(tree, (node: any, index: any, parent: any) => {
    // Handle H1 headings - reject if they look like step headers
    if (node.type === 'heading' && node.depth === 1) {
      const headingText = extractText(node);
      const looksLikeStep = /^\d+[.:\-)\s]/.test(headingText);
      if (looksLikeStep) {
        throw new WorkflowSyntaxError(
          `H1 headers (# ...) cannot be used as step headers. Use H2 (## ${headingText}) instead.`
        );
      }
    }

    // Handle H2 headings - these are step headers
    if (node.type === 'heading' && node.depth === 2) {
      // Finalize previous step
      if (currentStep) {
        steps.push(finalizeStep(currentStep, pendingConditionals, implicitText));
        pendingConditionals = [];
        implicitText = '';
      }

      // Start new step
      const headingText = extractText(node);
      const parsed = extractStepHeader(headingText);
      if (parsed) {
        currentStep = {
          number: parsed.number,
          description: parsed.description,
          prompts: [],
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
            `Multiple code blocks per step not allowed. Step ${currentStep.number} already has a command block. ` +
            `Suggestion: (1) Combine commands using && or ; operators, or (2) Split into separate steps.`
          );
        }
        currentStep.command = { code: codeNode.value };
      }
    }

    // Handle paragraphs - check for conditionals or prompts
    if (node.type === 'paragraph' && currentStep) {
      const paragraphNode = node as Paragraph;

      // Check for **Prompt:** marker
      if (hasPromptMarker(paragraphNode)) {
        const promptText = extractPromptText(paragraphNode);
        if (promptText) {
          currentStep.prompts.push({ text: promptText });
        }
        return;
      }

      // Check for conditionals (PASS:/FAIL:)
      // A paragraph may contain multiple lines, each potentially a conditional
      const text = extractText(paragraphNode);
      const lines = text.split('\n');
      let hasConditional = false;

      for (const line of lines) {
        const conditional = parseConditional(line);
        if (conditional) {
          pendingConditionals.push(conditional);
          hasConditional = true;
        } else if (line.trim()) {
          // Non-conditional, non-empty line
          implicitText += line.trim() + '\n';
        }
      }

      if (hasConditional) {
        return;
      }
    }

    // Handle list items - check for conditionals
    if (node.type === 'listItem' && currentStep) {
      const listItemNode = node as ListItem;
      // Get text from first paragraph child
      const firstParagraph = listItemNode.children.find(c => c.type === 'paragraph');
      if (firstParagraph) {
        const text = extractText(firstParagraph as Paragraph);
        const conditional = parseConditional(text);
        if (conditional) {
          pendingConditionals.push(conditional);
        }
      }
    }
  });

  // Finalize last step
  if (currentStep) {
    steps.push(finalizeStep(currentStep, pendingConditionals, implicitText));
  }

  // Validate workflow
  validateWorkflow(steps);

  return steps;
}

function finalizeStep(
  step: StepBuilder,
  pendingConditionals: ParsedConditional[],
  implicitText: string
): Step {
  // Create implicit prompt if: no code block AND no explicit prompts
  if (!step.command && step.prompts.length === 0 && implicitText.trim()) {
    step.prompts.push({ text: implicitText.trim() });
  }

  // Convert conditionals
  const conditions = convertConditionals(pendingConditionals);

  return {
    number: step.number,
    description: step.description,
    command: step.command,
    prompts: step.prompts,
    conditions: conditions || undefined,
  };
}

function validateWorkflow(steps: Step[]): void {
  // Validate non-empty
  if (steps.length === 0) {
    throw new WorkflowSyntaxError(
      "Workflow must contain at least one step (heading starting with '##')"
    );
  }

  // Validate sequential numbering
  for (let i = 0; i < steps.length; i++) {
    const expected = i + 1;
    if (steps[i].number !== expected) {
      throw new WorkflowSyntaxError(
        `Steps must be numbered sequentially. Expected step ${expected}, found step ${steps[i].number}.\n` +
        `Workflows must have exactly one algorithm with continuous numbering (1, 2, 3...).`
      );
    }
  }

  // Validate GOTO targets
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
        `Step ${stepNum}: GOTO target Step ${target} does not exist (workflow has ${totalSteps} steps)`
      );
    }
    if (target === stepNum) {
      throw new WorkflowSyntaxError(
        `Step ${stepNum}: GOTO self creates infinite loop (use RETRY instead)`
      );
    }
  }
}
