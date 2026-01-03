// src/workflow/types.ts

import type { StepId } from './step-id.js';

/**
 * Branded type for step numbers (1-indexed, never zero)
 */
export type StepNumber = number & { readonly __brand: 'StepNumber' };

/**
 * Maximum valid step number (prevent overflow, keep IDs reasonable)
 */
export const MAX_STEP_NUMBER = 999999;

/**
 * Factory function to create a valid StepNumber
 * Returns null if the number is invalid (zero, negative, non-integer, or too large)
 */
export function createStepNumber(n: number): StepNumber | null {
  if (n <= 0 || !Number.isInteger(n) || n > MAX_STEP_NUMBER) {
    return null;
  }
  return n as StepNumber;
}

/**
 * Increment a StepNumber, preserving the brand
 * Returns null if result would exceed maximum
 */
export function incrementStepNumber(sn: StepNumber): StepNumber | null {
  return createStepNumber(sn + 1);
}

/**
 * Decrement a StepNumber, preserving the brand
 * Returns null if result would be less than 1
 */
export function decrementStepNumber(sn: StepNumber): StepNumber | null {
  return createStepNumber(sn - 1);
}

/**
 * Re-export StepId from step-id module
 */
export type { StepId } from './step-id.js';

/**
 * A step queued for agent binding, optionally with a child workflow.
 * Used in the pending step queue to correlate Step tool dispatch with SubagentStart.
 */
export interface PendingStep {
  readonly stepId: StepId;
  readonly workflow?: string;  // Child workflow file path (relative)
}

/**
 * Non-recursive action types (everything except RETRY)
 */
export type NonRetryAction =
  | { readonly type: 'CONTINUE' }
  | { readonly type: 'STOP'; readonly message?: string }
  | { readonly type: 'GOTO'; readonly target: StepId }
  | { readonly type: 'DONE' };

/**
 * Discriminated union for workflow actions
 * Prevents invalid states at compile time
 */
export type Action =
  | NonRetryAction
  | { readonly type: 'RETRY'; readonly max: number; readonly then: NonRetryAction };

/**
 * Outcome-to-action mappings for step completion
 *
 * Valid combinations only:
 * - all: true  = PASS ALL + FAIL ANY (pessimistic, default)
 * - all: false = PASS ANY + FAIL ALL (optimistic)
 */
interface PassAllTransitions {
  readonly all: true;
  readonly pass: Action; // triggers when ALL complete
  readonly fail: Action; // triggers when ANY blocked
}

interface PassAnyTransitions {
  readonly all: false;
  readonly pass: Action; // triggers when ANY complete
  readonly fail: Action; // triggers when ALL blocked
}

export type Transitions = PassAllTransitions | PassAnyTransitions;

/**
 * Agent binding status
 */
export type AgentStatus = 'running' | 'done' | 'stopped';

/**
 * Agent binding result (for completed agents)
 */
export type AgentResult = 'pass' | 'fail';

/**
 * Runtime state of a substep within a step
 */
export interface SubstepState {
  readonly id: string;            // Matches Substep.id ("1", "2", or dynamic instance)
  readonly status: 'pending' | 'running' | 'done';
  readonly agentId?: string;      // Agent bound to this substep
  readonly result?: AgentResult;  // 'pass' | 'fail' when done
}

/**
 * Agent binding - tracks which step an agent is working on
 */
export interface AgentBinding {
  readonly stepId: StepId;
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
 * A substep within a step (H3 header)
 */
export interface Substep {
  readonly id: string; // "1", "2", "3" or "{n}" for dynamic
  readonly description: string;
  readonly agentType?: string; // e.g., "code-review-agent" from "(code-review-agent)"
  readonly isDynamic: boolean; // true for ### N.{n}, false for ### N.1
  readonly workflows?: readonly string[];  // Child workflow files
}

/**
 * A single step in a workflow
 */
export interface Step {
  readonly number: StepNumber;
  readonly description: string;
  readonly command?: Command;
  readonly prompts: readonly Prompt[];
  readonly transitions?: Transitions;
  readonly substeps?: readonly Substep[];
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
 * Step state within a workflow
 */
export interface StepState {
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
  readonly substep?: string;  // Current substep ID (derived from XState context)
  readonly stepName: string;
  readonly retryCount: number;
  readonly variables: Record<string, boolean | number | string>;
  readonly steps: readonly StepState[];

  // Orchestration fields
  readonly pendingSteps: readonly PendingStep[];
  readonly agentBindings: Readonly<Record<string, AgentBinding>>;

  // Substep tracking (only populated when current step has substeps)
  readonly substepStates?: readonly SubstepState[];

  // Child workflow fields (optional)
  readonly agentId?: string;
  readonly parentWorkflowId?: string;
  readonly parentStepId?: StepId;

  readonly nested?: {
    readonly workflow: string;
    readonly instanceId: string;
  };

  readonly startedAt: string;
  readonly updatedAt: string;

  // Prompted(true = prompted/manual, false/undefined = execute)
  readonly prompted?: boolean;
  readonly lastResult?: 'pass' | 'fail';
  readonly lastAction?: 'START' | 'CONTINUE' | 'GOTO' | 'COMPLETE' | 'STOP' | 'RETRY';

  readonly snapshot?: unknown;
}
