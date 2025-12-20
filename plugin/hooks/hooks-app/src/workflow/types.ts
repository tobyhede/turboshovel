// src/workflow/types.ts

/**
 * Branded type for step numbers (1-indexed, never zero)
 */
export type StepNumber = number & { readonly __brand: 'StepNumber' };

/**
 * Factory function to create a valid StepNumber
 * Returns null if the number is invalid (zero, negative, or non-integer)
 */
export function createStepNumber(n: number): StepNumber | null {
  if (n <= 0 || !Number.isInteger(n)) {
    return null;
  }
  return n as StepNumber;
}

/**
 * Discriminated union for workflow actions
 * Prevents invalid states at compile time
 */
export type Action =
  | { readonly type: 'CONTINUE' }
  | { readonly type: 'STOP'; readonly message?: string }
  | { readonly type: 'GOTO'; readonly step: StepNumber }
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
 * A single step in a workflow
 */
export interface Step {
  readonly number: StepNumber;
  readonly description: string;
  readonly command?: Command;
  readonly prompts: readonly Prompt[];
  readonly conditions?: Conditions;
  readonly nestedWorkflow?: string; // Reference to nested workflow file
}

/**
 * Parsed workflow definition
 */
export interface Workflow {
  readonly name: string;
  readonly description?: string;
  readonly steps: readonly Step[];
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
  readonly step: StepNumber;
  readonly stepName: string;
  readonly retryCount: number;
  readonly retryMax: number;
  readonly variables: Record<string, boolean | number | string>;
  readonly tasks: readonly TaskState[];
  readonly nested?: {
    readonly workflow: string;
    readonly instanceId: string;
  };
  readonly startedAt: string;
  readonly updatedAt: string;
}
