import {
  handleSubagentStart,
  type SubagentStartResult
} from '../../../src/workflow/hooks/subagent-start';
import { WorkflowStateManager } from '../../../src/workflow/state';
import type { HookInput } from '../../../src/types';
import { createTaskNumber } from '../../../src/workflow/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('handleSubagentStart', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-start-test-'));
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('pops pending task and binds agent', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(3)!, subtask: 'A' });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz-123'
    };

    const result = await handleSubagentStart(input);

    expect(result.context).toContain('AGENT_ID: agent-xyz-123');
    expect(result.context).toContain('TASK_ID: 3.A');

    const updated = await manager.getActive();
    expect(updated?.pendingTasks).toHaveLength(0);
    expect(updated?.agentBindings['agent-xyz-123']).toBeDefined();
  });

  it('returns violation when no pending task', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    // No pending tasks

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz'
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toContain('no pending task');
  });

  it('passes through when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz'
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
    expect(result.context).toBeUndefined();
  });

  it('passes through when no agent_id provided', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir
      // No agent_id
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
  });

  it('passes through when workflow is stashed', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.stash();

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz'
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
  });
});
