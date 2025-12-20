// __tests__/workflow/types.test.ts
import { createStepNumber, type StepNumber, type Action, type Step } from '../../src/workflow/types';

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

  test('GOTO action with step number', () => {
    const action: Action = { type: 'GOTO', step: 3 as StepNumber };
    expect(action.type).toBe('GOTO');
    if (action.type === 'GOTO') {
      expect(action.step).toBe(3);
    }
  });
});
