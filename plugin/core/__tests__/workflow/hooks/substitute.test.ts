import { substituteVariables, getTaskPrompt } from '../../../src/workflow/hooks/substitute';
import { createTaskNumber, type Task } from '../../../src/workflow/types';
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

describe('getTaskPrompt', () => {
  const tasks: Task[] = [
    {
      number: createTaskNumber(1)!,
      description: 'Initialize',
      prompts: [{ text: 'Set up the environment.' }]
    },
    {
      number: createTaskNumber(2)!,
      description: 'Parallel Tasks',
      prompts: [{ text: 'You are agent $n. Log agent-$n-started.' }],
      subtasks: [
        { id: '{n}', description: 'Dynamic subtask', isDynamic: true }
      ]
    },
    {
      number: createTaskNumber(3)!,
      description: 'No prompts',
      prompts: []
    }
  ];

  it('returns prompt for matching task', () => {
    const taskId: TaskId = { task: createTaskNumber(2)!, subtask: '1' };

    const result = getTaskPrompt(tasks, taskId);

    expect(result).toBe('You are agent $n. Log agent-$n-started.');
  });

  it('returns undefined when task not found', () => {
    const taskId: TaskId = { task: createTaskNumber(99)! };

    const result = getTaskPrompt(tasks, taskId);

    expect(result).toBeUndefined();
  });

  it('returns undefined when task has no prompts', () => {
    const taskId: TaskId = { task: createTaskNumber(3)! };

    const result = getTaskPrompt(tasks, taskId);

    expect(result).toBeUndefined();
  });

  it('returns first prompt when multiple exist', () => {
    const tasksWithMultiple: Task[] = [{
      number: createTaskNumber(1)!,
      description: 'Multi-prompt',
      prompts: [{ text: 'First prompt.' }, { text: 'Second prompt.' }]
    }];
    const taskId: TaskId = { task: createTaskNumber(1)! };

    const result = getTaskPrompt(tasksWithMultiple, taskId);

    expect(result).toBe('First prompt.');
  });
});
