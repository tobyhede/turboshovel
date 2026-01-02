import type { StepId, Step } from '@turboshovel/shared';

/**
 * Substitute workflow variables in a prompt string.
 */
export function substituteVariables(prompt: string, stepId: StepId): string {
  if (!stepId.substep) {
    return prompt;
  }
  return prompt.replace(/\$n/g, stepId.substep);
}

/**
 * Get the prompt for a step from parsed workflow steps.
 */
export function getStepPrompt(steps: readonly Step[], stepId: StepId): string | undefined {
  const step = steps.find(s => s.number === stepId.step);
  if (!step || step.prompts.length === 0) {
    return undefined;
  }
  return step.prompts[0].text;
}