import { evaluateConditions } from '../../src/workflow/evaluation.js';
import type { Conditions, TaskState } from '@turboshovel/shared';

describe('evaluateConditions', () => {
  const passAction = { type: 'CONTINUE' as const };
  const failAction = { type: 'STOP' as const };

  describe('all: true (PASS ALL + FAIL ANY)', () => {
    const conditions: Conditions = { all: true, pass: passAction, fail: failAction };

    it('returns pass when all complete', () => {
      const tasks = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'complete' }
      ] as TaskState[];
      expect(evaluateConditions(tasks, conditions)).toEqual(passAction);
    });

    it('returns fail when any blocked', () => {
      const tasks = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'blocked' }
      ] as TaskState[];
      expect(evaluateConditions(tasks, conditions)).toEqual(failAction);
    });
  });

  describe('all: false (PASS ANY + FAIL ALL)', () => {
    const conditions: Conditions = { all: false, pass: passAction, fail: failAction };

    it('returns pass when any complete', () => {
      const tasks = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'blocked' }
      ] as TaskState[];
      expect(evaluateConditions(tasks, conditions)).toEqual(passAction);
    });

    it('returns fail when all blocked', () => {
      const tasks = [
        { id: '1', status: 'blocked' },
        { id: '2', status: 'blocked' }
      ] as TaskState[];
      expect(evaluateConditions(tasks, conditions)).toEqual(failAction);
    });
  });

  describe('single task (unified behavior)', () => {
    it('works identically for both modes with single task', () => {
      const pessimistic: Conditions = { all: true, pass: passAction, fail: failAction };
      const optimistic: Conditions = { all: false, pass: passAction, fail: failAction };

      const complete = [{ id: '1', status: 'complete' }] as TaskState[];
      const blocked = [{ id: '1', status: 'blocked' }] as TaskState[];

      // Both modes should produce same result for single task
      expect(evaluateConditions(complete, pessimistic)).toEqual(passAction);
      expect(evaluateConditions(complete, optimistic)).toEqual(passAction);
      expect(evaluateConditions(blocked, pessimistic)).toEqual(failAction);
      expect(evaluateConditions(blocked, optimistic)).toEqual(failAction);
    });
  });
});
