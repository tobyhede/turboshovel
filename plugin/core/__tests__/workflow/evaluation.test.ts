import { evaluateTransitions } from '../../src/workflow/evaluation.js';
import type { Transitions, StepState } from '@turboshovel/shared';

describe('evaluateTransitions', () => {
  const passAction = { type: 'CONTINUE' as const };
  const failAction = { type: 'STOP' as const };

  describe('all: true (PASS ALL + FAIL ANY)', () => {
    const transitions: Transitions = {
      all: true,
      pass: { kind: 'pass', action: passAction },
      fail: { kind: 'fail', action: failAction }
    };

    it('returns pass when all complete', () => {
      const steps = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'complete' }
      ] as StepState[];
      expect(evaluateTransitions(steps, transitions)).toEqual(passAction);
    });

    it('returns fail when any stopped', () => {
      const steps = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'stopped' }
      ] as StepState[];
      expect(evaluateTransitions(steps, transitions)).toEqual(failAction);
    });
  });

  describe('all: false (PASS ANY + FAIL ALL)', () => {
    const transitions: Transitions = {
      all: false,
      pass: { kind: 'pass', action: passAction },
      fail: { kind: 'fail', action: failAction }
    };

    it('returns pass when any complete', () => {
      const steps = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'stopped' }
      ] as StepState[];
      expect(evaluateTransitions(steps, transitions)).toEqual(passAction);
    });

    it('returns fail when all stopped', () => {
      const steps = [
        { id: '1', status: 'stopped' },
        { id: '2', status: 'stopped' }
      ] as StepState[];
      expect(evaluateTransitions(steps, transitions)).toEqual(failAction);
    });
  });

  describe('single task (unified behavior)', () => {
    it('works identically for both modes with single task', () => {
      const pessimistic: Transitions = {
        all: true,
        pass: { kind: 'pass', action: passAction },
        fail: { kind: 'fail', action: failAction }
      };
      const optimistic: Transitions = {
        all: false,
        pass: { kind: 'pass', action: passAction },
        fail: { kind: 'fail', action: failAction }
      };

      const complete = [{ id: '1', status: 'complete' }] as StepState[];
      const stopped = [{ id: '1', status: 'stopped' }] as StepState[];

      // Both modes should produce same result for single task
      expect(evaluateTransitions(complete, pessimistic)).toEqual(passAction);
      expect(evaluateTransitions(complete, optimistic)).toEqual(passAction);
      expect(evaluateTransitions(stopped, pessimistic)).toEqual(failAction);
      expect(evaluateTransitions(stopped, optimistic)).toEqual(failAction);
    });
  });
});
