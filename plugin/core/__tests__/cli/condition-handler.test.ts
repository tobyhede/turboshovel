import { evaluateFailCondition } from '../../src/cli/condition-handler.js';
import { createTaskNumber, type Task, type Conditions } from '../../src/workflow/types.js';

describe('evaluateFailCondition', () => {
  const makeTask = (conditions?: Conditions): Task => ({
    number: createTaskNumber(1)!,
    description: 'Test Task',
    prompts: [],
    conditions
  });

  describe('RETRY action', () => {
    it('returns retry with incremented count when under max', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'RETRY', max: 3 }
      });

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('retry');
      expect(result.newRetryCount).toBe(1);
    });

    it('returns blocked when retry count exceeds max', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'RETRY', max: 2 }
      });

      const result = evaluateFailCondition(task, 2, 2);

      expect(result.action).toBe('blocked');
      expect(result.message).toContain('Max retries exceeded');
    });
  });

  describe('STOP action', () => {
    it('returns blocked with message', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'STOP', message: 'Fix the tests' }
      });

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('blocked');
      expect(result.message).toBe('Fix the tests');
    });

    it('returns blocked without message', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'STOP' }
      });

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('blocked');
    });
  });

  describe('GOTO action', () => {
    it('returns goto with target task', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'GOTO', task: createTaskNumber(5)! }
      });

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('goto');
      expect(result.gotoTask).toBe(5);
    });
  });

  describe('no conditions', () => {
    it('returns blocked when task has no conditions', () => {
      const task = makeTask(undefined);

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('blocked');
      expect(result.message).toContain('No FAIL condition');
    });
  });
});
