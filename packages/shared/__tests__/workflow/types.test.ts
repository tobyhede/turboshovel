import { type SubtaskState } from '../../src/workflow/types';
import type { Action } from '../../src/workflow/types';

describe('SubtaskState type', () => {
  it('has required fields', () => {
    const subtaskState: SubtaskState = {
      id: '1',
      status: 'pending',
      agentId: undefined,
      result: undefined
    };

    expect(subtaskState.id).toBe('1');
    expect(subtaskState.status).toBe('pending');
  });
});

describe('Action type', () => {
  it('RETRY action should have max and then properties', () => {
    const retryAction: Action = {
      type: 'RETRY',
      max: 3,
      then: { type: 'STOP', message: 'Build failed' }
    };

    expect(retryAction.type).toBe('RETRY');
    if (retryAction.type === 'RETRY') {
      expect(retryAction.max).toBe(3);
      expect(retryAction.then).toEqual({ type: 'STOP', message: 'Build failed' });
    }
  });

  it('RETRY then can be GOTO', () => {
    const retryAction: Action = {
      type: 'RETRY',
      max: 2,
      then: { type: 'GOTO', task: 5 as any }
    };

    if (retryAction.type === 'RETRY') {
      expect(retryAction.then.type).toBe('GOTO');
    }
  });

  it('RETRY then can be CONTINUE', () => {
    const retryAction: Action = {
      type: 'RETRY',
      max: 1,
      then: { type: 'CONTINUE' }
    };

    if (retryAction.type === 'RETRY') {
      expect(retryAction.then.type).toBe('CONTINUE');
    }
  });
});
