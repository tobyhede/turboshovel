// __tests__/workflow/state.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { WorkflowStateManager } from '../../src/workflow/state';
import { createTaskNumber } from '../../src/workflow/types';
import type { TaskId } from '../../src/workflow/task-id';

describe('WorkflowStateManager', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-state-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('create', () => {
    test('creates new workflow state with generated ID', async () => {
      const state = await manager.create('execute.workflow.md', 'Execute batch');

      expect(state.id).toMatch(/^wf-\d{4}-\d{2}-\d{2}-/);
      expect(state.workflow).toBe('execute.workflow.md');
      expect(state.task).toBe(1);
      expect(state.taskName).toBe('Execute batch');
      expect(state.retryCount).toBe(0);
      expect(state.variables).toEqual({});
      expect(state.tasks).toEqual([]);
    });

    test('persists state to file', async () => {
      const state = await manager.create('test.workflow.md', 'Test task');

      const statePath = join(testDir, '.claude/turboshovel/workflows', `${state.id}.json`);
      const fileContent = await fs.readFile(statePath, 'utf8');
      const parsed = JSON.parse(fileContent);

      expect(parsed.workflow).toBe('test.workflow.md');
    });

    test('state directory matches expected path (.claude/turboshovel/workflows)', async () => {
      const state = await manager.create('test.workflow.md', 'Test task');
      const expectedDir = join(testDir, '.claude/turboshovel/workflows');
      const files = await fs.readdir(expectedDir);
      expect(files).toContain(`${state.id}.json`);
    });
  });

  describe('create orchestration fields', () => {
    it('initializes pendingTasks as empty array', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      expect(state.pendingTasks).toEqual([]);
    });

    it('initializes agentBindings as empty object', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      expect(state.agentBindings).toEqual({});
    });
  });

  describe('load', () => {
    test('loads existing workflow state by ID', async () => {
      const created = await manager.create('test.workflow.md', 'Test task');
      const loaded = await manager.load(created.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(created.id);
      expect(loaded?.workflow).toBe('test.workflow.md');
    });

    test('returns null for non-existent ID', async () => {
      const loaded = await manager.load('non-existent-id');
      expect(loaded).toBeNull();
    });
  });

  describe('getActive', () => {
    test('returns active workflow from session', async () => {
      const created = await manager.create('test.workflow.md', 'Test task');
      await manager.setActive(created.id);

      const active = await manager.getActive();
      expect(active?.id).toBe(created.id);
    });

    test('returns null when no active workflow', async () => {
      const active = await manager.getActive();
      expect(active).toBeNull();
    });
  });

  describe('update', () => {
    test('updates workflow state fields', async () => {
      const created = await manager.create('test.workflow.md', 'Task 1');

      const updated = await manager.update(created.id, {
        task: createTaskNumber(2)!,
        taskName: 'Task 2',
        retryCount: 1,
      });

      expect(updated.task).toBe(2);
      expect(updated.taskName).toBe('Task 2');
      expect(updated.retryCount).toBe(1);
    });

    test('updates variables', async () => {
      const created = await manager.create('test.workflow.md', 'Task 1');

      const updated = await manager.update(created.id, {
        variables: { more_batches: true, completed_batches: 1 },
      });

      expect(updated.variables.more_batches).toBe(true);
      expect(updated.variables.completed_batches).toBe(1);
    });
  });

  describe('delete', () => {
    test('removes workflow state file', async () => {
      const created = await manager.create('test.workflow.md', 'Test task');
      await manager.delete(created.id);

      const loaded = await manager.load(created.id);
      expect(loaded).toBeNull();
    });
  });

  describe('WorkflowStateManager.pushPendingTask', () => {
    it('adds task to empty pending queue', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      const taskId: TaskId = { task: 3, subtask: 'A' };

      await manager.pushPendingTask(state.id, taskId);

      const updated = await manager.load(state.id);
      expect(updated?.pendingTasks).toEqual([{ task: 3, subtask: 'A' }]);
    });

    it('appends to existing pending queue (FIFO)', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');

      await manager.pushPendingTask(state.id, { task: 1 });
      await manager.pushPendingTask(state.id, { task: 2 });
      await manager.pushPendingTask(state.id, { task: 3, subtask: 'A' });

      const updated = await manager.load(state.id);
      expect(updated?.pendingTasks).toEqual([
        { task: 1 },
        { task: 2 },
        { task: 3, subtask: 'A' },
      ]);
    });

    it('throws for non-existent workflow', async () => {
      await expect(
        manager.pushPendingTask('non-existent', { task: 1 })
      ).rejects.toThrow('Workflow non-existent not found');
    });
  });

  describe('popPendingTask', () => {
    it('returns null for empty queue', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');

      const popped = await manager.popPendingTask(state.id);

      expect(popped).toBeNull();
    });

    it('returns and removes first task (FIFO)', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.pushPendingTask(state.id, { task: 1 });
      await manager.pushPendingTask(state.id, { task: 2 });

      const first = await manager.popPendingTask(state.id);
      expect(first).toEqual({ task: 1 });

      const updated = await manager.load(state.id);
      expect(updated?.pendingTasks).toEqual([{ task: 2 }]);
    });

    it('returns null for non-existent workflow', async () => {
      const result = await manager.popPendingTask('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('bindAgent', () => {
    it('creates agent binding with running status', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      const taskId: TaskId = { task: 3, subtask: 'A' };

      await manager.bindAgent(state.id, 'agent-xyz', taskId);

      const updated = await manager.load(state.id);
      expect(updated?.agentBindings['agent-xyz']).toEqual({
        taskId: { task: 3, subtask: 'A' },
        status: 'running',
      });
    });

    it('allows multiple agent bindings', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');

      await manager.bindAgent(state.id, 'agent-1', { task: 1 });
      await manager.bindAgent(state.id, 'agent-2', { task: 2 });

      const updated = await manager.load(state.id);
      expect(Object.keys(updated?.agentBindings || {})).toHaveLength(2);
    });

    it('throws for non-existent workflow', async () => {
      await expect(
        manager.bindAgent('non-existent', 'agent-x', { task: 1 })
      ).rejects.toThrow('Workflow non-existent not found');
    });
  });
});
