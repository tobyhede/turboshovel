import { jest, expect, describe, it, beforeEach } from '@jest/globals';
import type { HookInput } from '@turboshovel/shared';

const mockHandleSubagentStop = jest.fn();

jest.unstable_mockModule('../../src/workflow/hooks/subagent-stop.js', () => ({
  handleSubagentStop: mockHandleSubagentStop
}));

const { execute } = await import('../../src/gates/workflow-subagent-stop.js');

describe('workflow-subagent-stop gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty result when no context or violation', async () => {
    mockHandleSubagentStop.mockResolvedValue({});

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: '/test',
      agent_id: 'agent-123'
    };

    const result = await execute(input);

    expect(result).toEqual({});
  });

  it('returns additionalContext when context provided', async () => {
    mockHandleSubagentStop.mockResolvedValue({
      context: 'Agent agent-123 complete.'
    });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: '/test',
      agent_id: 'agent-123'
    };

    const result = await execute(input);

    expect(result).toEqual({
      additionalContext: 'Agent agent-123 complete.'
    });
  });

  it('returns block decision when violation occurs', async () => {
    mockHandleSubagentStop.mockResolvedValue({
      violation: 'SubagentStop for unknown agent: agent-xyz'
    });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: '/test',
      agent_id: 'agent-xyz'
    };

    const result = await execute(input);

    expect(result).toEqual({
      decision: 'block',
      reason: 'SubagentStop for unknown agent: agent-xyz'
    });
  });
});
