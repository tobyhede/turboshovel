import { substituteVariables } from '../../../src/workflow/hooks/substitute';
import { createTaskNumber } from '../../../src/workflow/types';
import type { TaskId } from '../../../src/workflow/task-id';

describe('substituteVariables', () => {
  it('substitutes $n with subtask number', () => {
    const prompt = 'You are agent $n. Log agent-$n-started.';
    const taskId: TaskId = { task: createTaskNumber(2)!, subtask: '1' };

    const result = substituteVariables(prompt, taskId);

    expect(result).toBe('You are agent 1. Log agent-1-started.');
  });

  it('returns prompt unchanged when no subtask', () => {
    const prompt = 'You are agent $n.';
    const taskId: TaskId = { task: createTaskNumber(2)! };

    const result = substituteVariables(prompt, taskId);

    expect(result).toBe('You are agent $n.');
  });

  it('returns prompt unchanged when no $n placeholder', () => {
    const prompt = 'Execute the task.';
    const taskId: TaskId = { task: createTaskNumber(2)!, subtask: '1' };

    const result = substituteVariables(prompt, taskId);

    expect(result).toBe('Execute the task.');
  });

  it('substitutes multiple $n occurrences', () => {
    const prompt = 'Agent $n starts. Agent $n logs. Agent $n ends.';
    const taskId: TaskId = { task: createTaskNumber(2)!, subtask: '3' };

    const result = substituteVariables(prompt, taskId);

    expect(result).toBe('Agent 3 starts. Agent 3 logs. Agent 3 ends.');
  });
});
