import { createTaskNumber, type TaskNumber } from './types.js';

/**
 * Task identifier with optional subtask
 * Format: "3" or "3.1" (task with optional numeric subtask)
 */
export interface TaskId {
  readonly task: TaskNumber;
  readonly subtask?: string; // Numeric string: "1", "2", etc.
}

export interface ParseTaskIdOptions {
  /** Require a separator after the task ID (space, dash, colon) */
  readonly requireSeparator?: boolean;
}

/**
 * Parse TaskId from string with configurable behavior
 *
 * The requireSeparator option controls parsing strictness:
 *
 * Without requireSeparator (CLI argument parsing):
 *   Used when parsing TaskIds from CLI arguments like `--task 3` or `--task 3.1`
 *   Expects the entire string to be the task ID with no trailing text
 *   "3" -> { task: 3 }
 *   "3.1" -> { task: 3, subtask: '1' }
 *   "3 - description" -> null (fails because of space)
 *
 * With requireSeparator (Task description parsing):
 *   Used when parsing TaskIds from agent task descriptions where additional text
 *   follows the ID. The separator requirement prevents false matches on text
 *   that happens to start with a number.
 *   "3 - Review code" -> { task: 3 }
 *   "3.1 - First reviewer" -> { task: 3, subtask: '1' }
 *   "5: Execute" -> { task: 5 }
 *   "3" -> null (fails because no separator found)
 *
 */
export function parseTaskIdFromString(input: string, options?: ParseTaskIdOptions): TaskId | null {
  if (!input) return null;

  const requireSeparator = options?.requireSeparator ?? false;

  // Build regex based on options
  // Subtask is now numeric (e.g., 3.1, 3.2) not alphabetic (3.A, 3.B)
  const pattern = requireSeparator
    ? /^(\d+)(?:\.(\d+))?[\s\-:]/ // Must have separator
    : /^(\d+)(?:\.(\d+))?$/; // Must match entire string

  const match = input.match(pattern);
  if (!match) return null;

  const taskNum = parseInt(match[1], 10);
  const task = createTaskNumber(taskNum);
  if (!task) return null; // Invalid task number (0, negative, or too large)

  return {
    task,
    subtask: match[2] // Already a numeric string
  };
}

/**
 * Serialize TaskId to string (e.g., { task: 3, subtask: '1' } -> "3.1")
 */
export function taskIdToString(taskId: TaskId): string {
  return taskId.subtask ? `${String(taskId.task)}.${taskId.subtask}` : `${String(taskId.task)}`;
}

/**
 * Compare two TaskIds for equality
 */
export function taskIdEquals(a: TaskId, b: TaskId): boolean {
  return a.task === b.task && a.subtask === b.subtask;
}
