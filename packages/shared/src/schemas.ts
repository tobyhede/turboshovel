import { z } from 'zod';
import { MAX_STEP_NUMBER } from './workflow/types.js';

/**
 * Zod schema for tool_input in Step tool calls
 */
const ToolInputSchema = z
  .object({
    description: z.string().optional(),
    subagent_type: z.string().optional(),
    prompt: z.string().optional(),
    skill: z.string().optional()
  })
  .optional();

/**
 * Zod schema for HookInput - validates external input at system boundary
 */
export const HookInputSchema = z.object({
  hook_event_name: z.string(),
  cwd: z.string(),

  // PostToolUse
  tool_name: z.string().optional(),
  file_path: z.string().optional(),
  tool_input: ToolInputSchema,

  // SubagentStart/SubagentStop
  agent_id: z.string().optional(),
  agent_name: z.string().optional(),
  subagent_name: z.string().optional(),
  output: z.string().optional(),
  agent_transcript_path: z.string().optional(),

  // UserPromptSubmit
  user_message: z.string().optional(),

  // SlashCommand/Skill
  command: z.string().optional(),
  skill: z.string().optional(),

  // Synthetic event fields
  tool_use_id: z.string().optional(),
  tool_response: z.unknown().optional(),
  step_id: z.string().optional(),
  task_id: z.string().optional(), // Keep for Tool Protocol compatibility during synthetic event detection
  subagent_type: z.string().optional()
});

export type HookInput = z.infer<typeof HookInputSchema>;

/**
 * Result type for parseHookInput
 */
export type ParseResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Parse and validate HookInput from JSON string
 */
export function parseHookInput(json: string): ParseResult<HookInput> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return {
      success: false,
      error: `Invalid JSON input: ${e instanceof Error ? e.message : String(e)}`
    };
  }

  const result = HookInputSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: `Invalid input: ${result.error.issues.map((i) => i.message).join(', ')}`
    };
  }

  return { success: true, data: result.data };
}

/**
 * Session State Schema - Runtime Validation for Persisted State
 */
