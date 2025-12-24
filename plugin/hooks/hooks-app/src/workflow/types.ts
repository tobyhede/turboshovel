// src/workflow/types.ts

import type { TaskId } from './task-id';

/**
 * Branded type for task numbers (1-indexed, never zero)
 */
export type TaskNumber = number & { readonly __brand: 'TaskNumber' };

/**
 * Factory function to create a valid TaskNumber
 * Returns null if the number is invalid (zero, negative, or non-integer)
 */
export function createTaskNumber(n: number): TaskNumber | null {
  if (n <= 0 || !Number.isInteger(n)) {
    return null;
  }
  return n as TaskNumber;
}

/**
 * Re-export TaskId from task-id module
 */
export type { TaskId } from './task-id';

/**
 * Discriminated union for workflow actions
 * Prevents invalid states at compile time
 */
export type Action =
  | { readonly type: 'CONTINUE' }
  | { readonly type: 'STOP'; readonly message?: string }
  | { readonly type: 'GOTO'; readonly task: TaskNumber }
  | { readonly type: 'DONE' }
  | { readonly type: 'RETRY'; readonly max?: number };

/**
 * Conditional branch (PASS or FAIL)
 */
export interface Conditions {
  readonly pass: Action;
  readonly fail: Action;
}

/**
 * Agent binding status
 */
export type AgentStatus = 'running' | 'done' | 'stopped';

/**
 * Agent binding result (for completed agents)
 */
export type AgentResult = 'pass' | 'fail';

/**
 * Agent binding - tracks which task an agent is working on
 */
export interface AgentBinding {
  readonly taskId: TaskId;
  readonly childWorkflowId?: string;
  readonly status: AgentStatus;
  readonly result?: AgentResult;
}

/**
 * Command to execute (bash code block)
 */
export interface Command {
  readonly code: string;
}

/**
 * Prompt for agent (implicit or explicit)
 */
export interface Prompt {
  readonly text: string;
}

/**
 * A subtask within a task (H3 header)
 */
export interface Subtask {
  readonly id: string;  // A, B, C or {n} for dynamic
  readonly description: string;
  readonly agentType?: string;  // e.g., "code-review-agent" from "(code-review-agent)"
  readonly isDynamic: boolean;  // true for ### N.{n}, false for ### N.A
}

/**
 * A single task in a workflow
 */
export interface Task {
  readonly number: TaskNumber;
  readonly description: string;
  readonly command?: Command;
  readonly prompts: readonly Prompt[];
  readonly conditions?: Conditions;
  readonly subtasks?: readonly Subtask[];
  readonly nestedWorkflow?: string; // Reference to nested workflow file
}

/**
 * Parsed workflow definition
 */
export interface Workflow {
  readonly name: string;
  readonly description?: string;
  readonly tasks: readonly Task[];
}

/**
 * Task state within a workflow
 */
export interface TaskState {
  readonly id: string;
  readonly status: 'pending' | 'running' | 'complete' | 'blocked';
  readonly subagentType?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

/**
 * Workflow execution state (persisted)
 */
export interface WorkflowState {
  readonly id: string;
  readonly workflow: string;
  readonly task: TaskNumber;
  readonly taskName: string;
  readonly retryCount: number;
  readonly retryMax: number;
  readonly variables: Record<string, boolean | number | string>;
  readonly tasks: readonly TaskState[];

  // Orchestration fields
  readonly pendingTasks: readonly TaskId[];
  readonly agentBindings: Readonly<Record<string, AgentBinding>>;

  // Child workflow fields (optional)
  readonly agentId?: string;
  readonly parentWorkflowId?: string;
  readonly parentTaskId?: TaskId;

  readonly nested?: {
    readonly workflow: string;
    readonly instanceId: string;
  };
  readonly startedAt: string;
  readonly updatedAt: string;
}
