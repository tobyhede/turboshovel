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

  describe('getAgentBinding', () => {
    it('returns binding for existing agent', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.bindAgent(state.id, 'agent-xyz', { task: 3 });

      const binding = await manager.getAgentBinding(state.id, 'agent-xyz');

      expect(binding).toEqual({
        taskId: { task: 3 },
        status: 'running',
      });
    });

    it('returns null for non-existent agent', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');

      const binding = await manager.getAgentBinding(state.id, 'unknown-agent');

      expect(binding).toBeNull();
    });

    it('returns null for non-existent workflow', async () => {
      const binding = await manager.getAgentBinding('non-existent', 'agent-x');
      expect(binding).toBeNull();
    });
  });

  describe('updateAgentBinding', () => {
    it('updates status to done with result', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.bindAgent(state.id, 'agent-xyz', { task: 3 });

      await manager.updateAgentBinding(state.id, 'agent-xyz', {
        status: 'done',
        result: 'pass',
      });

      const binding = await manager.getAgentBinding(state.id, 'agent-xyz');
      expect(binding?.status).toBe('done');
      expect(binding?.result).toBe('pass');
    });

    it('preserves taskId when updating', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.bindAgent(state.id, 'agent-xyz', { task: 3, subtask: 'A' });

      await manager.updateAgentBinding(state.id, 'agent-xyz', { status: 'done' });

      const binding = await manager.getAgentBinding(state.id, 'agent-xyz');
      expect(binding?.taskId).toEqual({ task: 3, subtask: 'A' });
    });

    it('throws for non-existent agent', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');

      await expect(
        manager.updateAgentBinding(state.id, 'unknown', { status: 'done' })
      ).rejects.toThrow('No binding for agent unknown');
    });
  });

  describe('stash', () => {
    it('moves active workflow to stashed and clears active', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.setActive(state.id);

      const stashedId = await manager.stash();

      expect(stashedId).toBe(state.id);

      // Active should be null
      const active = await manager.getActive();
      expect(active).toBeNull();
    });

    it('returns null when no active workflow', async () => {
      await manager.setActive(null);

      const stashedId = await manager.stash();

      expect(stashedId).toBeNull();
    });

    it('preserves workflow state when stashed', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.setActive(state.id);
      await manager.pushPendingTask(state.id, { task: 3 });

      await manager.stash();

      // Workflow still exists with its state
      const loaded = await manager.load(state.id);
      expect(loaded?.pendingTasks).toEqual([{ task: 3 }]);
    });
  });

  describe('pop', () => {
    it('restores stashed workflow to active', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.setActive(state.id);
      await manager.stash();

      const restored = await manager.pop();

      expect(restored?.id).toBe(state.id);

      // Should be active again
      const active = await manager.getActive();
      expect(active?.id).toBe(state.id);
    });

    it('returns null when nothing stashed', async () => {
      const restored = await manager.pop();
      expect(restored).toBeNull();
    });

    it('clears stashedWorkflowId after pop', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.setActive(state.id);
      await manager.stash();

      await manager.pop();

      // Trying to pop again should return null
      const secondPop = await manager.pop();
      expect(secondPop).toBeNull();
    });

    it('returns null if stashed workflow was deleted', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.setActive(state.id);
      await manager.stash();

      // Delete the workflow
      await manager.delete(state.id);

      const restored = await manager.pop();
      expect(restored).toBeNull();
    });
  });

  describe('getStashedWorkflowId', () => {
    it('returns stashed ID when workflow is stashed', async () => {
      const state = await manager.create('test.workflow.md', 'Test Task');
      await manager.setActive(state.id);
      await manager.stash();

      const stashedId = await manager.getStashedWorkflowId();

      expect(stashedId).toBe(state.id);
    });

    it('returns null when nothing stashed', async () => {
      const stashedId = await manager.getStashedWorkflowId();
      expect(stashedId).toBeNull();
    });
  });
});
