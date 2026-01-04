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
    expect(result).toEqual({ number: 1, isDynamic: false, description: 'First step' });
  });

  test('parses "1: First step"', () => {
    const result = extractStepHeader('1: First step');
    expect(result).toEqual({ number: 1, isDynamic: false, description: 'First step' });
  });

  test('parses "1) First step"', () => {
    const result = extractStepHeader('1) First step');
    expect(result).toEqual({ number: 1, isDynamic: false, description: 'First step' });
  });

  test('parses "1 - First step"', () => {
    const result = extractStepHeader('1 - First step');
    expect(result).toEqual({ number: 1, isDynamic: false, description: 'First step' });
  });

  test('parses "1 First step" (space only)', () => {
    const result = extractStepHeader('1 First step');
    expect(result).toEqual({ number: 1, isDynamic: false, description: 'First step' });
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

describe('extractStepHeader with dynamic steps', () => {
  it('parses "{N}. Process item"', () => {
    const result = extractStepHeader('{N}. Process item');
    expect(result).toEqual({
      isDynamic: true,
      description: 'Process item'
    });
  });

  it('parses "{N}: Execute batch"', () => {
    const result = extractStepHeader('{N}: Execute batch');
    expect(result).toEqual({
      isDynamic: true,
      description: 'Execute batch'
    });
  });

  it('parses "{N} - Run task"', () => {
    const result = extractStepHeader('{N} - Run task');
    expect(result).toEqual({
      isDynamic: true,
      description: 'Run task'
    });
  });

  it('rejects "{n}" (lowercase)', () => {
    const result = extractStepHeader('{n}. lowercase');
    expect(result).toBeNull();
  });

  it('rejects "{N}" without description', () => {
    const result = extractStepHeader('{N}');
    expect(result).toBeNull();
  });

  it('static steps still work and include isDynamic: false', () => {
    const result = extractStepHeader('1. First step');
    expect(result).toEqual({
      number: 1,
      isDynamic: false,
      description: 'First step'
    });
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
    expect(result).toEqual({ type: 'GOTO', target: { step: 3, substep: undefined } });
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
      stepRef: 1,
      id: '1',
      description: 'First reviewer',
      agentType: undefined,
      isDynamic: false
    });
  });

  it('parses substep with agent type: 2.2 Second (code-agent)', () => {
    const result = extractSubstepHeader('2.2 Second reviewer (code-agent)');
    expect(result).toEqual({
      stepRef: 2,
      id: '2',
      description: 'Second reviewer',
      agentType: 'code-agent',
      isDynamic: false
    });
  });

  it('parses dynamic substep: 3.{n} Execute step', () => {
    const result = extractSubstepHeader('3.{n} Execute step');
    expect(result).toEqual({
      stepRef: 3,
      id: '{n}',
      description: 'Execute step',
      agentType: undefined,
      isDynamic: true
    });
  });
});

describe('extractSubstepHeader with dynamic parent', () => {
  it('parses "{N}.1 Implement changes"', () => {
    const result = extractSubstepHeader('{N}.1 Implement changes');
    expect(result).toEqual({
      stepRef: '{N}',
      id: '1',
      description: 'Implement changes',
      agentType: undefined,
      isDynamic: false
    });
  });

  it('parses "{N}.2 Run tests (test-agent)"', () => {
    const result = extractSubstepHeader('{N}.2 Run tests (test-agent)');
    expect(result).toEqual({
      stepRef: '{N}',
      id: '2',
      description: 'Run tests',
      agentType: 'test-agent',
      isDynamic: false
    });
  });

  it('parses "{N}.{n} Process item"', () => {
    const result = extractSubstepHeader('{N}.{n} Process item');
    expect(result).toEqual({
      stepRef: '{N}',
      id: '{n}',
      description: 'Process item',
      agentType: undefined,
      isDynamic: true
    });
  });

  it('static parent substeps still work', () => {
    const result = extractSubstepHeader('1.1 First reviewer');
    expect(result).toEqual({
      stepRef: 1,
      id: '1',
      description: 'First reviewer',
      agentType: undefined,
      isDynamic: false
    });
  });
});