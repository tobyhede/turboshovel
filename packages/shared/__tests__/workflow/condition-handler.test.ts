import { createStepNumber } from '../../src/workflow/types.js';
import { evaluateFailCondition, evaluateSubstepAggregation } from '../../src/workflow/condition-handler.js';
import type { SubstepState } from '../../src/workflow/types.js';

describe('evaluateSubstepAggregation', () => {
  // PASS ALL mode (all: true)
  const passAllConditions = {
    all: true,
    pass: { type: 'CONTINUE' as const },
    fail: { type: 'STOP' as const, message: 'Substep failed' }
  };

  // PASS ANY mode (all: false)
  const passAnyConditions = {
    all: false,
    pass: { type: 'CONTINUE' as const },
    fail: { type: 'STOP' as const, message: 'All substeps failed' }
  };

  describe('PASS ALL mode', () => {
    it('returns null when substeps still running', () => {
      const states: SubstepState[] = [
        { id: '1', status: 'done', result: 'pass' },
        { id: '2', status: 'running' }
      ];

      const result = evaluateSubstepAggregation(states, passAllConditions);
      expect(result).toBeNull();
    });

    it('returns pass action when ALL substeps pass', () => {
      const states: SubstepState[] = [
        { id: '1', status: 'done', result: 'pass' },
        { id: '2', status: 'done', result: 'pass' }
      ];

      const result = evaluateSubstepAggregation(states, passAllConditions);
      expect(result?.action).toBe('continue');
    });

    it('returns fail action when ANY substep fails', () => {
      const states: SubstepState[] = [
        { id: '1', status: 'done', result: 'pass' },
        { id: '2', status: 'done', result: 'fail' }
      ];

      const result = evaluateSubstepAggregation(states, passAllConditions);
      expect(result?.action).toBe('blocked');
    });
  });

  describe('PASS ANY mode', () => {
    it('returns pass action when ANY substep passes', () => {
      const states: SubstepState[] = [
        { id: '1', status: 'done', result: 'fail' },
        { id: '2', status: 'done', result: 'pass' }
      ];

      const result = evaluateSubstepAggregation(states, passAnyConditions);
      expect(result?.action).toBe('continue');
    });

    it('returns fail action when ALL substeps fail', () => {
      const states: SubstepState[] = [
        { id: '1', status: 'done', result: 'fail' },
        { id: '2', status: 'done', result: 'fail' }
      ];

      const result = evaluateSubstepAggregation(states, passAnyConditions);
      expect(result?.action).toBe('blocked');
    });
  });
});

describe('evaluateFailCondition with RETRY exhaustion', () => {
  it('returns GOTO when retries exhausted with GOTO action', () => {
    const step = {
      number: createStepNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 2, then: { type: 'GOTO' as const, step: createStepNumber(5)! } }
      }
    };

    const result = evaluateFailCondition(step, 2);
    expect(result).toEqual({ action: 'goto', gotoStep: createStepNumber(5) });
  });

  it('returns continue when retries exhausted with CONTINUE action', () => {
    const step = {
      number: createStepNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 1, then: { type: 'CONTINUE' as const } }
      }
    };

    const result = evaluateFailCondition(step, 1);
    expect(result).toEqual({ action: 'continue' });
  });

  it('returns blocked with message when retries exhausted with STOP', () => {
    const step = {
      number: createStepNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 3, then: { type: 'STOP' as const, message: 'Build failed' } }
      }
    };

    const result = evaluateFailCondition(step, 3);
    expect(result).toEqual({ action: 'blocked', message: 'Build failed' });
  });

  it('returns done when retries exhausted with DONE action', () => {
    const step = {
      number: createStepNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 2, then: { type: 'DONE' as const } }
      }
    };

    const result = evaluateFailCondition(step, 2);
    expect(result).toEqual({ action: 'done' });
  });

  it('returns retry when not yet exhausted', () => {
    const step = {
      number: createStepNumber(1)!,
      description: 'Test',
      prompts: [],
      conditions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 3, then: { type: 'STOP' as const } }
      }
    };

    const result = evaluateFailCondition(step, 1);
    expect(result).toEqual({ action: 'retry', newRetryCount: 2 });
  });
});