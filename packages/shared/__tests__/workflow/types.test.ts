import { describe, it, expect } from '@jest/globals';
import type { NonRetryAction, StepNumber } from '../../src/workflow/types.js';
import type { StepId } from '../../src/workflow/step-id.js';

describe('GOTO action type', () => {
  it('uses target: StepId instead of step: StepNumber', () => {
    // This test documents the expected shape after the refactor
    const gotoAction: NonRetryAction = {
      type: 'GOTO',
      target: { step: 2 as StepNumber, substep: '1' }
    };

    // Type assertion - if this compiles, the type is correct
    expect(gotoAction.type).toBe('GOTO');
    expect(gotoAction.target.step).toBe(2);
    expect(gotoAction.target.substep).toBe('1');
  });

  it('allows GOTO without substep', () => {
    const gotoAction: NonRetryAction = {
      type: 'GOTO',
      target: { step: 3 as StepNumber }
    };

    expect(gotoAction.target.step).toBe(3);
    expect(gotoAction.target.substep).toBeUndefined();
  });
});
