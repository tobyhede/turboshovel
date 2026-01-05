import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WorkflowStateManager, createStepNumber, type Step, type StepNumber } from '@turboshovel/shared';

describe('substep workflow integration', () => {
  let testDir: string;
  let manager: WorkflowStateManager;
  const mockSteps: Step[] = [{
    number: 1 as StepNumber,
    description: 'Parallel review',
    prompts: []
  }];

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'substep-'));
    await fs.mkdir(path.join(testDir, '.claude'), { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('executes full substep lifecycle: start → dispatch → bind → complete → aggregate', async () => {
    const stepNum = createStepNumber(1);
    const state = await manager.create('review.workflow.md', { steps: mockSteps });
    await manager.pushWorkflow(state.id);
    await manager.initializeSubsteps(state.id, [
      { id: '1', description: 'First reviewer', isDynamic: false },
      { id: '2', description: 'Second reviewer', isDynamic: false }
    ]);

    let current = await manager.load(state.id);
    expect(current?.substepStates).toHaveLength(2);
    expect(current?.substepStates?.[0].status).toBe('pending');
    expect(current?.substepStates?.[1].status).toBe('pending');

    await manager.pushPendingStep(state.id, { stepId: { step: stepNum!, substep: '1' } });
    await manager.pushPendingStep(state.id, { stepId: { step: stepNum!, substep: '2' } });

    await manager.bindSubstepAgent(state.id, '1', 'agent-1');
    await manager.bindSubstepAgent(state.id, '2', 'agent-2');

    current = await manager.load(state.id);
    expect(current?.substepStates?.[0].status).toBe('running');
    expect(current?.substepStates?.[0].agentId).toBe('agent-1');
    expect(current?.substepStates?.[1].status).toBe('running');
    expect(current?.substepStates?.[1].agentId).toBe('agent-2');

    await manager.completeSubstep(state.id, '1', 'pass');
    await manager.completeSubstep(state.id, '2', 'pass');

    current = await manager.load(state.id);
    expect(current?.substepStates?.[0].status).toBe('done');
    expect(current?.substepStates?.[0].result).toBe('pass');
    expect(current?.substepStates?.[1].status).toBe('done');
    expect(current?.substepStates?.[1].result).toBe('pass');
  });

  it('handles FAIL ANY aggregation correctly', async () => {
    const state = await manager.create('test.workflow.md', { steps: mockSteps });
    await manager.pushWorkflow(state.id);
    await manager.initializeSubsteps(state.id, [
      { id: '1', description: 'First', isDynamic: false },
      { id: '2', description: 'Second', isDynamic: false }
    ]);

    await manager.bindSubstepAgent(state.id, '1', 'agent-1');
    await manager.bindSubstepAgent(state.id, '2', 'agent-2');
    await manager.completeSubstep(state.id, '1', 'pass');
    await manager.completeSubstep(state.id, '2', 'fail');

    const current = await manager.load(state.id);
    const failedSubstep = current?.substepStates?.find((s) => s.result === 'fail');
    expect(failedSubstep).toBeDefined();
    expect(failedSubstep?.id).toBe('2');
  });
});