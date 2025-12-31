import { jest, expect, describe, it, beforeEach } from '@jest/globals';
import type { HookInput } from '@turboshovel/shared';

const mockTrackTaskDispatch = jest.fn();

jest.unstable_mockModule('../../src/workflow/hooks/task-tracker.js', () => ({
  trackTaskDispatch: mockTrackTaskDispatch
}));

const { execute } = await import('../../src/gates/workflow-task-tracker.js');

describe('workflow-task-tracker gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty result when no violation', async () => {
    mockTrackTaskDispatch.mockResolvedValue({
      taskId: { task: 1 }
    });

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      cwd: '/test'
    };

    const result = await execute(input);

    expect(result).toEqual({});
    expect(mockTrackTaskDispatch).toHaveBeenCalledWith(input);
  });

  it('returns block decision when violation occurs', async () => {
    mockTrackTaskDispatch.mockResolvedValue({
      violation: 'Task description must start with TaskId'
    });

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      cwd: '/test'
    };

    const result = await execute(input);

    expect(result).toEqual({
      decision: 'block',
      reason: 'Task description must start with TaskId'
    });
  });
});
