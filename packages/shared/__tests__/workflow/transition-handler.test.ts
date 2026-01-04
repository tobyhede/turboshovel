import { createStepNumber } from '../../src/workflow/types.js';
import { evaluateFailCondition, evaluatePassCondition, evaluateSubstepAggregation } from '../../src/workflow/transition-handler.js';
import type { SubstepState } from '../../src/workflow/types.js';

describe('NEXT action handling', () => {
  it('evaluatePassCondition returns next for NEXT action', () => {
    const step = {
      number: createStepNumber(1)!,
      description: 'Test',
      prompts: [],
      isDynamic: true,
      transitions: {
        all: true as const,
        pass: { type: 'NEXT' as const },
        fail: { type: 'STOP' as const }
      }
    };

    const result = evaluatePassCondition(step);
    expect(result).toEqual({ action: 'next' });
  });

  it('evaluateFailCondition returns next for NEXT action', () => {
    const step = {
      number: createStepNumber(1)!,
      description: 'Test',
      prompts: [],
      isDynamic: true,
      transitions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'NEXT' as const }
      }
    };

    const result = evaluateFailCondition(step, 0);
    expect(result).toEqual({ action: 'next' });
  });

  it('returns next when retries exhausted with NEXT action', () => {
    const step = {
      number: createStepNumber(1)!,
      description: 'Test',
      prompts: [],
      isDynamic: true,
      transitions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 2, then: { type: 'NEXT' as const } }
      }
    };

    const result = evaluateFailCondition(step, 2);
    expect(result).toEqual({ action: 'next' });
  });
});

describe('evaluateSubstepAggregation', () => {
  // PASS ALL mode (all: true)
  const passAllTransitions = {
    all: true,
    pass: { type: 'CONTINUE' as const },
    fail: { type: 'STOP' as const, message: 'Substep failed' }
  };

  // PASS ANY mode (all: false)
  const passAnyTransitions = {
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

      const result = evaluateSubstepAggregation(states, passAllTransitions);
      expect(result).toBeNull();
    });

    it('returns pass action when ALL substeps pass', () => {
      const states: SubstepState[] = [
        { id: '1', status: 'done', result: 'pass' },
        { id: '2', status: 'done', result: 'pass' }
      ];

      const result = evaluateSubstepAggregation(states, passAllTransitions);
      expect(result?.action).toBe('continue');
    });

    it('returns fail action when ANY substep fails', () => {
      const states: SubstepState[] = [
        { id: '1', status: 'done', result: 'pass' },
        { id: '2', status: 'done', result: 'fail' }
      ];

      const result = evaluateSubstepAggregation(states, passAllTransitions);
      expect(result?.action).toBe('blocked');
    });
  });

  describe('PASS ANY mode', () => {
    it('returns pass action when ANY substep passes', () => {
      const states: SubstepState[] = [
        { id: '1', status: 'done', result: 'fail' },
        { id: '2', status: 'done', result: 'pass' }
      ];

      const result = evaluateSubstepAggregation(states, passAnyTransitions);
      expect(result?.action).toBe('continue');
    });

    it('returns fail action when ALL substeps fail', () => {
      const states: SubstepState[] = [
        { id: '1', status: 'done', result: 'fail' },
        { id: '2', status: 'done', result: 'fail' }
      ];

      const result = evaluateSubstepAggregation(states, passAnyTransitions);
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
      transitions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 2, then: { type: 'GOTO' as const, target: { step: createStepNumber(5)! } as any } }
      }
    };

    const result = evaluateFailCondition(step, 2);
    expect(result).toEqual({ action: 'goto', gotoTarget: { step: createStepNumber(5)! } });
  });

  it('returns continue when retries exhausted with CONTINUE action', () => {
    const step = {
      number: createStepNumber(1)!,
      description: 'Test',
      prompts: [],
      transitions: {
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
      transitions: {
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
      transitions: {
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
      transitions: {
        all: true as const,
        pass: { type: 'CONTINUE' as const },
        fail: { type: 'RETRY' as const, max: 3, then: { type: 'STOP' as const } }
      }
    };

    const result = evaluateFailCondition(step, 1);
    expect(result).toEqual({ action: 'retry', newRetryCount: 2 });
  });
});