export const SessionStateSchema = z.object({
  session_id: z.string().default(() => {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  }),
  started_at: z.string().default(() => new Date().toISOString()),
  active_command: z.string().nullable().default(null),
  active_skill: z.string().nullable().default(null),
  edited_files: z.array(z.string()).default([]),
  file_extensions: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export type ValidatedSessionState = z.infer<typeof SessionStateSchema>;

/**
 * Zod schema for StepNumber branded type
 * Uses Zod's native .brand() - schema is source of truth
 */
export const StepNumberSchema = z
  .number()
  .int('Step number must be an integer')
  .positive('Step number must be positive')
  .max(MAX_STEP_NUMBER, 'Step number exceeds maximum')
  .brand<'StepNumber'>();

/**
 * StepNumber type derived from schema
 * This is the canonical definition - types.ts re-exports this
 */
export type StepNumber = z.output<typeof StepNumberSchema>;

/**
 * Zod schema for StepId
 * Validates object structure with branded StepNumber or dynamic '{N}'
 */
export const StepIdSchema = z.object({
  step: z.union([StepNumberSchema, z.literal('{N}')]),
  substep: z.string().optional(),
});

/**
 * StepId type derived from schema
 * Represents a step position: numeric (3, 3.1) or dynamic ({N}.1)
 * Wrapped in Readonly to preserve immutability contract
 */
export type StepId = Readonly<z.output<typeof StepIdSchema>>;

/**
 * Non-recursive action types (everything except RETRY)
 */
export const NonRetryActionSchema = z.union([
  z.object({ type: z.literal('CONTINUE') }),
  z.object({ type: z.literal('DONE') }),
  z.object({ type: z.literal('STOP'), message: z.string().optional() }),
  z.object({ type: z.literal('GOTO'), target: StepIdSchema }),
  z.object({ type: z.literal('NEXT') }),
]);

/**
 * NonRetryAction type derived from schema
 * Wrapped in Readonly to preserve immutability contract
 */
export type NonRetryAction = Readonly<z.output<typeof NonRetryActionSchema>>;

/**
 * Zod schema for Action
 * Validates workflow transition actions (CONTINUE, DONE, STOP, GOTO, NEXT, RETRY)
 */
export const ActionSchema = z.union([
  NonRetryActionSchema,
  z.object({
    type: z.literal('RETRY'),
    max: z.number().int().positive(),
    then: NonRetryActionSchema,
  }),
]);

/**
 * Action type derived from schema
 * Discriminated union for workflow actions
 * Wrapped in Readonly to preserve immutability contract
 */
export type Action = Readonly<z.output<typeof ActionSchema>>;

/**
 * Zod schema for Transitions
 */
export const TransitionsSchema = z.union([
  z.object({
    all: z.literal(true),
    pass: ActionSchema,
    fail: ActionSchema,
  }),
  z.object({
    all: z.literal(false),
    pass: ActionSchema,
    fail: ActionSchema,
  }),
]);

/**
 * Zod schema for Substep
 */
export const SubstepSchema = z.object({
  id: z.string(),
  description: z.string(),
  agentType: z.string().optional(),
  isDynamic: z.boolean(),
  workflows: z.array(z.string()).optional(),
});

/**
 * Zod schema for Step
 */
export const StepSchema = z.object({
  number: StepNumberSchema.optional(),
  isDynamic: z.boolean(),
  description: z.string(),
  command: z.object({ code: z.string() }).optional(),
  prompts: z.array(z.object({ text: z.string() })),
  transitions: TransitionsSchema.optional(),
  substeps: z.array(SubstepSchema).optional(),
  workflows: z.array(z.string()).optional(),
  nestedWorkflow: z.string().optional(), // @deprecated
});

/**
 * Zod schema for Workflow
 */
export const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(StepSchema),
});

/**
 * Schema for pending step.
 */
const PendingStepSchema = z.object({
  stepId: StepIdSchema,
  workflow: z.string().optional()
});

/**
 * Zod schema for SubstepState
 * Tracks runtime state of a substep within a step
 */
const SubstepStateSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'running', 'done']),
  agentId: z.string().optional(),
  result: z.enum(['pass', 'fail']).optional()
});

/**
 * Workflow State Schema - Runtime Validation for Persisted WorkflowState
 */
export const WorkflowStateSchema = z.object({
  id: z.string(),
  workflow: z.string(),
  step: StepNumberSchema,
  substep: z.string().optional(),
  stepName: z.string(),
  retryCount: z.number().nonnegative().int(),
  variables: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
  steps: z.array(z.object({
    id: z.string(),
    status: z.enum(['pending', 'running', 'complete', 'blocked']),
    subagentType: z.string().optional(),
    startedAt: z.string().optional(),
    completedAt: z.string().optional()
  })),
  pendingSteps: z.array(PendingStepSchema).readonly(),
  agentBindings: z.record(z.string(), z.object({
    stepId: StepIdSchema,
    childWorkflowId: z.string().optional(),
    status: z.enum(['running', 'done', 'stopped']),
    result: z.enum(['pass', 'fail']).optional()
  })),
  substepStates: z.array(SubstepStateSchema).optional(),
  agentId: z.string().optional(),
  parentWorkflowId: z.string().optional(),
  parentStepId: StepIdSchema.optional(),
  nested: z.object({
    workflow: z.string(),
    instanceId: z.string()
  }).optional(),
  startedAt: z.string(),
  updatedAt: z.string(),
  snapshot: z.unknown().optional(), // XState snapshot
  prompted: z.boolean().optional(),
  lastResult: z.enum(['pass', 'fail']).optional()
});

export type ValidatedWorkflowState = z.infer<typeof WorkflowStateSchema>;
