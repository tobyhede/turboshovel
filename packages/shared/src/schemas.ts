import { z } from 'zod';
import { MAX_TASK_NUMBER, type TaskNumber, type TaskId } from './workflow/types.js';

/**
 * Zod schema for tool_input in Task tool calls
 */
const ToolInputSchema = z
  .object({
    description: z.string().optional(),
    subagent_type: z.string().optional(),
    prompt: z.string().optional()
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
  skill: z.string().optional()
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
 *
 * API Contract:
 * - All fields have defaults for backward compatibility
 * - File not found: Silent initialization (expected on first run)
 * - Parse/validation error: Log warning, reinitialize
 * - metadata uses Record<string, unknown> - callers must narrow types
 * - stashedWorkflowId NOT included - workflow-specific, lives in WorkflowStateManager
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
 * Zod schema for TaskNumber branded type
 * Validates and transforms plain number to branded TaskNumber
 */
const TaskNumberSchema = z
  .number()
  .int('Task number must be an integer')
  .positive('Task number must be positive')
  .max(MAX_TASK_NUMBER, 'Task number exceeds maximum')
  .transform((n): TaskNumber => n as TaskNumber);

/**
 * Zod schema for TaskId branded type
 * Validates object structure and transforms to branded TaskId
 */
const TaskIdSchema = z
  .object({
    task: TaskNumberSchema,
    subtask: z.string().optional(),
  })
  .transform((obj): TaskId => obj as TaskId);

/**
 * Schema for pending task with backward compatibility.
 * Accepts:
 * - New format: { taskId: TaskId, workflow?: string }
 * - Legacy format: TaskId (transforms to { taskId, workflow: undefined })
 */
const PendingTaskSchema = z.union([
  // New format (preferred)
  z.object({
    taskId: TaskIdSchema,
    workflow: z.string().optional()
  }),
  // Legacy format - transforms on parse
  TaskIdSchema.transform(taskId => ({ taskId, workflow: undefined }))
]);

/**
 * Workflow State Schema - Runtime Validation for Persisted WorkflowState
 *
 * Validates the structure of workflow state files to ensure data integrity
 * when loading from disk. Uses safeParse() for non-fatal validation errors.
 */
export const WorkflowStateSchema = z.object({
  id: z.string(),
  workflow: z.string(),
  task: TaskNumberSchema,
  taskName: z.string(),
  retryCount: z.number().nonnegative().int(),
  retryMax: z.number().nonnegative().int(),
  variables: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
  tasks: z.array(z.object({
    id: z.string(),
    status: z.enum(['pending', 'running', 'complete', 'blocked']),
    subagentType: z.string().optional(),
    startedAt: z.string().optional(),
    completedAt: z.string().optional()
  })),
  pendingTasks: z.array(PendingTaskSchema).readonly(),
  agentBindings: z.record(z.string(), z.object({
    taskId: TaskIdSchema,
    childWorkflowId: z.string().optional(),
    status: z.enum(['running', 'done', 'stopped']),
    result: z.enum(['pass', 'fail']).optional()
  })),
  agentId: z.string().optional(),
  parentWorkflowId: z.string().optional(),
  parentTaskId: TaskIdSchema.optional(),
  nested: z.object({
    workflow: z.string(),
    instanceId: z.string()
  }).optional(),
  startedAt: z.string(),
  updatedAt: z.string()
});

export type ValidatedWorkflowState = z.infer<typeof WorkflowStateSchema>;
