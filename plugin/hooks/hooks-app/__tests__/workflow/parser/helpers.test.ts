// __tests__/workflow/parser/helpers.test.ts
import { stripSeparator, extractStepHeader, parseAction, parseConditional } from '../../../src/workflow/parser/helpers';

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
    expect(parseAction('STOP fix tests first')).toEqual({ type: 'STOP', message: 'fix tests first' });
  });

  test('parses GOTO N', () => {
    const result = parseAction('GOTO 3');
    expect(result).toEqual({ type: 'GOTO', step: 3 });
  });

  test('parses DONE', () => {
    expect(parseAction('DONE')).toEqual({ type: 'DONE' });
  });

  test('parses RETRY without max', () => {
    expect(parseAction('RETRY')).toEqual({ type: 'RETRY' });
  });

  test('parses RETRY with max', () => {
    expect(parseAction('RETRY 3')).toEqual({ type: 'RETRY', max: 3 });
  });

  test('returns null for invalid action', () => {
    expect(parseAction('INVALID')).toBeNull();
  });
});

describe('parseConditional', () => {
  test('parses PASS: CONTINUE', () => {
    expect(parseConditional('PASS: CONTINUE')).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
    });
  });

  test('parses FAIL: STOP message', () => {
    expect(parseConditional('FAIL: STOP fix tests')).toEqual({
      type: 'fail',
      action: { type: 'STOP', message: 'fix tests' },
    });
  });

  test('parses with space separator', () => {
    expect(parseConditional('PASS CONTINUE')).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
    });
  });

  test('parses with dash separator', () => {
    expect(parseConditional('FAIL - STOP')).toEqual({
      type: 'fail',
      action: { type: 'STOP' },
    });
  });

  test('returns null for non-conditional', () => {
    expect(parseConditional('Some random text')).toBeNull();
  });

  test('rejects lowercase pass/fail', () => {
    expect(parseConditional('pass: CONTINUE')).toBeNull();
  });
});
