import type { TaskId } from '../task-id';

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
