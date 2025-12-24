import { HookInputSchema, parseHookInput } from '../src/schemas';

describe('HookInputSchema', () => {
  it('parses valid minimal input', () => {
    const input = {
      hook_event_name: 'PostToolUse',
      cwd: '/Users/test/project',
    };
    const result = HookInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('parses input with optional fields', () => {
    const input = {
      hook_event_name: 'PostToolUse',
      cwd: '/Users/test/project',
      tool_name: 'Edit',
      file_path: '/Users/test/project/src/index.ts',
    };
    const result = HookInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tool_name).toBe('Edit');
    }
  });

  it('rejects input missing required fields', () => {
    const input = { hook_event_name: 'PostToolUse' };
    const result = HookInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects null', () => {
    const result = HookInputSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});

describe('parseHookInput', () => {
  it('returns parsed input on success', () => {
    const json = '{"hook_event_name":"PostToolUse","cwd":"/test"}';
    const result = parseHookInput(json);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hook_event_name).toBe('PostToolUse');
    }
  });

  it('returns error for invalid JSON', () => {
    const result = parseHookInput('not json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('returns error for invalid schema', () => {
    const result = parseHookInput('{"foo":"bar"}');
    expect(result.success).toBe(false);
  });
});
