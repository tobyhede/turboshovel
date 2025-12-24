import { parseTaskId, parseTaskIdFromString, taskIdToString, taskIdEquals } from '../../src/workflow/task-id';

describe('parseTaskId', () => {
  it('parses simple task number from description', () => {
    const result = parseTaskId('3 - Review code');
    expect(result).toEqual({ task: 3 });
  });

  it('parses task with subtask letter', () => {
    const result = parseTaskId('3.A - First reviewer');
    expect(result).toEqual({ task: 3, subtask: 'A' });
  });

  it('normalizes lowercase subtask to uppercase', () => {
    const result = parseTaskId('2.b - Second task');
    expect(result).toEqual({ task: 2, subtask: 'B' });
  });

  it('parses task with dash separator', () => {
    const result = parseTaskId('1 - Simple task');
    expect(result).toEqual({ task: 1 });
  });

  it('parses task with colon separator', () => {
    const result = parseTaskId('5: Execute batch');
    expect(result).toEqual({ task: 5 });
  });

  it('returns null for description without task prefix', () => {
    const result = parseTaskId('Review the code changes');
    expect(result).toBeNull();
  });

  it('returns null for zero task number', () => {
    const result = parseTaskId('0 - Invalid');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseTaskId('');
    expect(result).toBeNull();
  });
});

describe('taskIdToString', () => {
  it('formats simple task', () => {
    expect(taskIdToString({ task: 3 })).toBe('3');
  });

  it('formats task with subtask', () => {
    expect(taskIdToString({ task: 3, subtask: 'A' })).toBe('3.A');
  });
});

describe('taskIdEquals', () => {
  it('returns true for equal simple tasks', () => {
    expect(taskIdEquals({ task: 3 }, { task: 3 })).toBe(true);
  });

  it('returns true for equal tasks with subtasks', () => {
    expect(taskIdEquals({ task: 3, subtask: 'A' }, { task: 3, subtask: 'A' })).toBe(true);
  });

  it('returns false for different task numbers', () => {
    expect(taskIdEquals({ task: 3 }, { task: 4 })).toBe(false);
  });

  it('returns false for different subtasks', () => {
    expect(taskIdEquals({ task: 3, subtask: 'A' }, { task: 3, subtask: 'B' })).toBe(false);
  });

  it('returns false when one has subtask and other does not', () => {
    expect(taskIdEquals({ task: 3 }, { task: 3, subtask: 'A' })).toBe(false);
  });
});

describe('parseTaskIdFromString', () => {
  describe('without separator requirement', () => {
    it('parses simple task number', () => {
      const result = parseTaskIdFromString('3');
      expect(result).toEqual({ task: 3 });
    });

    it('parses task with subtask', () => {
      const result = parseTaskIdFromString('3.A');
      expect(result).toEqual({ task: 3, subtask: 'A' });
    });

    it('normalizes lowercase subtask', () => {
      const result = parseTaskIdFromString('2.b');
      expect(result).toEqual({ task: 2, subtask: 'B' });
    });

    it('returns null for invalid format', () => {
      expect(parseTaskIdFromString('abc')).toBeNull();
      expect(parseTaskIdFromString('')).toBeNull();
      expect(parseTaskIdFromString('0')).toBeNull();
      expect(parseTaskIdFromString('-1')).toBeNull();
    });
  });

  describe('with separator requirement', () => {
    it('parses when separator present', () => {
      const result = parseTaskIdFromString('3 - Review', { requireSeparator: true });
      expect(result).toEqual({ task: 3 });
    });

    it('returns null when separator missing', () => {
      const result = parseTaskIdFromString('3', { requireSeparator: true });
      expect(result).toBeNull();
    });
  });
});
