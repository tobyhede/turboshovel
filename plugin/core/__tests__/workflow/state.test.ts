// __tests__/workflow/state.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { WorkflowStateManager, createStepNumber, type StepId, type Step, type StepNumber } from '@turboshovel/shared';

describe('WorkflowStateManager', () => {
  let testDir: string;
  let manager: WorkflowStateManager;
  const mockSteps: Step[] = [{
    number: 1 as StepNumber,
    description: 'Initial step',
    prompts: []
  }];

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-state-test-${String(Date.now())}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('create', () => {
    test('creates new workflow state with generated ID', async () => {
      const state = await manager.create('execute.workflow.md', mockSteps);

      expect(state.id).toMatch(/^wf-\d{4}-\d{2}-\d{2}-/);
      expect(state.workflow).toBe('execute.workflow.md');
      expect(state.step).toBe(1);
      expect(state.stepName).toBe('Initial step');
      expect(state.retryCount).toBe(0);
      expect(state.variables).toEqual({});
      expect(state.steps).toEqual([]);
    });

    test('persists state to file', async () => {
      const state = await manager.create('test.workflow.md', mockSteps);

      const statePath = join(testDir, '.claude/turboshovel/workflows', `${state.id}.json`);
      const fileContent = await fs.readFile(statePath, 'utf8');
      const parsed = JSON.parse(fileContent);

      expect(parsed.workflow).toBe('test.workflow.md');
    });
  });

  describe('create orchestration fields', () => {
    it('initializes pendingSteps as empty array', async () => {
      const state = await manager.create('test.workflow.md', mockSteps);
      expect(state.pendingSteps).toEqual([]);
    });

    it('initializes agentBindings as empty object', async () => {
      const state = await manager.create('test.workflow.md', mockSteps);
      expect(state.agentBindings).toEqual({});
    });
  });

  describe('load', () => {
    test('loads existing workflow state by ID', async () => {
      const created = await manager.create('test.workflow.md', mockSteps);
      const loaded = await manager.load(created.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(created.id);
      expect(loaded?.workflow).toBe('test.workflow.md');
    });
  });

  describe('getActive', () => {
    test('returns active workflow from session', async () => {
      const created = await manager.create('test.workflow.md', mockSteps);
      await manager.setActive(created.id);

      const active = await manager.getActive();
      expect(active?.id).toBe(created.id);
    });
  });

  describe('update', () => {
    test('updates workflow state fields', async () => {
      const created = await manager.create('test.workflow.md', mockSteps);

      const updated = await manager.update(created.id, {
        step: createStepNumber(2)!,
        stepName: 'Step 2',
        retryCount: 1
      });

      expect(updated.step).toBe(2);
      expect(updated.stepName).toBe('Step 2');
      expect(updated.retryCount).toBe(1);
    });
  });

  describe('pushPendingStep', () => {
    it('should push step with workflow to pending queue', async () => {
      const state = await manager.create('test.workflow.md', mockSteps);

      await manager.pushPendingStep(state.id, {
        stepId: { step: createStepNumber(1)!, substep: '1' },
        workflow: 'child.workflow.md'
      });

      const updated = await manager.load(state.id);
      expect(updated?.pendingSteps).toHaveLength(1);
      expect(updated?.pendingSteps[0].stepId).toEqual({ step: createStepNumber(1)!, substep: '1' });
      expect(updated?.pendingSteps[0].workflow).toBe('child.workflow.md');
    });
  });

  describe('bindAgent', () => {
    it('creates agent binding with running status', async () => {
      const state = await manager.create('test.workflow.md', mockSteps);
      const stepId: StepId = { step: createStepNumber(3)!, substep: '1' };

      await manager.bindAgent(state.id, 'agent-xyz', stepId);

      const updated = await manager.load(state.id);
      expect(updated?.agentBindings['agent-xyz']).toEqual({
        stepId: { step: createStepNumber(3)!, substep: '1' },
        status: 'running'
      });
    });
  });

  describe('stash', () => {
    it('moves active workflow to stashed and clears active', async () => {
      const state = await manager.create('test.workflow.md', mockSteps);
      await manager.setActive(state.id);

      const stashedId = await manager.stash();

      expect(stashedId).toBe(state.id);

      const active = await manager.getActive();
      expect(active).toBeNull();
    });
  });

  describe('pop', () => {
    it('restores stashed workflow to active', async () => {
      const state = await manager.create('test.workflow.md', mockSteps);
      await manager.setActive(state.id);
      await manager.stash();

      const restored = await manager.pop();

      expect(restored?.id).toBe(state.id);

      const active = await manager.getActive();
      expect(active?.id).toBe(state.id);
    });
  });
});