import { describe, it, expect } from '@jest/globals';
import { parseStepIdFromString, stepIdToString, stepIdEquals } from '../../src/workflow/step-id.js';

describe('parseStepIdFromString', () => {
  it('parses step only', () => {
    expect(parseStepIdFromString('3')).toEqual({ step: 3, substep: undefined });
  });

  it('parses step with substep', () => {
    expect(parseStepIdFromString('2.1')).toEqual({ step: 2, substep: '1' });
  });

  it('rejects substep 0 (1-indexed)', () => {
    expect(parseStepIdFromString('3.0')).toBeNull();
  });

  it('rejects step 0', () => {
    expect(parseStepIdFromString('0')).toBeNull();
    expect(parseStepIdFromString('0.1')).toBeNull();
  });

  it('rejects negative numbers', () => {
    expect(parseStepIdFromString('-1')).toBeNull();
  });
});

describe('stepIdToString', () => {
  it('formats step only', () => {
    expect(stepIdToString({ step: 3 as any })).toBe('3');
  });

  it('formats step with substep', () => {
    expect(stepIdToString({ step: 2 as any, substep: '1' })).toBe('2.1');
  });
});

describe('stepIdEquals', () => {
  it('returns true for equal positions', () => {
    expect(stepIdEquals(
      { step: 2 as any, substep: '1' },
      { step: 2 as any, substep: '1' }
    )).toBe(true);
  });

  it('returns false for different steps', () => {
    expect(stepIdEquals(
      { step: 2 as any, substep: '1' },
      { step: 3 as any, substep: '1' }
    )).toBe(false);
  });

  it('returns false for different substeps', () => {
    expect(stepIdEquals(
      { step: 2 as any, substep: '1' },
      { step: 2 as any, substep: '2' }
    )).toBe(false);
  });

  it('returns false when one has substep and other does not', () => {
    expect(stepIdEquals(
      { step: 2 as any, substep: '1' },
      { step: 2 as any }
    )).toBe(false);
  });
});

describe('dynamic substep references', () => {
  it('parses {N}.1 as dynamic step with static substep', () => {
    const result = parseStepIdFromString('{N}.1');
    expect(result).toEqual({ step: '{N}', substep: '1' });
  });

  it('parses {N}.{n} as fully dynamic reference', () => {
    const result = parseStepIdFromString('{N}.{n}');
    expect(result).toEqual({ step: '{N}', substep: '{n}' });
  });

  it('rejects {N} alone (use NEXT action instead)', () => {
    const result = parseStepIdFromString('{N}');
    expect(result).toBeNull();
  });
});
