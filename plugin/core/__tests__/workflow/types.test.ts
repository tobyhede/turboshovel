// __tests__/workflow/types.test.ts
import {
  createStepNumber,
  incrementStepNumber,
  decrementStepNumber,
  type StepNumber,
  type Action,
  type Substep,
  type Step,
  type WorkflowState,
  type Conditions,
  MAX_STEP_NUMBER
} from '@turboshovel/shared';

describe('StepNumber', () => {
  test('createStepNumber with valid number returns StepNumber', () => {
    const result = createStepNumber(1);
    expect(result).not.toBeNull();
    expect(result).toBe(1);
  });

  test('createStepNumber with zero returns null', () => {
    const result = createStepNumber(0);
    expect(result).toBeNull();
  });

  test('createStepNumber with negative returns null', () => {
    const result = createStepNumber(-1);
    expect(result).toBeNull();
  });

  test('createStepNumber with non-integer returns null', () => {
    const result = createStepNumber(1.5);
    expect(result).toBeNull();
  });

  test('createStepNumber at MAX_STEP_NUMBER boundary succeeds', () => {
    expect(createStepNumber(MAX_STEP_NUMBER)).not.toBeNull();
    expect(createStepNumber(MAX_STEP_NUMBER - 1)).not.toBeNull();
  });

  test('createStepNumber above MAX_STEP_NUMBER boundary fails', () => {
    expect(createStepNumber(MAX_STEP_NUMBER + 1)).toBeNull();
  });
});

describe('Action discriminated union', () => {
  test('CONTINUE action has correct type', () => {
    const action: Action = { type: 'CONTINUE' };
    expect(action.type).toBe('CONTINUE');
  });

  test('STOP action without message', () => {
    const action: Action = { type: 'STOP' };
    expect(action.type).toBe('STOP');
    expect('message' in action).toBe(false);
  });

  test('STOP action with message', () => {
    const action: Action = { type: 'STOP', message: 'fix tests' };
    expect(action.type).toBe('STOP');
    expect(action.message).toBe('fix tests');
  });

  test('GOTO action with step number', () => {
    const action: Action = { type: 'GOTO', target: { step: 3 as StepNumber } };
    expect(action.type).toBe('GOTO');
    expect(action.target.step).toBe(3);
  });
});

describe('WorkflowState orchestration fields', () => {
  it('includes pendingSteps array', () => {
    const state: WorkflowState = {
      id: 'wf-test',
      workflow: 'test.runbook.md',
      step: createStepNumber(1)!,
      stepName: 'Test',
      retryCount: 0,
      variables: {},
      steps: [],
      pendingSteps: [{ stepId: { step: createStepNumber(1)! } }, { stepId: { step: createStepNumber(2)!, substep: '1' } }],
      agentBindings: {},
      startedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z'
    };
    expect(state.pendingSteps).toHaveLength(2);
  });

  it('includes agentBindings map', () => {
    const state: WorkflowState = {
      id: 'wf-test',
      workflow: 'test.runbook.md',
      step: createStepNumber(1)!,
      stepName: 'Test',
      retryCount: 0,
      variables: {},
      steps: [],
      pendingSteps: [],
      agentBindings: {
        'agent-abc': { stepId: { step: createStepNumber(1)! }, status: 'running' }
      },
      startedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z'
    };
    expect(state.agentBindings['agent-abc']).toBeDefined();
  });

  it('includes optional parent workflow fields', () => {
    const state: WorkflowState = {
      id: 'wf-child',
      workflow: 'child.runbook.md',
      step: createStepNumber(1)!,
      stepName: 'Child Step',
      retryCount: 0,
      variables: {},
      steps: [],
      pendingSteps: [],
      agentBindings: {},
      agentId: 'agent-xyz',
      parentWorkflowId: 'wf-parent',
      parentStepId: { step: createStepNumber(2)!, substep: '2' },
      startedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z'
    };
    expect(state.parentWorkflowId).toBe('wf-parent');
  });
});

describe('Substep type', () => {
  it('accepts static substep', () => {
    const substep: Substep = {
      id: '1',
      description: 'First reviewer',
      isDynamic: false
    };
    expect(substep.isDynamic).toBe(false);
  });

  it('accepts substep with agent type', () => {
    const substep: Substep = {
      id: '2',
      description: 'Second reviewer',
      agentType: 'code-review-agent',
      isDynamic: false
    };
    expect(substep.agentType).toBe('code-review-agent');
  });

  it('accepts dynamic substep template', () => {
    const substep: Substep = {
      id: '{n}',
      description: 'Execute step',
      isDynamic: true
    };
    expect(substep.isDynamic).toBe(true);
  });
});

describe('Step with substeps', () => {
  it('accepts step with substeps array', () => {
    const step: Step = {
      number: createStepNumber(1)!,
      isDynamic: false,
      description: 'Dispatch reviewers',
      prompts: [],
      substeps: [
        { id: '1', description: 'First', isDynamic: false },
        { id: '2', description: 'Second', isDynamic: false }
      ]
    };
    expect(step.substeps).toHaveLength(2);
  });
});

describe('Conditions discriminated union', () => {
  it('accepts PASS ALL + FAIL ANY (all: true)', () => {
    const conditions: Conditions = {
      all: true,
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP' }
    };
    expect(conditions.all).toBe(true);
  });

  it('accepts PASS ANY + FAIL ALL (all: false)', () => {
    const conditions: Conditions = {
      all: false,
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP', message: 'All failed' }
    };
    expect(conditions.all).toBe(false);
  });
});

describe('incrementStepNumber', () => {
  it('increments valid StepNumber', () => {
    const sn = createStepNumber(3)!;
    const result = incrementStepNumber(sn);
    expect(result).toBe(4);
  });
});

describe('decrementStepNumber', () => {
  it('decrements valid StepNumber', () => {
    const sn = createStepNumber(3)!;
    const result = decrementStepNumber(sn);
    expect(result).toBe(2);
  });
});

describe('Step interface', () => {
  it('supports isDynamic property for dynamic steps', () => {
    const dynamicStep: Step = {
      isDynamic: true,
      description: 'Process item',
      prompts: []
    };
    expect(dynamicStep.isDynamic).toBe(true);
    expect(dynamicStep.number).toBeUndefined();
  });

  it('supports static steps with number', () => {
    const staticStep: Step = {
      number: 1 as StepNumber,
      isDynamic: false,
      description: 'Setup',
      prompts: []
    };
    expect(staticStep.isDynamic).toBe(false);
    expect(staticStep.number).toBe(1);
  });
});