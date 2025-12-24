import { createTaskNumber, type TaskNumber } from './types';

/**
 * Task identifier with optional subtask
 * Format: "3" or "3.A" (task with optional subtask letter)
 */
export interface TaskId {
  readonly task: TaskNumber;
  readonly subtask?: string;
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
 *   Used when parsing TaskIds from CLI arguments like `--task 3` or `--task 3.A`
 *   Expects the entire string to be the task ID with no trailing text
 *   "3" -> { task: 3 }
 *   "3.A" -> { task: 3, subtask: 'A' }
 *   "3 - description" -> null (fails because of space)
 *
 * With requireSeparator (Task description parsing):
 *   Used when parsing TaskIds from agent task descriptions where additional text
 *   follows the ID. The separator requirement prevents false matches on text
 *   that happens to start with a number.
 *   "3 - Review code" -> { task: 3 }
 *   "3.A - First reviewer" -> { task: 3, subtask: 'A' }
 *   "5: Execute" -> { task: 5 }
 *   "3" -> null (fails because no separator found)
 *
 * @see parseTaskId for a convenience wrapper with requireSeparator: true
 */
export function parseTaskIdFromString(
  input: string,
  options?: ParseTaskIdOptions
): TaskId | null {
  if (!input) return null;

  const requireSeparator = options?.requireSeparator ?? false;

  // Build regex based on options
  const pattern = requireSeparator
    ? /^(\d+)(?:\.([A-Za-z]))?[\s\-:]/  // Must have separator
    : /^(\d+)(?:\.([A-Za-z]))?$/;        // Must match entire string

  const match = input.match(pattern);
  if (!match) return null;

  const taskNum = parseInt(match[1], 10);
  const task = createTaskNumber(taskNum);
  if (!task) return null;  // Invalid task number (0, negative, or too large)

  return {
    task,
    subtask: match[2]?.toUpperCase(),
  };
}

/**
 * Parse TaskId from Task tool description (requires separator after ID)
 *
 * This function is used when parsing TaskIds from agent task descriptions where
 * additional text follows the ID. The separator requirement prevents false matches
 * on text that happens to start with a number.
 *
 * Valid formats:
 *   "3 - Review code" -> { task: 3 }
 *   "3.A - First reviewer" -> { task: 3, subtask: 'A' }
 *   "5: Execute" -> { task: 5 }
 *
 * Invalid (no separator):
 *   "3Review" -> null
 *   "3.A" -> null (use parseTaskIdFromString without requireSeparator for raw IDs)
 *
 * @see parseTaskIdFromString with { requireSeparator: false } for CLI argument parsing (no separator)
 * @deprecated Use parseTaskIdFromString with { requireSeparator: true }
 */
export function parseTaskId(description: string): TaskId | null {
  return parseTaskIdFromString(description, { requireSeparator: true });
}

/**
 * Serialize TaskId to string (e.g., { task: 3, subtask: 'A' } -> "3.A")
 */
export function taskIdToString(taskId: TaskId): string {
  return taskId.subtask ? `${taskId.task}.${taskId.subtask}` : `${taskId.task}`;
}

/**
 * Compare two TaskIds for equality
 */
export function taskIdEquals(a: TaskId, b: TaskId): boolean {
  return a.task === b.task && a.subtask === b.subtask;
}
