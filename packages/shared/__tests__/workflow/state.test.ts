import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdir, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { WorkflowStateManager } from '../../src/workflow/state.js';

describe('WorkflowStateManager', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'ws-test-'));
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getChildWorkflowResult', () => {
    it('should return pass when child has completed=true', async () => {
      const child = await manager.create('child.workflow.md', 'Child');
      await manager.update(child.id, { variables: { completed: true } });

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBe('pass');
    });

    it('should return fail when child has blocked=true', async () => {
      const child = await manager.create('child.workflow.md', 'Child');
      await manager.update(child.id, { variables: { blocked: true } });

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBe('fail');
    });

    it('should return null when child is still active', async () => {
      const child = await manager.create('child.workflow.md', 'Child');
      await manager.setActive(child.id);

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBeNull();
    });

    it('should return pass when child state deleted', async () => {
      // Child doesn't exist = already cleaned up = pass
      const result = await manager.getChildWorkflowResult('nonexistent-id');
      expect(result).toBe('pass');
    });

    it('should return null when child is stashed', async () => {
      const child = await manager.create('child.workflow.md', 'Child');
      await manager.setActive(child.id);
      await manager.stash();

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBeNull();
    });
  });

  describe('WorkflowStateManager subtask initialization', () => {
    it('initializes subtaskStates when task has static subtasks', async () => {
      const manager = new WorkflowStateManager(testDir);

      // Subtask definitions from parsed workflow
      const subtasks = [
        { id: '1', description: 'First reviewer', isDynamic: false },
        { id: '2', description: 'Second reviewer', isDynamic: false }
      ];

      const state = await manager.create('test.workflow.md', 'Dispatch reviewers');
      await manager.initializeSubtasks(state.id, subtasks);

      const updated = await manager.load(state.id);
      expect(updated?.subtaskStates).toHaveLength(2);
      expect(updated?.subtaskStates?.[0]).toEqual({
        id: '1',
        status: 'pending',
        agentId: undefined,
        result: undefined
      });
    });

    it('does not initialize for dynamic subtasks', async () => {
      const manager = new WorkflowStateManager(testDir);

      const subtasks = [
        { id: '{n}', description: 'Dynamic task', isDynamic: true }
      ];

      const state = await manager.create('test.workflow.md', 'Dynamic task');
      await manager.initializeSubtasks(state.id, subtasks);

      const updated = await manager.load(state.id);
      // Dynamic subtasks are not pre-initialized - they're created on demand
      expect(updated?.subtaskStates).toEqual([]);
    });
  });

  describe('WorkflowStateManager dynamic subtasks', () => {
    it('adds dynamic subtask with incrementing ID', async () => {
      const manager = new WorkflowStateManager(testDir);

      const state = await manager.create('test.workflow.md', 'Execute batch');
      await manager.update(state.id, { subtaskStates: [] });

      // Add first dynamic subtask
      const id1 = await manager.addDynamicSubtask(state.id);
      expect(id1).toBe('1');

      // Add second
      const id2 = await manager.addDynamicSubtask(state.id);
      expect(id2).toBe('2');

      const updated = await manager.load(state.id);
      expect(updated?.subtaskStates).toHaveLength(2);
      expect(updated?.subtaskStates?.[0].id).toBe('1');
      expect(updated?.subtaskStates?.[1].id).toBe('2');
    });
  });

  describe('WorkflowStateManager subtask lifecycle', () => {
    it('binds agent to subtask', async () => {
      const manager = new WorkflowStateManager(testDir);

      const state = await manager.create('test.workflow.md', 'Task');
      await manager.update(state.id, {
        subtaskStates: [{ id: '1', status: 'pending' }]
      });

      await manager.bindSubtaskAgent(state.id, '1', 'agent-123');

      const updated = await manager.load(state.id);
      expect(updated?.subtaskStates?.[0]).toEqual({
        id: '1',
        status: 'running',
        agentId: 'agent-123',
        result: undefined
      });
    });

    it('completes subtask with result', async () => {
      const manager = new WorkflowStateManager(testDir);

      const state = await manager.create('test.workflow.md', 'Task');
      await manager.update(state.id, {
        subtaskStates: [{ id: '1', status: 'running', agentId: 'agent-123' }]
      });

      await manager.completeSubtask(state.id, '1', 'pass');

      const updated = await manager.load(state.id);
      expect(updated?.subtaskStates?.[0]).toEqual({
        id: '1',
        status: 'done',
        agentId: 'agent-123',
        result: 'pass'
      });
    });
  });
});
