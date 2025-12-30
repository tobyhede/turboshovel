import { jest } from '@jest/globals';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { WorkflowStateManager, type HookInput, createTaskNumber } from '@turboshovel/shared';

describe('trackTaskDispatch with TaskId', () => {
  let testDir: string;
  let manager: WorkflowStateManager;
  let trackTaskDispatch: typeof import('../../../src/workflow/hooks/task-tracker').trackTaskDispatch;

  beforeEach(async () => {
    jest.resetModules();
    const module = await import('../../../src/workflow/hooks/task-tracker');
    trackTaskDispatch = module.trackTaskDispatch;

    testDir = join(tmpdir(), `task-tracker-test-${String(Date.now())}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    jest.resetModules();
  });

  it('parses TaskId from description and pushes to queue', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: {
        description: '3.1 - Review code changes',
        subagent_type: 'code-review-agent'
      }
    };

    const result = await trackTaskDispatch(input);

    expect(result.taskId).toEqual({ task: createTaskNumber(3)!, subtask: '1' });

    const updated = await manager.getActive();
    expect(updated?.pendingTasks).toContainEqual({ taskId: { task: createTaskNumber(3)!, subtask: '1' } });
  });

  it('returns violation for missing TaskId prefix in enforcement mode', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: {
        description: 'Review the code without task prefix'
      }
    };

    const result = await trackTaskDispatch(input);

    expect(result.violation).toContain('must start with TaskId');
  });

  it('passes through when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: { description: 'Any description' }
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
      tool_input: { description: 'No prefix needed when stashed' }
    };

    const result = await trackTaskDispatch(input);

    expect(result.violation).toBeUndefined();
  });
});

describe('trackTaskDispatch CLI integration', () => {
  let trackTaskDispatch: typeof import('../../../src/workflow/hooks/task-tracker').trackTaskDispatch;
  let testDir: string;

  beforeEach(async () => {
    jest.resetModules();
    const module = await import('../../../src/workflow/hooks/task-tracker');
    trackTaskDispatch = module.trackTaskDispatch;

    testDir = join(tmpdir(), `task-tracker-cli-test-${String(Date.now())}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    jest.resetModules();
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  it('should parse TaskId and return result (uses CLI internally)', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_input: { description: '1.1 - Review code' },
      cwd: testDir
    };

    const result = await trackTaskDispatch(input);

    // Result should have taskId even if CLI call fails (caught internally)
    expect(result.taskId).toEqual({ task: createTaskNumber(1)!, subtask: '1' });
  });
});
