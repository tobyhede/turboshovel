import { createTaskNumber } from '../../src/workflow/types.js';
import { evaluateFailCondition, evaluateSubtaskAggregation } from '../../src/workflow/condition-handler.js';
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

describe('evaluateFailCondition with RETRY exhaustion', () => {
  it('returns GOTO when retries exhausted with GOTO action', () => {
    const task = {
      number: createTaskNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 2, then: { type: 'GOTO' as const, task: createTaskNumber(5)! } }
      }
    };

    const result = evaluateFailCondition(task, 2);
    expect(result).toEqual({ action: 'goto', gotoTask: createTaskNumber(5) });
  });

  it('returns continue when retries exhausted with CONTINUE action', () => {
    const task = {
      number: createTaskNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 1, then: { type: 'CONTINUE' as const } }
      }
    };

    const result = evaluateFailCondition(task, 1);
    expect(result).toEqual({ action: 'continue' });
  });

  it('returns blocked with message when retries exhausted with STOP', () => {
    const task = {
      number: createTaskNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 3, then: { type: 'STOP' as const, message: 'Build failed' } }
      }
    };

    const result = evaluateFailCondition(task, 3);
    expect(result).toEqual({ action: 'blocked', message: 'Build failed' });
  });

  it('returns done when retries exhausted with DONE action', () => {
    const task = {
      number: createTaskNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 2, then: { type: 'DONE' as const } }
      }
    };

    const result = evaluateFailCondition(task, 2);
    expect(result).toEqual({ action: 'done' });
  });

  it('returns retry when not yet exhausted', () => {
    const task = {
      number: createTaskNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 3, then: { type: 'STOP' as const } }
      }
    };

    const result = evaluateFailCondition(task, 1);
    expect(result).toEqual({ action: 'retry', newRetryCount: 2 });
  });
});
