import { parseTaskIdFromString, taskIdToString, taskIdEquals, createTaskNumber } from '@turboshovel/shared';

describe('parseTaskIdFromString with requireSeparator', () => {
  const parse = (s: string): ReturnType<typeof parseTaskIdFromString> =>
    parseTaskIdFromString(s, { requireSeparator: true });

  it('parses simple task number from description', () => {
    const result = parse('3 - Review code');
    expect(result).toEqual({ task: createTaskNumber(3)! });
  });

  it('parses task with numeric subtask', () => {
    const result = parse('3.1 - First reviewer');
    expect(result).toEqual({ task: createTaskNumber(3)!, subtask: '1' });
  });

  it('parses task with multi-digit subtask', () => {
    const result = parse('2.12 - Second task');
    expect(result).toEqual({ task: createTaskNumber(2)!, subtask: '12' });
  });

  it('parses task with dash separator', () => {
    const result = parse('1 - Simple task');
    expect(result).toEqual({ task: createTaskNumber(1)! });
  });

  it('parses task with colon separator', () => {
    const result = parse('5: Execute batch');
    expect(result).toEqual({ task: createTaskNumber(5)! });
  });

  it('returns null for description without task prefix', () => {
    const result = parse('Review the code changes');
    expect(result).toBeNull();
  });

  it('returns null for zero task number', () => {
    const result = parse('0 - Invalid');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parse('');
    expect(result).toBeNull();
  });
});

describe('taskIdToString', () => {
  it('formats simple task', () => {
    expect(taskIdToString({ task: createTaskNumber(3)! })).toBe('3');
  });

  it('formats task with subtask', () => {
    expect(taskIdToString({ task: createTaskNumber(3)!, subtask: '1' })).toBe('3.1');
  });
});

describe('taskIdEquals', () => {
  it('returns true for equal simple tasks', () => {
    expect(taskIdEquals({ task: createTaskNumber(3)! }, { task: createTaskNumber(3)! })).toBe(true);
  });

  it('returns true for equal tasks with subtasks', () => {
    expect(
      taskIdEquals(
        { task: createTaskNumber(3)!, subtask: '1' },
        { task: createTaskNumber(3)!, subtask: '1' }
      )
    ).toBe(true);
  });

  it('returns false for different task numbers', () => {
    expect(taskIdEquals({ task: createTaskNumber(3)! }, { task: createTaskNumber(4)! })).toBe(
      false
    );
  });

  it('returns false for different subtasks', () => {
    expect(
      taskIdEquals(
        { task: createTaskNumber(3)!, subtask: '1' },
        { task: createTaskNumber(3)!, subtask: '2' }
      )
    ).toBe(false);
  });

  it('returns false when one has subtask and other does not', () => {
    expect(
      taskIdEquals({ task: createTaskNumber(3)! }, { task: createTaskNumber(3)!, subtask: '1' })
    ).toBe(false);
  });
});

describe('parseTaskIdFromString without separator', () => {
  it('parses simple task number', () => {
    const result = parseTaskIdFromString('3');
    expect(result).toEqual({ task: createTaskNumber(3)! });
  });

  it('parses task with numeric subtask', () => {
    const result = parseTaskIdFromString('3.1');
    expect(result).toEqual({ task: createTaskNumber(3)!, subtask: '1' });
  });

  it('parses task with multi-digit subtask', () => {
    const result = parseTaskIdFromString('2.15');
    expect(result).toEqual({ task: createTaskNumber(2)!, subtask: '15' });
  });

  it('returns null for invalid format', () => {
    expect(parseTaskIdFromString('abc')).toBeNull();
    expect(parseTaskIdFromString('')).toBeNull();
    expect(parseTaskIdFromString('0')).toBeNull();
    expect(parseTaskIdFromString('-1')).toBeNull();
    expect(parseTaskIdFromString('3.A')).toBeNull(); // Letters no longer valid
  });

  it('returns null when separator missing but required', () => {
    const result = parseTaskIdFromString('3', { requireSeparator: true });
    expect(result).toBeNull();
  });
});
