import { jest, expect, describe, it, beforeEach } from '@jest/globals';
import type { HookInput } from '@turboshovel/shared';

const mockTrackStepDispatch = jest.fn();

jest.unstable_mockModule('../../src/workflow/hooks/step-tracker.js', () => ({
  trackStepDispatch: mockTrackStepDispatch
}));

const { execute } = await import('../../src/gates/workflow-step-tracker.js');

describe('workflow-step-tracker gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty result when no violation', async () => {
    mockTrackStepDispatch.mockResolvedValue({
      stepId: { step: 1 }
    });

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      tool_name: 'Step',
      cwd: '/test'
    };

    const result = await execute(input);

    expect(result).toEqual({});
    expect(mockTrackStepDispatch).toHaveBeenCalledWith(input);
  });

  it('returns block decision when violation occurs', async () => {
    mockTrackStepDispatch.mockResolvedValue({
      violation: 'Step description must start with StepId'
    });

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      tool_name: 'Step',
      cwd: '/test'
    };

    const result = await execute(input);

    expect(result).toEqual({
      decision: 'block',
      reason: 'Step description must start with StepId'
    });
  });
});