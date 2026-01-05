import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { WorkflowStateManager } from '../../src/workflow/state.js';
import { type Step, type StepNumber, type Workflow } from '../../src/workflow/types.js';

describe('WorkflowStateManager', () => {
  let testDir: string;
  let manager: WorkflowStateManager;
  const mockSteps: Step[] = [{
    number: 1 as StepNumber,
    description: 'Initial step',
    isDynamic: false,
    prompts: []
  }];
  const mockWorkflow: Workflow = {
    title: 'Test Workflow',
    description: 'A test',
    steps: mockSteps
  };

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'ws-test-'));
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getChildWorkflowResult', () => {
    it('should return pass when child has completed=true', async () => {
      const child = await manager.create('child.workflow.md', mockWorkflow);
      await manager.update(child.id, { variables: { completed: true } });

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBe('pass');
    });

    it('should return fail when child has blocked=true', async () => {
      const child = await manager.create('child.workflow.md', mockWorkflow);
      await manager.update(child.id, { variables: { blocked: true } });

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBe('fail');
    });

    it('should return null when child is still active', async () => {
      const child = await manager.create('child.workflow.md', mockWorkflow);
      await manager.setActive(child.id);

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBeNull();
    });

    it('should return pass when child state deleted', async () => {
      const result = await manager.getChildWorkflowResult('nonexistent-id');
      expect(result).toBe('pass');
    });

    it('should return null when child is stashed', async () => {
      const child = await manager.create('child.workflow.md', mockWorkflow);
      await manager.setActive(child.id);
      await manager.stash();

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBeNull();
    });
  });

  describe('WorkflowStateManager substep initialization', () => {
    it('initializes substepStates when step has static substeps', async () => {
      const substeps = [
        { id: '1', description: 'First reviewer', isDynamic: false, prompts: [] },
        { id: '2', description: 'Second reviewer', isDynamic: false, prompts: [] }
      ];

      const state = await manager.create('test.workflow.md', mockWorkflow);
      await manager.initializeSubsteps(state.id, substeps);

      const updated = await manager.load(state.id);
      expect(updated?.substepStates).toHaveLength(2);
      expect(updated?.substepStates?.[0]).toEqual({
        id: '1',
        status: 'pending',
        agentId: undefined,
        result: undefined
      });
    });

    it('does not initialize for dynamic substeps', async () => {
      const substeps = [
        { id: '{n}', description: 'Dynamic step', isDynamic: true, prompts: [] }
      ];

      const state = await manager.create('test.workflow.md', mockWorkflow);
      await manager.initializeSubsteps(state.id, substeps);

      const updated = await manager.load(state.id);
      expect(updated?.substepStates).toEqual([]);
    });
  });

  describe('WorkflowStateManager dynamic substeps', () => {
    it('adds dynamic substep with incrementing ID', async () => {
      const state = await manager.create('test.workflow.md', mockWorkflow);
      await manager.update(state.id, { substepStates: [] });

      const id1 = await manager.addDynamicSubstep(state.id);
      expect(id1).toBe('1');

      const id2 = await manager.addDynamicSubstep(state.id);
      expect(id2).toBe('2');

      const updated = await manager.load(state.id);
      expect(updated?.substepStates).toHaveLength(2);
      expect(updated?.substepStates?.[0].id).toBe('1');
      expect(updated?.substepStates?.[1].id).toBe('2');
    });
  });

  describe('WorkflowStateManager substep lifecycle', () => {
    it('binds agent to substep', async () => {
      const state = await manager.create('test.workflow.md', mockWorkflow);
      await manager.update(state.id, {
        substepStates: [{ id: '1', status: 'pending' }]
      });

      await manager.bindSubstepAgent(state.id, '1', 'agent-123');

      const updated = await manager.load(state.id);
      expect(updated?.substepStates?.[0]).toEqual({
        id: '1',
        status: 'running',
        agentId: 'agent-123',
        result: undefined
      });
    });

    it('completes substep with result', async () => {
      const state = await manager.create('test.workflow.md', mockWorkflow);
      await manager.update(state.id, {
        substepStates: [{ id: '1', status: 'running', agentId: 'agent-123' }]
      });

      await manager.completeSubstep(state.id, '1', 'pass');

      const updated = await manager.load(state.id);
      expect(updated?.substepStates?.[0]).toEqual({
        id: '1',
        status: 'done',
        agentId: 'agent-123',
        result: 'pass'
      });
    });
  });

  describe('updateFromActor flattened states', () => {
    it('extracts substep ID from flattened machine state (step_N_M)', async () => {
      const state = await manager.create('test.md', mockWorkflow);
      const actor = {
        getPersistedSnapshot: () => ({
          value: 'step_1_2',
          context: { variables: {}, retryCount: 0, substep: '2' }
        })
      };
      
      const updated = await manager.updateFromActor(state.id, actor as any, mockSteps);
      expect(updated.step).toBe(1);
      expect(updated.substep).toBe('2');
    });

    it('extracts step number from simple machine state (step_N)', async () => {
      const state = await manager.create('test.md', mockWorkflow);
      const actor = {
        getPersistedSnapshot: () => ({
          value: 'step_3',
          context: { variables: {}, retryCount: 0 }
        })
      };
      
      const steps = [
        ...mockSteps,
        { number: 2 as StepNumber, description: 'S2', isDynamic: false, prompts: [] },
        { number: 3 as StepNumber, description: 'S3', isDynamic: false, prompts: [] }
      ];

      const updated = await manager.updateFromActor(state.id, actor as any, steps);
      expect(updated.step).toBe(3);
      expect(updated.substep).toBeUndefined();
    });
  });

  describe('create with prompted flag', () => {
    it('defaults to auto mode (prompted undefined)', async () => {
      const state = await manager.create('test.md', mockWorkflow);
      expect(state.prompted).toBeUndefined();
    });

    it('accepts prompted option', async () => {
      const state = await manager.create('test.md', mockWorkflow, { prompted: true });
      expect(state.prompted).toBe(true);
    });
  });
});
