import { evaluateSubtaskAggregation } from '../../src/workflow/condition-handler.js';
import type { SubtaskState } from '../../src/workflow/types.js';

describe('evaluateSubtaskAggregation', () => {
  // PASS ALL mode (all: true)
  const passAllConditions = {
    all: true,
    pass: { type: 'CONTINUE' as const },
    fail: { type: 'STOP' as const, message: 'Subtask failed' }
  };

  // PASS ANY mode (all: false)
  const passAnyConditions = {
    all: false,
    pass: { type: 'CONTINUE' as const },
    fail: { type: 'STOP' as const, message: 'All subtasks failed' }
  };

  describe('PASS ALL mode', () => {
    it('returns null when subtasks still running', () => {
      const states: SubtaskState[] = [
        { id: '1', status: 'done', result: 'pass' },
        { id: '2', status: 'running' }
      ];

      const result = evaluateSubtaskAggregation(states, passAllConditions);
      expect(result).toBeNull();
    });

    it('returns pass action when ALL subtasks pass', () => {
      const states: SubtaskState[] = [
        { id: '1', status: 'done', result: 'pass' },
        { id: '2', status: 'done', result: 'pass' }
      ];

      const result = evaluateSubtaskAggregation(states, passAllConditions);
      expect(result?.action).toBe('continue');
    });

    it('returns fail action when ANY subtask fails', () => {
      const states: SubtaskState[] = [
        { id: '1', status: 'done', result: 'pass' },
        { id: '2', status: 'done', result: 'fail' }
      ];

      const result = evaluateSubtaskAggregation(states, passAllConditions);
      expect(result?.action).toBe('blocked');
    });
  });

  describe('PASS ANY mode', () => {
    it('returns pass action when ANY subtask passes', () => {
      const states: SubtaskState[] = [
        { id: '1', status: 'done', result: 'fail' },
        { id: '2', status: 'done', result: 'pass' }
      ];

      const result = evaluateSubtaskAggregation(states, passAnyConditions);
      expect(result?.action).toBe('continue');
    });

    it('returns fail action when ALL subtasks fail', () => {
      const states: SubtaskState[] = [
        { id: '1', status: 'done', result: 'fail' },
        { id: '2', status: 'done', result: 'fail' }
      ];

      const result = evaluateSubtaskAggregation(states, passAnyConditions);
      expect(result?.action).toBe('blocked');
    });
  });
});
