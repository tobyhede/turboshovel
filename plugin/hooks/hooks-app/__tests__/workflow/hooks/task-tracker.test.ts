import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { trackTaskDispatch, type TaskDispatchResult } from '../../../src/workflow/hooks/task-tracker';
import { WorkflowStateManager } from '../../../src/workflow/state';
import type { HookInput } from '../../../src/types';

describe('trackTaskDispatch with TaskId', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = join(tmpdir(), `task-tracker-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('parses TaskId from description and pushes to queue', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: {
        description: '3.A - Review code changes',
        subagent_type: 'code-review-agent',
      },
    };

    const result = await trackTaskDispatch(input);

    expect(result.taskId).toEqual({ task: 3, subtask: 'A' });

    const updated = await manager.getActive();
    expect(updated?.pendingTasks).toContainEqual({ task: 3, subtask: 'A' });
  });

  it('returns violation for missing TaskId prefix in enforcement mode', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: {
        description: 'Review the code without task prefix',
      },
    };

    const result = await trackTaskDispatch(input);

    expect(result.violation).toContain('must start with TaskId');
  });

  it('passes through when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: { description: 'Any description' },
    };

    const result = await trackTaskDispatch(input);

    expect(result.taskId).toBeUndefined();
    expect(result.violation).toBeUndefined();
  });

  it('passes through when workflow is stashed', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.stash();

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: { description: 'No prefix needed when stashed' },
    };

    const result = await trackTaskDispatch(input);

    expect(result.violation).toBeUndefined();
  });
});
