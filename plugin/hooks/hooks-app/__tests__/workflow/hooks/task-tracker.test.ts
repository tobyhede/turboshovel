// __tests__/workflow/hooks/task-tracker.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { trackTaskDispatch } from '../../../src/workflow/hooks/task-tracker';
import { WorkflowStateManager } from '../../../src/workflow/state';
import type { HookInput } from '../../../src/types';

describe('Task Tracker Hook', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `task-tracker-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('registers task when Task tool used', async () => {
    // Setup active workflow
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
    };

    await trackTaskDispatch(input);

    // Verify task was added
    const updated = await manager.getActive();
    expect(updated?.tasks).toHaveLength(1);
    expect(updated?.tasks[0].status).toBe('running');
    expect(updated?.tasks[0].id).toMatch(/^task-/);
  });

  test('does nothing when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
    };

    // Should not throw
    await trackTaskDispatch(input);
  });

  test('does nothing for non-Task tools', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Edit',
    };

    await trackTaskDispatch(input);

    const updated = await manager.getActive();
    expect(updated?.tasks).toHaveLength(0);
  });
});
