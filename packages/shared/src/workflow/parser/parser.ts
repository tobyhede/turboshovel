// src/workflow/parser/parser.ts

import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';
import type { Node } from 'unist';
import type {
  Root,
  Heading,
  Code,
  Paragraph,
  List,
  ListItem,
  Strong,
  Text,
  PhrasingContent
} from 'mdast';
import type { Task, Action, TaskNumber, Subtask } from '../types.js';
import {
  extractTaskHeader,
  extractSubtaskHeader,
  parseConditional,
  convertConditionals
} from './helpers.js';
import { WorkflowSyntaxError, type ParsedConditional } from './types.js';

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

interface TaskBuilder {
  number: TaskNumber;
  description: string;
  command?: { code: string };
  prompts: { text: string }[];
  subtasks: Subtask[];
}

/**
 * Parse workflow markdown into Task array
 *
 * Uses mdast-util-from-markdown to parse markdown into AST,
 * then walks the tree to extract workflow semantics.
 * This mirrors the Rust pulldown-cmark pattern.
 */
export function parseWorkflow(markdown: string): Task[] {
  // Parse markdown to AST
  const tree = fromMarkdown(markdown) as Root;

  // State for walking
  const tasks: Task[] = [];
  let currentTask: TaskBuilder | null = null;
  let pendingConditionals: ParsedConditional[] = [];
  let implicitText = '';

  // Walk AST nodes
  visit(tree, (node: Node, index: number | undefined, parent: Node | undefined) => {
    // Handle H1 headings - reject if they look like task headers
    if (node.type === 'heading' && node.depth === 1) {
      const headingText = extractText(node);
      const looksLikeTask = /^\d+[.:\-)\s]/.test(headingText);
      if (looksLikeTask) {
        throw new WorkflowSyntaxError(
          `H1 headers (# ...) cannot be used as task headers. Use H2 (## ${headingText}) instead.`
        );
      }
    }

    // Handle H2 headings - these are task headers
    if (node.type === 'heading' && node.depth === 2) {
      // Finalize previous task
      if (currentTask) {
        tasks.push(finalizeTask(currentTask, pendingConditionals, implicitText));
        pendingConditionals = [];
        implicitText = '';
      }

      // Start new task
      const headingText = extractText(node);
      const parsed = extractTaskHeader(headingText);
      if (parsed) {
        currentTask = {
          number: parsed.number,
          description: parsed.description,
          prompts: [],
          subtasks: []
        };
      }
    }

    // Handle H3 headings - these are subtask headers
    if (node.type === 'heading' && node.depth === 3 && currentTask) {
      const headingText = extractText(node);
      const parsed = extractSubtaskHeader(headingText);

      if (parsed) {
        // Validate subtask prefix matches current task number
        if (parsed.taskNumber !== currentTask.number) {
          throw new WorkflowSyntaxError(
            `Subtask ${headingText} does not belong to task ${currentTask.number} (it belongs to task ${parsed.taskNumber})`
          );
        }

        // Check for duplicate subtask IDs
        const duplicateId = currentTask.subtasks.find((s) => s.id === parsed.id);
        if (duplicateId) {
          throw new WorkflowSyntaxError(
            `Duplicate subtask ID '${parsed.id}' in task ${currentTask.number}`
          );
        }

        // Check for mixing static and dynamic subtasks
        const hasStatic = currentTask.subtasks.some((s) => !s.isDynamic);
        const hasDynamic = currentTask.subtasks.some((s) => s.isDynamic);
        if ((hasStatic && parsed.isDynamic) || (hasDynamic && !parsed.isDynamic)) {
          throw new WorkflowSyntaxError(
            `Cannot mix static subtasks (like 1.1) and dynamic subtasks (like 1.{n}) in task ${currentTask.number}`
          );
        }

        // Add subtask
        currentTask.subtasks.push({
          id: parsed.id,
          description: parsed.description,
          agentType: parsed.agentType,
          isDynamic: parsed.isDynamic
        });
      }
    }

    // Handle code blocks
    if (node.type === 'code' && currentTask) {
      const codeNode = node as Code;
      const lang = codeNode.lang?.split(/\s+/)[0];

      if (lang === 'bash') {
        if (currentTask.command) {
          throw new WorkflowSyntaxError(
            `Multiple code blocks per task not allowed. Task ${currentTask.number} already has a command block. ` +
              `Suggestion: (1) Combine commands using && or ; operators, or (2) Split into separate tasks.`
          );
        }
        currentTask.command = { code: codeNode.value };
      }
    }

    // Handle paragraphs - check for conditionals or prompts
    if (node.type === 'paragraph' && currentTask) {
      const paragraphNode = node as Paragraph;

      // Check for **Prompt:** marker
      if (hasPromptMarker(paragraphNode)) {
        const promptText = extractPromptText(paragraphNode);
        if (promptText) {
          currentTask.prompts.push({ text: promptText });
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
    if (node.type === 'listItem' && currentTask) {
      const listItemNode = node as ListItem;
      // Get text from first paragraph child
      const firstParagraph = listItemNode.children.find((c) => c.type === 'paragraph');
      if (firstParagraph) {
        const text = extractText(firstParagraph as Paragraph);
        const conditional = parseConditional(text);
        if (conditional) {
          pendingConditionals.push(conditional);
        }
      }
    }
  });

  // Finalize last task
  if (currentTask) {
    tasks.push(finalizeTask(currentTask, pendingConditionals, implicitText));
  }

  // Validate workflow
  validateWorkflow(tasks);

  return tasks;
}

function finalizeTask(
  task: TaskBuilder,
  pendingConditionals: ParsedConditional[],
  implicitText: string
): Task {
  // Create implicit prompt if: no code block AND no explicit prompts
  if (!task.command && task.prompts.length === 0 && implicitText.trim()) {
    task.prompts.push({ text: implicitText.trim() });
  }

  // Convert conditionals
  const conditions = convertConditionals(pendingConditionals);

  return {
    number: task.number,
    description: task.description,
    command: task.command,
    prompts: task.prompts,
    conditions: conditions || undefined,
    subtasks: task.subtasks.length > 0 ? task.subtasks : undefined
  };
}

function validateWorkflow(tasks: Task[]): void {
  // Validate non-empty
  if (tasks.length === 0) {
    throw new WorkflowSyntaxError(
      "Workflow must contain at least one task (heading starting with '##')"
    );
  }

  // Validate sequential numbering
  for (let i = 0; i < tasks.length; i++) {
    const expected = i + 1;
    if (tasks[i].number !== expected) {
      throw new WorkflowSyntaxError(
        `Tasks must be numbered sequentially. Expected task ${expected}, found task ${tasks[i].number}.\n` +
          `Workflows must have exactly one algorithm with continuous numbering (1, 2, 3...).`
      );
    }
  }

  // Validate GOTO targets
  for (const task of tasks) {
    if (task.conditions) {
      validateAction(task.conditions.pass, task.number, tasks.length);
      validateAction(task.conditions.fail, task.number, tasks.length);
    }
  }
}

function validateAction(action: Action, taskNum: number, totalTasks: number): void {
  if (action.type === 'GOTO') {
    const target = action.task as number;
    if (target < 1 || target > totalTasks) {
      throw new WorkflowSyntaxError(
        `Task ${taskNum}: GOTO target Task ${target} does not exist (workflow has ${totalTasks} tasks)`
      );
    }
    if (target === taskNum) {
      throw new WorkflowSyntaxError(
        `Task ${taskNum}: GOTO self creates infinite loop (use RETRY instead)`
      );
    }
  }
}
