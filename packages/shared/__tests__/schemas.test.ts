import { describe, it, expect } from '@jest/globals';
import { parseHookInput, WorkflowStateSchema } from '../src/schemas.js';
import { MAX_STEP_NUMBER } from '../src/workflow/types.js';

/**
 * Creates a valid workflow state object for testing.
 */
const createValidState = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-id',
  workflow: 'test.md',
  step: 1,
  stepName: 'Test Step',
  retryCount: 0,
  variables: {},
  steps: [],
  pendingSteps: [],
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
});

describe('WorkflowStateSchema - StepNumber validation', () => {
  it('accepts valid positive integer step number', () => {
    const result = WorkflowStateSchema.safeParse(createValidState());
    expect(result.success).toBe(true);
  });

  it('rejects zero step number', () => {
    const result = WorkflowStateSchema.safeParse(createValidState({ step: 0 }));
    expect(result.success).toBe(false);
  });

  it('rejects negative step number', () => {
    const result = WorkflowStateSchema.safeParse(createValidState({ step: -1 }));
    expect(result.success).toBe(false);
  });

  it('rejects non-integer step number', () => {
    const result = WorkflowStateSchema.safeParse(createValidState({ step: 1.5 }));
    expect(result.success).toBe(false);
  });

  it('rejects step number exceeding maximum', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ step: MAX_STEP_NUMBER + 1 })
    );
    expect(result.success).toBe(false);
  });
});

describe('WorkflowStateSchema - StepId validation', () => {
  it('accepts valid StepId object', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ pendingSteps: [{ stepId: { step: 1 } }] })
    );
    expect(result.success).toBe(true);
  });

  it('accepts StepId with substep', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ pendingSteps: [{ stepId: { step: 1, substep: '1' } }] })
    );
    expect(result.success).toBe(true);
  });

  it('rejects StepId without step field', () => {
    const result = WorkflowStateSchema.safeParse(
      createValidState({ pendingSteps: [{ substep: '1' }] })
    );
    expect(result.success).toBe(false);
  });
});