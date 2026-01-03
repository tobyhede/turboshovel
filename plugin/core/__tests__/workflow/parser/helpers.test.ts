// __tests__/workflow/parser/helpers.test.ts
import {
  stripSeparator,
  extractStepHeader,
  parseAction,
  parseConditional,
  extractSubstepHeader
} from '@turboshovel/shared';

describe('stripSeparator', () => {
  test('strips colon separator', () => {
    expect(stripSeparator(': CONTINUE')).toBe('CONTINUE');
  });

  test('strips dot separator', () => {
    expect(stripSeparator('. First step')).toBe('First step');
  });

  test('strips dash separator', () => {
    expect(stripSeparator(' - CONTINUE')).toBe('CONTINUE');
  });

  test('strips paren separator', () => {
    expect(stripSeparator(') First step')).toBe('First step');
  });

  test('strips multiple separators', () => {
    expect(stripSeparator(': - First step')).toBe('First step');
  });
});

describe('extractStepHeader', () => {
  test('parses "1. First step"', () => {
    const result = extractStepHeader('1. First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('parses "1: First step"', () => {
    const result = extractStepHeader('1: First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('parses "1) First step"', () => {
    const result = extractStepHeader('1) First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('parses "1 - First step"', () => {
    const result = extractStepHeader('1 - First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('parses "1 First step" (space only)', () => {
    const result = extractStepHeader('1 First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('rejects Step keyword', () => {
    const result = extractStepHeader('Step 1: First step');
    expect(result).toBeNull();
  });

  test('rejects zero', () => {
    const result = extractStepHeader('0. Zero step');
    expect(result).toBeNull();
  });

  test('rejects non-numeric start', () => {
    const result = extractStepHeader('First step');
    expect(result).toBeNull();
  });
});

describe('parseAction', () => {
  test('parses CONTINUE', () => {
    expect(parseAction('CONTINUE')).toEqual({ type: 'CONTINUE' });
  });

  test('parses STOP without message', () => {
    expect(parseAction('STOP')).toEqual({ type: 'STOP' });
  });

  test('parses STOP with message', () => {
    expect(parseAction('STOP fix tests first')).toEqual({
      type: 'STOP',
      message: 'fix tests first'
    });
  });

  test('parses GOTO N', () => {
    const result = parseAction('GOTO 3');
    expect(result).toEqual({ type: 'GOTO', step: 3 });
  });

  test('parses DONE', () => {
    expect(parseAction('DONE')).toEqual({ type: 'DONE' });
  });

  test('parses RETRY without max', () => {
    expect(parseAction('RETRY')).toEqual({ type: 'RETRY', max: 1, then: { type: 'STOP' } });
  });

  test('parses RETRY with max', () => {
    expect(parseAction('RETRY 3')).toEqual({ type: 'RETRY', max: 3, then: { type: 'STOP' } });
  });

  test('returns null for invalid action', () => {
    expect(parseAction('INVALID')).toBeNull();
  });
});

describe('parseAction edge cases', () => {
  test('returns null for RETRY with invalid max', () => {
    expect(parseAction('RETRY abc')).toBeNull();
  });

  test('returns null for GOTO with invalid step number', () => {
    expect(parseAction('GOTO 0')).toBeNull();
    expect(parseAction('GOTO -1')).toBeNull();
  });
});

describe('parseConditional', () => {
  test('parses PASS: CONTINUE', () => {
    expect(parseConditional('PASS: CONTINUE')).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
      modifier: null,
      raw: 'CONTINUE'
    });
  });

  test('parses FAIL: STOP message', () => {
    expect(parseConditional('FAIL: STOP fix tests')).toEqual({
      type: 'fail',
      action: { type: 'STOP', message: 'fix tests' },
      modifier: null,
      raw: 'STOP fix tests'
    });
  });
});

describe('extractSubstepHeader', () => {
  it('parses static substep: 1.1 First reviewer', () => {
    const result = extractSubstepHeader('1.1 First reviewer');
    expect(result).toEqual({
      stepNumber: 1,
      id: '1',
      description: 'First reviewer',
      agentType: undefined,
      isDynamic: false
    });
  });

  it('parses substep with agent type: 2.2 Second (code-agent)', () => {
    const result = extractSubstepHeader('2.2 Second reviewer (code-agent)');
    expect(result).toEqual({
      stepNumber: 2,
      id: '2',
      description: 'Second reviewer',
      agentType: 'code-agent',
      isDynamic: false
    });
  });

  it('parses dynamic substep: 3.{n} Execute step', () => {
    const result = extractSubstepHeader('3.{n} Execute step');
    expect(result).toEqual({
      stepNumber: 3,
      id: '{n}',
      description: 'Execute step',
      agentType: undefined,
      isDynamic: true
    });
  });
});