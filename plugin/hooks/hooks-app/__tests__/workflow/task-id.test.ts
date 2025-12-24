import { parseTaskIdFromString, taskIdToString, taskIdEquals } from '../../src/workflow/task-id';
import { createTaskNumber } from '../../src/workflow/types';

describe('parseTaskIdFromString with requireSeparator', () => {
  const parse = (s: string): ReturnType<typeof parseTaskIdFromString> => parseTaskIdFromString(s, { requireSeparator: true });

  it('parses simple task number from description', () => {
    const result = parse('3 - Review code');
    expect(result).toEqual({ task: createTaskNumber(3)! });
  });

  it('parses task with subtask letter', () => {
    const result = parse('3.A - First reviewer');
    expect(result).toEqual({ task: createTaskNumber(3)!, subtask: 'A' });
  });

  it('normalizes lowercase subtask to uppercase', () => {
    const result = parse('2.b - Second task');
    expect(result).toEqual({ task: createTaskNumber(2)!, subtask: 'B' });
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
    expect(taskIdToString({ task: createTaskNumber(3)!, subtask: 'A' })).toBe('3.A');
  });
});

describe('taskIdEquals', () => {
  it('returns true for equal simple tasks', () => {
    expect(taskIdEquals({ task: createTaskNumber(3)! }, { task: createTaskNumber(3)! })).toBe(true);
  });

  it('returns true for equal tasks with subtasks', () => {
    expect(taskIdEquals({ task: createTaskNumber(3)!, subtask: 'A' }, { task: createTaskNumber(3)!, subtask: 'A' })).toBe(true);
  });

  it('returns false for different task numbers', () => {
    expect(taskIdEquals({ task: createTaskNumber(3)! }, { task: createTaskNumber(4)! })).toBe(false);
  });

  it('returns false for different subtasks', () => {
    expect(taskIdEquals({ task: createTaskNumber(3)!, subtask: 'A' }, { task: createTaskNumber(3)!, subtask: 'B' })).toBe(false);
  });

  it('returns false when one has subtask and other does not', () => {
    expect(taskIdEquals({ task: createTaskNumber(3)! }, { task: createTaskNumber(3)!, subtask: 'A' })).toBe(false);
  });
});

describe('parseTaskIdFromString without separator', () => {
  it('parses simple task number', () => {
    const result = parseTaskIdFromString('3');
    expect(result).toEqual({ task: createTaskNumber(3)! });
  });

  it('parses task with subtask', () => {
    const result = parseTaskIdFromString('3.A');
    expect(result).toEqual({ task: createTaskNumber(3)!, subtask: 'A' });
  });

  it('normalizes lowercase subtask', () => {
    const result = parseTaskIdFromString('2.b');
    expect(result).toEqual({ task: createTaskNumber(2)!, subtask: 'B' });
  });

  it('returns null for invalid format', () => {
    expect(parseTaskIdFromString('abc')).toBeNull();
    expect(parseTaskIdFromString('')).toBeNull();
    expect(parseTaskIdFromString('0')).toBeNull();
    expect(parseTaskIdFromString('-1')).toBeNull();
  });

  it('returns null when separator missing but required', () => {
    const result = parseTaskIdFromString('3', { requireSeparator: true });
    expect(result).toBeNull();
  });
});
