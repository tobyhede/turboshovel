// __tests__/workflow/hooks/subagent-stop.test.ts
import {
  handleSubagentStop
} from '../../../src/workflow/hooks/subagent-stop.js';
import { WorkflowStateManager, type HookInput, createTaskNumber } from '@turboshovel/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('handleSubagentStop with agent binding', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-stop-test-'));
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('looks up agent by agent_id and updates binding', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(2)! });
    await manager.bindAgent(state.id, 'agent-xyz', { task: createTaskNumber(2)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-xyz',
      output: 'STATUS: OK'
    };

    const result = await handleSubagentStop(input);

    expect(result.context).toContain('complete');

    const updated = await manager.getActive();
    const binding = updated?.agentBindings['agent-xyz'];
    expect(binding?.status).toBe('done');
    expect(binding?.result).toBe('pass');
  });

  it('marks as fail when STATUS: BLOCKED', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.bindAgent(state.id, 'agent-abc', { task: createTaskNumber(1)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-abc',
      output: 'STATUS: BLOCKED\nCould not complete task.'
    };

    const result = await handleSubagentStop(input);

    expect(result.context).toContain('FAILED');

    const binding = await manager.getAgentBinding(state.id, 'agent-abc');
    expect(binding?.result).toBe('fail');
  });

  it('returns violation for unknown agent', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'unknown-agent'
    };

    const result = await handleSubagentStop(input);

    expect(result.violation).toContain('unknown agent');
  });

  it('defaults to pass when no STATUS in output', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.bindAgent(state.id, 'agent-xyz', { task: createTaskNumber(1)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-xyz',
      output: 'Task completed successfully.'
    };

    await handleSubagentStop(input);

    const binding = await manager.getAgentBinding(state.id, 'agent-xyz');
    expect(binding?.result).toBe('pass');
  });
});
