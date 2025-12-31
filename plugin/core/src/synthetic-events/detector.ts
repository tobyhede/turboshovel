import type { HookInput } from '@turboshovel/shared';
import type { SyntheticEvent } from './types.js';

/**
 * Detect synthetic events from Claude Code primitive events.
 *
 * IMPORTANT: Namespaces are preserved (cipherpowers:verify, not verify)
 */
export function detectSyntheticEvents(input: HookInput): SyntheticEvent[] {
  const events: SyntheticEvent[] = [];
  const hookEvent = input.hook_event_name;
  const toolName = input.tool_name;

  // UserPromptSubmit → SlashCommandStart
  if (hookEvent === 'UserPromptSubmit' && input.user_message) {
    const cmdMatch = input.user_message.match(/^\/(\S+)/);
    if (cmdMatch) {
      events.push({
        originalEvent: 'UserPromptSubmit',
        syntheticEvent: 'SlashCommandStart',
        commandName: cmdMatch[1]  // Preserves namespace if present
      });
    }
  }

  // Stop → SlashCommandEnd
  // Dispatcher checks active_command before acting
  if (hookEvent === 'Stop') {
    events.push({
      originalEvent: 'Stop',
      syntheticEvent: 'SlashCommandEnd'
    });
  }

  // PreToolUse Skill → SkillStart
  if (hookEvent === 'PreToolUse' && toolName === 'Skill') {
    const skillName = input.tool_input?.skill as string | undefined;
    events.push({
      originalEvent: 'PreToolUse',
      syntheticEvent: 'SkillStart',
      skillName  // Full name with namespace
    });
  }

  // PostToolUse Skill → SkillEnd
  if (hookEvent === 'PostToolUse' && toolName === 'Skill') {
    const skillName = input.tool_input?.skill as string | undefined;
    events.push({
      originalEvent: 'PostToolUse',
      syntheticEvent: 'SkillEnd',
      skillName
    });
  }

  // PostToolUse Task → SubagentStart
  if (hookEvent === 'PostToolUse' && toolName === 'Task') {
    const description = input.tool_input?.description as string | undefined;
    const subagentType = input.tool_input?.subagent_type as string | undefined;
    const toolUseId = (input as HookInput & { tool_use_id?: string }).tool_use_id;

    // Parse TaskId: "1.1 - Description" → "1.1"
    const taskIdMatch = description?.match(/^(\d+(?:\.\d+)?)\s*[-–—]/);

    events.push({
      originalEvent: 'PostToolUse',
      syntheticEvent: 'SubagentStart',
      taskId: taskIdMatch?.[1],
      toolUseId,
      subagentType
    });
  }

  return events;
}
