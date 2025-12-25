import fc from 'fast-check';
import {
  createTaskNumber,
  incrementTaskNumber,
  decrementTaskNumber
} from '../../src/workflow/types';
import { taskIdToString, parseTaskIdFromString } from '../../src/workflow/task-id';

describe('TaskId Property Tests', () => {
  // Generator for valid task numbers (1-999999)
  const taskNumberArb = fc.integer({ min: 1, max: 999999 });

  // Generator for valid subtask numbers (1-99 as strings)
  const subtaskArb = fc.integer({ min: 1, max: 99 }).map(n => n.toString());

  describe('createTaskNumber bounds', () => {
    it('accepts all integers 1 to 999999', () => {
      fc.assert(
        fc.property(taskNumberArb, (n) => {
          const result = createTaskNumber(n);
          expect(result).not.toBeNull();
          expect(result).toBe(n);
        }),
        { numRuns: 500 }
      );
    });

    it('rejects integers <= 0', () => {
      fc.assert(
        fc.property(fc.integer({ max: 0 }), (n) => {
          const result = createTaskNumber(n);
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('rejects integers > 999999', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1000000 }), (n) => {
          const result = createTaskNumber(n);
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('taskId roundtrip', () => {
    it('serializes and parses back to same taskId (task only)', () => {
      fc.assert(
        fc.property(taskNumberArb, (n) => {
          const taskNum = createTaskNumber(n)!;
          const taskId = { task: taskNum };
          const str = taskIdToString(taskId);
          const parsed = parseTaskIdFromString(str, { requireSeparator: false });

          expect(parsed).not.toBeNull();
          expect(parsed!.task).toBe(taskNum);
          expect(parsed!.subtask).toBeUndefined();
        }),
        { numRuns: 200 }
      );
    });

    it('serializes and parses back to same taskId (with subtask)', () => {
      fc.assert(
        fc.property(taskNumberArb, subtaskArb, (n, subtask) => {
          const taskNum = createTaskNumber(n)!;
          const taskId = { task: taskNum, subtask };
          const str = taskIdToString(taskId);
          const parsed = parseTaskIdFromString(str, { requireSeparator: false });

          expect(parsed).not.toBeNull();
          expect(parsed!.task).toBe(taskNum);
          expect(parsed!.subtask).toBe(subtask);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('increment/decrement properties', () => {
    it('increment then decrement returns original (except at bounds)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 999998 }), (n) => {
          const taskNum = createTaskNumber(n)!;
          const incremented = incrementTaskNumber(taskNum);
          expect(incremented).not.toBeNull();

          const decremented = decrementTaskNumber(incremented!);
          expect(decremented).toBe(taskNum);
        }),
        { numRuns: 200 }
      );
    });

    it('decrement then increment returns original (except at bounds)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 999999 }), (n) => {
          const taskNum = createTaskNumber(n)!;
          const decremented = decrementTaskNumber(taskNum);
          expect(decremented).not.toBeNull();

          const incremented = incrementTaskNumber(decremented!);
          expect(incremented).toBe(taskNum);
        }),
        { numRuns: 200 }
      );
    });

    it('increment at max returns null', () => {
      const maxTask = createTaskNumber(999999)!;
      expect(incrementTaskNumber(maxTask)).toBeNull();
    });

    it('decrement at min returns null', () => {
      const minTask = createTaskNumber(1)!;
      expect(decrementTaskNumber(minTask)).toBeNull();
    });
  });

  describe('subtask parsing', () => {
    it('parses multi-digit subtask numbers', () => {
      fc.assert(
        fc.property(
          taskNumberArb,
          subtaskArb,
          (n, subtask) => {
            const str = `${n}.${subtask}`;
            const parsed = parseTaskIdFromString(str, { requireSeparator: false });

            expect(parsed).not.toBeNull();
            expect(parsed!.subtask).toBe(subtask);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
