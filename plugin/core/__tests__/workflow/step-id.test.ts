import { parseStepIdFromString, stepIdToString, stepIdEquals, createStepNumber } from '@turboshovel/shared';

describe('parseStepIdFromString with requireSeparator', () => {
  const parse = (s: string): ReturnType<typeof parseStepIdFromString> =>
    parseStepIdFromString(s, { requireSeparator: true });

  it('parses simple step number from description', () => {
    const result = parse('3 - Review code');
    expect(result).toEqual({ step: createStepNumber(3)! });
  });

  it('parses step with numeric substep', () => {
    const result = parse('3.1 - First reviewer');
    expect(result).toEqual({ step: createStepNumber(3)!, substep: '1' });
  });

  it('parses step with multi-digit substep', () => {
    const result = parse('2.12 - Second step');
    expect(result).toEqual({ step: createStepNumber(2)!, substep: '12' });
  });

  it('parses step with dash separator', () => {
    const result = parse('1 - Simple step');
    expect(result).toEqual({ step: createStepNumber(1)! });
  });

  it('parses step with colon separator', () => {
    const result = parse('5: Execute batch');
    expect(result).toEqual({ step: createStepNumber(5)! });
  });

  it('returns null for description without step prefix', () => {
    const result = parse('Review the code changes');
    expect(result).toBeNull();
  });

  it('returns null for zero step number', () => {
    const result = parse('0 - Invalid');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parse('');
    expect(result).toBeNull();
  });
});

describe('stepIdToString', () => {
  it('formats simple step', () => {
    expect(stepIdToString({ step: createStepNumber(3)! })).toBe('3');
  });

  it('formats step with substep', () => {
    expect(stepIdToString({ step: createStepNumber(3)!, substep: '1' })).toBe('3.1');
  });
});

describe('stepIdEquals', () => {
  it('returns true for equal simple steps', () => {
    expect(stepIdEquals({ step: createStepNumber(3)! }, { step: createStepNumber(3)! })).toBe(true);
  });

  it('returns true for equal steps with substeps', () => {
    expect(
      stepIdEquals(
        { step: createStepNumber(3)!, substep: '1' },
        { step: createStepNumber(3)!, substep: '1' }
      )
    ).toBe(true);
  });

  it('returns false for different step numbers', () => {
    expect(stepIdEquals({ step: createStepNumber(3)! }, { step: createStepNumber(4)! })).toBe(
      false
    );
  });

  it('returns false for different substeps', () => {
    expect(
      stepIdEquals(
        { step: createStepNumber(3)!, substep: '1' },
        { step: createStepNumber(3)!, substep: '2' }
      )
    ).toBe(false);
  });

  it('returns false when one has substep and other does not', () => {
    expect(
      stepIdEquals({ step: createStepNumber(3)! }, { step: createStepNumber(3)!, substep: '1' })
    ).toBe(false);
  });
});

describe('parseStepIdFromString without separator', () => {
  it('parses simple step number', () => {
    const result = parseStepIdFromString('3');
    expect(result).toEqual({ step: createStepNumber(3)! });
  });

  it('parses step with numeric substep', () => {
    const result = parseStepIdFromString('3.1');
    expect(result).toEqual({ step: createStepNumber(3)!, substep: '1' });
  });

  it('parses step with multi-digit substep', () => {
    const result = parseStepIdFromString('2.15');
    expect(result).toEqual({ step: createStepNumber(2)!, substep: '15' });
  });

  it('returns null for invalid format', () => {
    expect(parseStepIdFromString('abc')).toBeNull();
    expect(parseStepIdFromString('')).toBeNull();
    expect(parseStepIdFromString('0')).toBeNull();
    expect(parseStepIdFromString('-1')).toBeNull();
    expect(parseStepIdFromString('3.A')).toBeNull();
  });

  it('returns null when separator missing but required', () => {
    const result = parseStepIdFromString('3', { requireSeparator: true });
    expect(result).toBeNull();
  });
});