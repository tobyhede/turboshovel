import { z } from 'zod';

/**
 * Zod schema for tool_input in Task tool calls
 */
const ToolInputSchema = z.object({
  description: z.string().optional(),
  subagent_type: z.string().optional(),
  prompt: z.string().optional(),
}).optional();

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
});

export type HookInput = z.infer<typeof HookInputSchema>;

/**
 * Result type for parseHookInput
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

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
      error: `Invalid JSON input: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const result = HookInputSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: `Invalid input: ${result.error.issues.map(i => i.message).join(', ')}`,
    };
  }

  return { success: true, data: result.data };
}
