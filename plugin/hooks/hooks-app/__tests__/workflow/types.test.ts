// __tests__/workflow/types.test.ts
import { createTaskNumber, type TaskNumber, type Action, type AgentBinding } from '../../src/workflow/types';

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

describe('AgentBinding type', () => {
  it('accepts valid running binding', () => {
    const binding: AgentBinding = {
      taskId: { task: 3, subtask: 'A' },
      status: 'running',
    };
    expect(binding.status).toBe('running');
  });

  it('accepts binding with result', () => {
    const binding: AgentBinding = {
      taskId: { task: 2 },
      status: 'done',
      result: 'pass',
    };
    expect(binding.result).toBe('pass');
  });

  it('accepts binding with child workflow', () => {
    const binding: AgentBinding = {
      taskId: { task: 1 },
      status: 'running',
      childWorkflowId: 'wf-2025-01-01-abc123',
    };
    expect(binding.childWorkflowId).toBeDefined();
  });
});
