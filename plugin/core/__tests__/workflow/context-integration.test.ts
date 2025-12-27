// __tests__/workflow/context-integration.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { WorkflowStateManager } from '../../src/workflow/state.js';
import { getWorkflowContext } from '../../src/workflow/context.js';

describe('Workflow Context Injection', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-context-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('returns null when no active workflow', async () => {
    const context = await getWorkflowContext(testDir);
    expect(context).toBeNull();
  });

  test('returns context for active workflow', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Run tests');
    await manager.setActive(state.id);

    const context = await getWorkflowContext(testDir);

    expect(context).not.toBeNull();
    expect(context).toContain('Active Workflow');
    expect(context).toContain('test.workflow.md');
    expect(context).toContain('Task 1');
    expect(context).toContain('Run tests');
  });

  test('includes BLOCKED warning when blocked', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Run tests');
    await manager.update(state.id, {
      variables: { has_blocked_task: true }
    });
    await manager.setActive(state.id);

    const context = await getWorkflowContext(testDir);

    expect(context).toContain('BLOCKED');
  });

  test('includes task progress', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.update(state.id, {
      tasks: [
        { id: 'task-1', status: 'complete' },
        { id: 'task-2', status: 'running' },
        { id: 'task-3', status: 'pending' }
      ]
    });
    await manager.setActive(state.id);

    const context = await getWorkflowContext(testDir);

    expect(context).toContain('1/3 complete');
  });
});
