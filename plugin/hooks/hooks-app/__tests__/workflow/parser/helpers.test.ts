// __tests__/workflow/parser/helpers.test.ts
import { stripSeparator, extractTaskHeader, parseAction, parseConditional } from '../../../src/workflow/parser/helpers';

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

describe('extractTaskHeader', () => {
  test('parses "1. First task"', () => {
    const result = extractTaskHeader('1. First task');
    expect(result).toEqual({ number: 1, description: 'First task' });
  });

  test('parses "1: First task"', () => {
    const result = extractTaskHeader('1: First task');
    expect(result).toEqual({ number: 1, description: 'First task' });
  });

  test('parses "1) First task"', () => {
    const result = extractTaskHeader('1) First task');
    expect(result).toEqual({ number: 1, description: 'First task' });
  });

  test('parses "1 - First task"', () => {
    const result = extractTaskHeader('1 - First task');
    expect(result).toEqual({ number: 1, description: 'First task' });
  });

  test('parses "1 First task" (space only)', () => {
    const result = extractTaskHeader('1 First task');
    expect(result).toEqual({ number: 1, description: 'First task' });
  });

  test('rejects Task keyword', () => {
    const result = extractTaskHeader('Task 1: First task');
    expect(result).toBeNull();
  });

  test('rejects zero', () => {
    const result = extractTaskHeader('0. Zero task');
    expect(result).toBeNull();
  });

  test('rejects non-numeric start', () => {
    const result = extractTaskHeader('First task');
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
    expect(result).toEqual({ type: 'GOTO', task: 3 });
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
      modifier: null,
    });
  });

  test('parses FAIL: STOP message', () => {
    expect(parseConditional('FAIL: STOP fix tests')).toEqual({
      type: 'fail',
      action: { type: 'STOP', message: 'fix tests' },
      modifier: null,
    });
  });

  test('parses with space separator', () => {
    expect(parseConditional('PASS CONTINUE')).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
      modifier: null,
    });
  });

  test('parses with dash separator', () => {
    expect(parseConditional('FAIL - STOP')).toEqual({
      type: 'fail',
      action: { type: 'STOP' },
      modifier: null,
    });
  });

  test('returns null for non-conditional', () => {
    expect(parseConditional('Some random text')).toBeNull();
  });

  test('rejects lowercase pass/fail', () => {
    expect(parseConditional('pass: CONTINUE')).toBeNull();
  });
});

describe('parseConditional with aggregation', () => {
  it('parses PASS ALL: CONTINUE', () => {
    const result = parseConditional('PASS ALL: CONTINUE');
    expect(result).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
      modifier: 'ALL',
    });
  });

  it('parses FAIL ANY: STOP', () => {
    const result = parseConditional('FAIL ANY: STOP');
    expect(result).toEqual({
      type: 'fail',
      action: { type: 'STOP' },
      modifier: 'ANY',
    });
  });

  it('parses PASS: CONTINUE (no modifier)', () => {
    const result = parseConditional('PASS: CONTINUE');
    expect(result).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
      modifier: null,
    });
  });

  it('parses with arrow syntax: PASS ANY → CONTINUE', () => {
    const result = parseConditional('PASS ANY → CONTINUE');
    expect(result).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
      modifier: 'ANY',
    });
  });

  it('parses FAIL ALL → STOP "message"', () => {
    const result = parseConditional('FAIL ALL → STOP All approaches failed');
    expect(result).toEqual({
      type: 'fail',
      action: { type: 'STOP', message: 'All approaches failed' },
      modifier: 'ALL',
    });
  });
});
