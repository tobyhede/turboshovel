import { describe, it, expect } from '@jest/globals';
import { parseHookInput, WorkflowStateSchema } from '../src/schemas.js';
import { MAX_TASK_NUMBER } from '../src/workflow/types.js';

/**
 * Creates a valid workflow state object for testing.
 * Use overrides parameter to customize specific fields.
 */
const createValidState = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-id',
  workflow: 'test.md',
  task: 1,
  taskName: 'Test Task',
  retryCount: 0,
  retryMax: 3,
  variables: {},
  tasks: [],
  pendingTasks: [],
  agentBindings: {},
  startedAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides
});

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

  it('returns error for invalid JSON', () => {
    const result = parseHookInput('not valid json');

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
    if (!result.success) {
      expect(result.error).toContain('Invalid input');
    }
  });
});

describe('WorkflowStateSchema - TaskNumber validation', () => {
  it('accepts valid positive integer task number', () => {
    const result = WorkflowStateSchema.safeParse(createValidState());
    expect(result.success).toBe(true);
  });

  it('rejects zero task number', () => {
    const result = WorkflowStateSchema.safeParse(createValidState({ task: 0 }));
    expect(result.success).toBe(false);
  });

  it('rejects negative task number', () => {
    const result = WorkflowStateSchema.safeParse(createValidState({ task: -1 }));
    expect(result.success).toBe(false);
  });

  it('rejects non-integer task number', () => {
    const result = WorkflowStateSchema.safeParse(createValidState({ task: 1.5 }));
    expect(result.success).toBe(false);
  });

  it('rejects task number exceeding maximum', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ task: MAX_TASK_NUMBER + 1 })
    );
    expect(result.success).toBe(false);
  });
});

describe('WorkflowStateSchema - TaskId validation', () => {
  it('accepts valid TaskId object', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ pendingTasks: [{ task: 1 }] })
    );
    expect(result.success).toBe(true);
  });

  it('accepts TaskId with subtask', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ pendingTasks: [{ task: 1, subtask: 'a' }] })
    );
    expect(result.success).toBe(true);
  });

  it('rejects TaskId as plain string', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ pendingTasks: ['1'] })
    );
    expect(result.success).toBe(false);
  });

  it('rejects TaskId without task field', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ pendingTasks: [{ subtask: 'a' }] })
    );
    expect(result.success).toBe(false);
  });

  it('rejects TaskId with invalid task number', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ pendingTasks: [{ task: 0 }] })
    );
    expect(result.success).toBe(false);
  });
});
