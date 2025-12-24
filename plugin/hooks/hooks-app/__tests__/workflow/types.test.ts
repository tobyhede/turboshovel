// __tests__/workflow/types.test.ts
import { createTaskNumber, type TaskNumber, type Action, type Subtask, type Task, type WorkflowState, type Conditions } from '../../src/workflow/types';

describe('TaskNumber', () => {
  test('createTaskNumber with valid number returns TaskNumber', () => {
    const result = createTaskNumber(1);
    expect(result).not.toBeNull();
    expect(result).toBe(1);
  });

  test('createTaskNumber with zero returns null', () => {
    const result = createTaskNumber(0);
    expect(result).toBeNull();
  });

  test('createTaskNumber with negative returns null', () => {
    const result = createTaskNumber(-1);
    expect(result).toBeNull();
  });

  test('createTaskNumber with non-integer returns null', () => {
    const result = createTaskNumber(1.5);
    expect(result).toBeNull();
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
    if (action.type === 'STOP') {
      expect(action.message).toBe('fix tests');
    }
  });

  test('GOTO action with task number', () => {
    const action: Action = { type: 'GOTO', task: 3 as TaskNumber };
    expect(action.type).toBe('GOTO');
    if (action.type === 'GOTO') {
      expect(action.task).toBe(3);
    }
  });
});

describe('WorkflowState orchestration fields', () => {
  it('includes pendingTasks array', () => {
    const state: WorkflowState = {
      id: 'wf-test',
      workflow: 'test.workflow.md',
      task: createTaskNumber(1)!,
      taskName: 'Test',
      retryCount: 0,
      retryMax: 3,
      variables: {},
      tasks: [],
      pendingTasks: [{ task: 1 }, { task: 2, subtask: 'A' }],
      agentBindings: {},
      startedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(state.pendingTasks).toHaveLength(2);
  });

  it('includes agentBindings map', () => {
    const state: WorkflowState = {
      id: 'wf-test',
      workflow: 'test.workflow.md',
      task: createTaskNumber(1)!,
      taskName: 'Test',
      retryCount: 0,
      retryMax: 3,
      variables: {},
      tasks: [],
      pendingTasks: [],
      agentBindings: {
        'agent-abc': { taskId: { task: 1 }, status: 'running' },
      },
      startedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(state.agentBindings['agent-abc']).toBeDefined();
  });

  it('includes optional parent workflow fields', () => {
    const state: WorkflowState = {
      id: 'wf-child',
      workflow: 'child.workflow.md',
      task: createTaskNumber(1)!,
      taskName: 'Child Task',
      retryCount: 0,
      retryMax: 3,
      variables: {},
      tasks: [],
      pendingTasks: [],
      agentBindings: {},
      agentId: 'agent-xyz',
      parentWorkflowId: 'wf-parent',
      parentTaskId: { task: 2, subtask: 'B' },
      startedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(state.parentWorkflowId).toBe('wf-parent');
  });
});

describe('Subtask type', () => {
  it('accepts static subtask', () => {
    const subtask: Subtask = {
      id: 'A',
      description: 'First reviewer',
      isDynamic: false,
    };
    expect(subtask.isDynamic).toBe(false);
  });

  it('accepts subtask with agent type', () => {
    const subtask: Subtask = {
      id: 'B',
      description: 'Second reviewer',
      agentType: 'code-review-agent',
      isDynamic: false,
    };
    expect(subtask.agentType).toBe('code-review-agent');
  });

  it('accepts dynamic subtask template', () => {
    const subtask: Subtask = {
      id: '{n}',
      description: 'Execute task',
      isDynamic: true,
    };
    expect(subtask.isDynamic).toBe(true);
  });
});

describe('Task with subtasks', () => {
  it('accepts task with subtasks array', () => {
    const task: Task = {
      number: createTaskNumber(1)!,
      description: 'Dispatch reviewers',
      prompts: [],
      subtasks: [
        { id: 'A', description: 'First', isDynamic: false },
        { id: 'B', description: 'Second', isDynamic: false },
      ],
    };
    expect(task.subtasks).toHaveLength(2);
  });
});

describe('Conditions discriminated union', () => {
  it('accepts PASS ALL + FAIL ANY (all: true)', () => {
    const conditions: Conditions = {
      all: true,
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP' },
    };
    expect(conditions.all).toBe(true);
  });

  it('accepts PASS ANY + FAIL ALL (all: false)', () => {
    const conditions: Conditions = {
      all: false,
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP', message: 'All failed' },
    };
    expect(conditions.all).toBe(false);
  });

  it('works with exhaustive switch', () => {
    const conditions: Conditions = { all: true, pass: { type: 'CONTINUE' }, fail: { type: 'STOP' } };

    // TypeScript exhaustiveness check
    function checkAll(c: Conditions): string {
      switch (c.all) {
        case true: return 'pessimistic';
        case false: return 'optimistic';
      }
    }

    expect(checkAll(conditions)).toBe('pessimistic');
  });
});
