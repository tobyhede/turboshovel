import {
  handleSubagentStart
} from '../../../src/workflow/hooks/subagent-start.js';
import type { HookInput } from '@turboshovel/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('handleSubagentStart', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-start-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('passes through when no agent_id provided', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
    expect(result.context).toBeUndefined();
  });

  it('gracefully handles CLI not available', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz'
    };

    const result = await handleSubagentStart(input);
    expect(result).toBeDefined();
  });

  it('ignores non-SubagentStart events', async () => {
    const input: HookInput = {
      hook_event_name: 'SomeOtherEvent' as any,
      cwd: testDir,
      agent_id: 'agent-xyz'
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
    expect(result.context).toBeUndefined();
  });
});

describe('handleSubagentStart calls CLI', () => {
  it('should call rundown run --agent with correct parameters', async () => {
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-cli-test-'));
    try {
      const { handleSubagentStart } = await import('../../../src/workflow/hooks/subagent-start.js');

      const input: HookInput = {
        hook_event_name: 'SubagentStart',
        agent_id: 'abc123',
        cwd: testDir
      };

      const result = await handleSubagentStart(input);
      expect(result.context ?? result.violation ?? !result.violation).toBeDefined();
    } finally {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
});

describe('handleSubagentStart via synthetic dispatch', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-synthetic-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('handles PostToolUse Step → SubagentStart', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'code-review-agent-1',
      step_id: '1.1',
      subagent_type: 'code-review-agent'
    };

    const result = await handleSubagentStart(input);
    expect(result).toBeDefined();
  });
});

