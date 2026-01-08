import { describe, it, expect } from '@jest/globals';
import { parseHookInput } from '../src/schemas.js';

describe('parseHookInput', () => {
  it('parses valid PostToolUse input', () => {
    const input = JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd: '/project',
      tool_name: 'Edit',
      file_path: '/project/src/file.ts'
    });

    const result = parseHookInput(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hook_event_name).toBe('PostToolUse');
      expect(result.data.tool_name).toBe('Edit');
    }
  });

  it('parses valid UserPromptSubmit input', () => {
    const input = JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      cwd: '/project',
      user_message: 'fix the bug'
    });

    const result = parseHookInput(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user_message).toBe('fix the bug');
    }
  });

  it('parses valid SubagentStop input', () => {
    const input = JSON.stringify({
      hook_event_name: 'SubagentStop',
      cwd: '/project',
      agent_id: 'agent-123',
      agent_name: 'test-agent',
      output: 'Task completed'
    });

    const result = parseHookInput(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agent_id).toBe('agent-123');
      expect(result.data.output).toBe('Task completed');
    }
  });

  it('returns error for invalid JSON', () => {
    const result = parseHookInput('not json');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('returns error for missing required fields', () => {
    const input = JSON.stringify({
      tool_name: 'Edit'
      // missing hook_event_name and cwd
    });

    const result = parseHookInput(input);

    expect(result.success).toBe(false);
  });
});
