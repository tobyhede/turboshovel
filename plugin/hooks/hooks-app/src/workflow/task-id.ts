/**
 * Task identifier with optional subtask
 * Format: "3" or "3.A" (task with optional subtask letter)
 */
export interface TaskId {
  readonly task: number;
  readonly subtask?: string;
}

export interface ParseTaskIdOptions {
  /** Require a separator after the task ID (space, dash, colon) */
  readonly requireSeparator?: boolean;
}

/**
 * Parse TaskId from string with configurable behavior
 *
 * Without requireSeparator:
 *   "3" -> { task: 3 }
 *   "3.A" -> { task: 3, subtask: 'A' }
 *
 * With requireSeparator:
 *   "3 - Review" -> { task: 3 }
 *   "3.A: Task" -> { task: 3, subtask: 'A' }
 *   "3" -> null (no separator)
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

  const task = parseInt(match[1], 10);
  if (task <= 0) return null;

  return {
    task,
    subtask: match[2]?.toUpperCase(),
  };
}

/**
 * Parse TaskId from Task tool description (requires separator)
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
