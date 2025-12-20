// __tests__/workflow/hooks/subagent-stop.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { handleSubagentStop } from '../../../src/workflow/hooks/subagent-stop';
import { WorkflowStateManager } from '../../../src/workflow/state';
import type { HookInput } from '../../../src/types';

describe('SubagentStop Hook', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `subagent-stop-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('marks running task as complete on STATUS: OK', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.update(state.id, {
      tasks: [{ id: 'task-1', status: 'running', startedAt: new Date().toISOString() }],
    });
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      output: 'Task complete.\n\nSTATUS: OK',
    };

    const result = await handleSubagentStop(input);

    const updated = await manager.getActive();
    expect(updated?.tasks[0].status).toBe('complete');
    expect(result).toContain('complete');
  });

  test('marks running task as blocked on STATUS: BLOCKED', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.update(state.id, {
      tasks: [{ id: 'task-1', status: 'running', startedAt: new Date().toISOString() }],
    });
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      output: 'Cannot proceed.\n\nSTATUS: BLOCKED',
    };

    const result = await handleSubagentStop(input);

    const updated = await manager.getActive();
    expect(updated?.tasks[0].status).toBe('blocked');
    expect(updated?.variables.has_blocked_task).toBe(true);
    expect(result).toContain('BLOCKED');
  });

  test('returns guidance when all batch tasks done', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.update(state.id, {
      tasks: [
        { id: 'task-1', status: 'complete' },
        { id: 'task-2', status: 'running', startedAt: new Date().toISOString() },
      ],
    });
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      output: 'Done.\n\nSTATUS: OK',
    };

    const result = await handleSubagentStop(input);

    expect(result).toContain('workflow next');
  });
});
