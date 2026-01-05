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
import {
  type Step,
  type Substep,
  type Workflow,
  type Command,
  type Prompt
} from './ast.js';
import {
  type StepNumber,
  type ParsedConditional,
  WorkflowSyntaxError
} from './types.js';
import {
  extractStepHeader,
  extractSubstepHeader,
  parseConditional,
  convertToTransitions,
  extractWorkflowList
} from './helpers.js';
import { validateWorkflow } from './validator.js';
import { extractFrontmatter, nameFromFilename } from './frontmatter.js';

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
    return (node as any).value;
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => extractText(child as any)).join('');
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
  command?: Command;
  prompts: Prompt[];
  pendingConditionals: ParsedConditional[];
}

interface StepBuilder {
  number?: StepNumber;
  isDynamic: boolean;
  description: string;
  command?: Command;
  prompts: Prompt[];
  substeps: Substep[];
  pendingSubstep?: SubstepBuilder;
  content: string;
}

/**
 * Parse workflow markdown into Step array (compatibility wrapper)
 */
export function parseWorkflow(markdown: string): Step[] {
  const doc = parseWorkflowDocument(markdown);
  return [...doc.steps];
}

/**
 * Parse entire workflow document including metadata
 */
export function parseWorkflowDocument(markdown: string, filename?: string): Workflow {
  const { frontmatter, content } = extractFrontmatter(markdown);
  const tree = fromMarkdown(content);

  const steps: Step[] = [];
  let title: string | undefined;
  let preamble: string = '';
  
  let currentStep: StepBuilder | null = null;
  let pendingConditionals: ParsedConditional[] = [];
  let implicitText = '';
  let inPreamble = true;

  const finalizePendingSubstep = (): void => {
    if (currentStep?.pendingSubstep) {
      const ps = currentStep.pendingSubstep;
      const workflows = extractWorkflowList(ps.content);
      const transitions = convertToTransitions(ps.pendingConditionals);

      const prompts = [...ps.prompts];
      if (ps.content.trim()) {
        const contentWithoutWorkflows = ps.content
          .split('\n')
          .filter(line => !line.trim().startsWith('-') || !line.includes('.workflow.md'))
          .join('\n')
          .trim();
        if (contentWithoutWorkflows) {
          prompts.push({ text: contentWithoutWorkflows });
        }
      }

      const substep: Substep = {
        id: ps.id,
        description: ps.description,
        agentType: ps.agentType,
        isDynamic: ps.isDynamic,
        command: ps.command,
        prompts: prompts,
        transitions: transitions ?? undefined,
        workflows: workflows.length > 0 ? workflows : undefined
      };
      currentStep.substeps.push(substep);
      currentStep.pendingSubstep = undefined;
    }
  };

  visit(tree, (node: Node, _index, parent: Node | undefined) => {
    if (isHeading(node) && node.depth === 1) {
      const headingText = extractText(node);
      const looksLikeStep = /^\d+[.:\-)\s]/.test(headingText);
      if (looksLikeStep) {
        throw new WorkflowSyntaxError(
          `H1 headers (# ...) cannot be used as step headers. Use H2 (## ${headingText}) instead.`
        );
      }
      if (!title) title = headingText;
    }

    if (isHeading(node) && node.depth >= 4) {
      throw new WorkflowSyntaxError(
        `H4+ headings are not allowed in workflows. Found heading at depth ${String(node.depth)}. Use ## for steps and ### for substeps only.`
      );
    }

    if (isHeading(node) && node.depth === 2) {
      inPreamble = false;
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

    if (isHeading(node) && node.depth === 3 && currentStep) {
      inPreamble = false;
      if (currentStep.pendingSubstep) {
        currentStep.pendingSubstep.pendingConditionals.push(...pendingConditionals);
        pendingConditionals = [];
      }
      finalizePendingSubstep();

      const headingText = extractText(node);
      const parsed = extractSubstepHeader(headingText);

      if (parsed) {
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
          content: '',
          command: undefined,
          prompts: [],
          pendingConditionals: []
        };
      }
    }

    if (node.type === 'code' && currentStep) {
      const codeNode = node as Code;
      const lang = codeNode.lang?.split(/\s+/)[0].toLowerCase();

      if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
        if (currentStep.pendingSubstep) {
          if (currentStep.pendingSubstep.command) {
            throw new WorkflowSyntaxError(
              `Multiple code blocks per substep not allowed in substep ${currentStep.pendingSubstep.id}`
            );
          }
          currentStep.pendingSubstep.command = { code: codeNode.value.trim() };
        } else {
          if (currentStep.command) {
            const stepLabel = currentStep.isDynamic ? '{N}' : String(currentStep.number);
            throw new WorkflowSyntaxError(
              `Multiple code blocks per step not allowed in Step ${stepLabel}.`
            );
          }
          currentStep.command = { code: codeNode.value.trim() };
        }
      } else if (lang === 'prompt') {
        if (currentStep.pendingSubstep) {
          currentStep.pendingSubstep.prompts.push({ text: codeNode.value.trim() });
        } else {
          currentStep.prompts.push({ text: codeNode.value.trim() });
        }
      } else {
        const passiveText = '\n' + '```' + (codeNode.lang ?? '') + '\n' + codeNode.value + '\n' + '```' + '\n';
        if (currentStep.pendingSubstep) {
          currentStep.pendingSubstep.content += passiveText;
        } else {
          implicitText += passiveText;
        }
      }
    }

    if (node.type === 'paragraph' && parent && parent.type !== 'listItem') {
      const paragraphNode = node as Paragraph;
      const text = extractText(paragraphNode);

      if (inPreamble) {
        preamble += text + '\n';
        return;
      }

      if (currentStep) {
        if (hasPromptMarker(paragraphNode)) {
          const promptText = extractPromptText(paragraphNode);
          if (promptText) {
            if (currentStep.pendingSubstep) {
              currentStep.pendingSubstep.prompts.push({ text: promptText });
            } else {
              currentStep.prompts.push({ text: promptText });
            }
          }
          return;
        }

        const lines = text.split('\n');
        let hasConditional = false;

        for (const line of lines) {
          const conditional = parseConditional(line);
          if (conditional) {
            if (currentStep.pendingSubstep) {
              currentStep.pendingSubstep.pendingConditionals.push(conditional);
            } else {
              pendingConditionals.push(conditional);
            }
            hasConditional = true;
          } else if (line.trim()) {
            if (currentStep.pendingSubstep) {
              currentStep.pendingSubstep.content += line.trim() + '\n';
            } else {
              implicitText += line.trim() + '\n';
            }
          }
        }

        if (hasConditional) {
          return;
        }
      }
    }

    if (node.type === 'listItem' && currentStep) {
      const listItemNode = node as ListItem;
      const firstParagraph = listItemNode.children.find((c) => c.type === 'paragraph');
      if (firstParagraph) {
        const text = extractText(firstParagraph as Paragraph);
        const conditional = parseConditional(text);
        if (conditional) {
          if (currentStep.pendingSubstep) {
            currentStep.pendingSubstep.pendingConditionals.push(conditional);
          } else {
            pendingConditionals.push(conditional);
          }
        } else if (currentStep.pendingSubstep) {
          currentStep.pendingSubstep.content += ' - ' + text + '\n';
        } else {
          const itemText = ' - ' + text + '\n';
          currentStep.content += itemText;
          if (!/^\S+\.workflow\.md$/.test(text.trim())) {
            implicitText += itemText;
          }
        }
      }
    }
  });

  finalizePendingSubstep();

  if (currentStep) {
    steps.push(finalizeStep(currentStep, pendingConditionals, implicitText));
  }

  validateWorkflow(steps);

  return {
    title,
    description: preamble.trim() || undefined,
    name: frontmatter?.name ?? (filename ? nameFromFilename(filename) : undefined),
    version: frontmatter?.version,
    author: frontmatter?.author,
    tags: frontmatter?.tags,
    steps
  };
}

function finalizeStep(
  step: StepBuilder,
  pendingConditionals: ParsedConditional[],
  implicitText: string
): Step {
  const prompts = [...step.prompts];
  if (implicitText.trim()) {
    prompts.push({ text: implicitText.trim() });
  }

  const transitions = convertToTransitions(pendingConditionals);
  const workflows = extractWorkflowList(step.content);

  return {
    number: step.number,
    isDynamic: step.isDynamic,
    description: step.description,
    command: step.command,
    prompts: prompts,
    transitions: transitions ?? undefined,
    substeps: step.substeps.length > 0 ? step.substeps : undefined,
    workflows: workflows.length > 0 ? workflows : undefined
  };
}