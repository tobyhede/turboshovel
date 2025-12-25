import type { TaskId } from '../task-id';
import type { Task } from '../types';

/**
 * Substitute workflow variables in a prompt string.
 *
 * Currently supported:
 * - $n → subtask number (e.g., "1", "2", "3")
 *
 * @param prompt - The prompt template containing $n placeholders
 * @param taskId - The TaskId with optional subtask
 * @returns The prompt with $n replaced by subtask number
 */
export function substituteVariables(prompt: string, taskId: TaskId): string {
  if (!taskId.subtask) {
    return prompt;
  }
  return prompt.replace(/\$n/g, taskId.subtask);
}

/**
 * Get the prompt for a task from parsed workflow tasks.
 *
 * @param tasks - Parsed tasks from workflow
 * @param taskId - The TaskId to find prompt for
 * @returns The first prompt text, or undefined if not found
 */
export function getTaskPrompt(tasks: readonly Task[], taskId: TaskId): string | undefined {
  const task = tasks.find(t => t.number === taskId.task);
  if (!task || task.prompts.length === 0) {
    return undefined;
  }
  return task.prompts[0].text;
}
