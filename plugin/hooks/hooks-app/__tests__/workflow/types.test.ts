// __tests__/workflow/types.test.ts
import { createTaskNumber, type TaskNumber, type Action, type WorkflowState } from '../../src/workflow/types';

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
