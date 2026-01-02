import { substituteVariables, getStepPrompt } from '../../../src/workflow/hooks/substitute.js';
import { createStepNumber, type Step, type StepId } from '@turboshovel/shared';

describe('substituteVariables', () => {
  it('substitutes $n with substep number', () => {
    const prompt = 'You are agent $n. Log agent-$n-started.';
    const stepId: StepId = { step: createStepNumber(2)!, substep: '1' };

    const result = substituteVariables(prompt, stepId);

    expect(result).toBe('You are agent 1. Log agent-1-started.');
  });

  it('returns prompt unchanged when no substep', () => {
    const prompt = 'You are agent $n.';
    const stepId: StepId = { step: createStepNumber(2)! };

    const result = substituteVariables(prompt, stepId);

    expect(result).toBe('You are agent $n.');
  });

  it('returns prompt unchanged when no $n placeholder', () => {
    const prompt = 'Execute the step.';
    const stepId: StepId = { step: createStepNumber(2)!, substep: '1' };

    const result = substituteVariables(prompt, stepId);

    expect(result).toBe('Execute the step.');
  });

  it('substitutes multiple $n occurrences', () => {
    const prompt = 'Agent $n starts. Agent $n logs. Agent $n ends.';
    const stepId: StepId = { step: createStepNumber(2)!, substep: '3' };

    const result = substituteVariables(prompt, stepId);

    expect(result).toBe('Agent 3 starts. Agent 3 logs. Agent 3 ends.');
  });
});

describe('getStepPrompt', () => {
  const steps: Step[] = [
    {
      number: createStepNumber(1)!,
      description: 'Initialize',
      prompts: [{ text: 'Set up the environment.' }]
    },
    {
      number: createStepNumber(2)!,
      description: 'Parallel Steps',
      prompts: [{ text: 'You are agent $n. Log agent-$n-started.' }],
      substeps: [
        { id: '{n}', description: 'Dynamic substep', isDynamic: true }
      ]
    },
    {
      number: createStepNumber(3)!,
      description: 'No prompts',
      prompts: []
    }
  ];

  it('returns prompt for matching step', () => {
    const stepId: StepId = { step: createStepNumber(2)!, substep: '1' };

    const result = getStepPrompt(steps, stepId);

    expect(result).toBe('You are agent $n. Log agent-$n-started.');
  });

  it('returns undefined when step not found', () => {
    const stepId: StepId = { step: createStepNumber(99)! };

    const result = getStepPrompt(steps, stepId);

    expect(result).toBeUndefined();
  });

  it('returns undefined when step has no prompts', () => {
    const stepId: StepId = { step: createStepNumber(3)! };

    const result = getStepPrompt(steps, stepId);

    expect(result).toBeUndefined();
  });

  it('returns first prompt when multiple exist', () => {
    const stepsWithMultiple: Step[] = [{
      number: createStepNumber(1)!,
      description: 'Multi-prompt',
      prompts: [{ text: 'First prompt.' }, { text: 'Second prompt.' }]
    }];
    const stepId: StepId = { step: createStepNumber(1)! };

    const result = getStepPrompt(stepsWithMultiple, stepId);

    expect(result).toBe('First prompt.');
  });
});