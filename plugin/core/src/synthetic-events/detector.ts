import type { HookInput } from '@turboshovel/shared';
import type { SyntheticEvent } from './types.js';

/**
 * Detect synthetic events from Claude Code primitive events.
 *
 * IMPORTANT: Namespaces are preserved (cipherpowers:verify, not verify)
 *
 * TaskId Format:
 * - Must start with one or more digits (e.g., "1", "12")
 * - May have optional decimal subtask (e.g., "1.1", "1.2", "12.3")
 * - Must be followed by a dash separator (-, –, or —)
 * - Examples: "1 - Task", "1.1 - Subtask", "12.3 – Description"
 * - Invalid: ".1 - Task" (no leading digit), "a.1 - Task" (not numeric)
 */
export function detectSyntheticEvents(input: HookInput): SyntheticEvent[] {
  const events: SyntheticEvent[] = [];
  const hookEvent = input.hook_event_name;
  const toolName = input.tool_name;

  // UserPromptSubmit → SlashCommandStart
  if (hookEvent === 'UserPromptSubmit' && input.user_message) {
    const cmdMatch = /^\/(\S+)/.exec(input.user_message);
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
    const skillName = input.tool_input?.skill;
    events.push({
      originalEvent: 'PreToolUse',
      syntheticEvent: 'SkillStart',
      skillName  // Full name with namespace
    });
  }

  // PostToolUse Skill → SkillEnd
  if (hookEvent === 'PostToolUse' && toolName === 'Skill') {
    const skillName = input.tool_input?.skill;
    events.push({
      originalEvent: 'PostToolUse',
      syntheticEvent: 'SkillEnd',
      skillName
    });
  }

  // PostToolUse Task → SubagentStart
  if (hookEvent === 'PostToolUse' && toolName === 'Task') {
    const description = input.tool_input?.description;
    const subagentType = input.tool_input?.subagent_type;
    const toolUseId = input.tool_use_id;

    // Parse TaskId: "1.1 - Description" → "1.1"
    const taskIdMatch = description ? /^(\d+(?:\.\d+)?)\s*[-–—]/.exec(description) : null;

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
