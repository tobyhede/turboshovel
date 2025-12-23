/**
 * Task identifier with optional subtask
 * Format: "3" or "3.A" (task with optional subtask letter)
 */
export interface TaskId {
  readonly task: number;
  readonly subtask?: string;
}

/**
 * Parse TaskId from Task tool description
 *
 * Valid formats:
 *   "3 - Review code" -> { task: 3 }
 *   "3.A - First reviewer" -> { task: 3, subtask: 'A' }
 *   "3.a - lowercase" -> { task: 3, subtask: 'A' } (normalized)
 *   "5: Execute" -> { task: 5 }
 *
 * Returns null if no valid TaskId prefix found
 */
export function parseTaskId(description: string): TaskId | null {
  if (!description) return null;

  // Match: "3" or "3.A" at start, followed by separator (space, dash, colon)
  const match = description.match(/^(\d+)(?:\.([A-Za-z]))?[\s\-:]/);
  if (!match) return null;

  const task = parseInt(match[1], 10);
  if (task <= 0) return null;

  return {
    task,
    subtask: match[2]?.toUpperCase(),
  };
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
