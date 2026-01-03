import { evaluateTransitions } from '../../src/workflow/evaluation.js';
import type { Transitions, StepState } from '@turboshovel/shared';

describe('evaluateTransitions', () => {
  const passAction = { type: 'CONTINUE' as const };
  const failAction = { type: 'STOP' as const };

  describe('all: true (PASS ALL + FAIL ANY)', () => {
    const transitions: Transitions = { all: true, pass: passAction, fail: failAction };

    it('returns pass when all complete', () => {
      const steps = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'complete' }
      ] as StepState[];
      expect(evaluateTransitions(steps, transitions)).toEqual(passAction);
    });

    it('returns fail when any blocked', () => {
      const steps = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'blocked' }
      ] as StepState[];
      expect(evaluateTransitions(steps, transitions)).toEqual(failAction);
    });
  });

  describe('all: false (PASS ANY + FAIL ALL)', () => {
    const transitions: Transitions = { all: false, pass: passAction, fail: failAction };

    it('returns pass when any complete', () => {
      const steps = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'blocked' }
      ] as StepState[];
      expect(evaluateTransitions(steps, transitions)).toEqual(passAction);
    });

    it('returns fail when all blocked', () => {
      const steps = [
        { id: '1', status: 'blocked' },
        { id: '2', status: 'blocked' }
      ] as StepState[];
      expect(evaluateTransitions(steps, transitions)).toEqual(failAction);
    });
  });

  describe('single task (unified behavior)', () => {
    it('works identically for both modes with single task', () => {
      const pessimistic: Transitions = { all: true, pass: passAction, fail: failAction };
      const optimistic: Transitions = { all: false, pass: passAction, fail: failAction };

      const complete = [{ id: '1', status: 'complete' }] as StepState[];
      const blocked = [{ id: '1', status: 'blocked' }] as StepState[];

      // Both modes should produce same result for single task
      expect(evaluateTransitions(complete, pessimistic)).toEqual(passAction);
      expect(evaluateTransitions(complete, optimistic)).toEqual(passAction);
      expect(evaluateTransitions(blocked, pessimistic)).toEqual(failAction);
      expect(evaluateTransitions(blocked, optimistic)).toEqual(failAction);
    });
  });
});
