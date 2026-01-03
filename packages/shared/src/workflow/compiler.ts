import { setup, assign } from 'xstate';
import { type Step, type StepNumber, type Action, type NonRetryAction } from './types.js';

export interface WorkflowContext {
  retryCount: number;
  variables: Record<string, boolean | number | string>;
}

export type WorkflowEvent =
  | { type: 'PASS' }
  | { type: 'FAIL' }
  | { type: 'RETRY' };

function actionToTransition(
  action: Action,
  currentStep: StepNumber,
  maxSteps: number
): any {
  if (action.type === 'RETRY') {
    return [
      {
        guard: ({ context }: { context: WorkflowContext }) => context.retryCount < action.max,
        actions: assign({
          retryCount: ({ context }) => context.retryCount + 1
        }),
        target: `step_${currentStep}`
      },
      nonRetryActionToTransition(action.then, currentStep, maxSteps)
    ];
  }

  return nonRetryActionToTransition(action, currentStep, maxSteps);
}

function nonRetryActionToTransition(
  action: NonRetryAction,
  currentStep: StepNumber,
  maxSteps: number
): any {
  switch (action.type) {
    case 'CONTINUE':
      if (currentStep >= maxSteps) return { target: 'complete' };
      return { target: `step_${currentStep + 1}`, actions: assign({ retryCount: 0 }) };
    case 'DONE':
      return { target: 'complete' };
    case 'STOP':
      return { target: 'blocked' };
    case 'GOTO':
      return { target: `step_${action.step}`, actions: assign({ retryCount: 0 }) };
  }
}

export function compileWorkflowToMachine(steps: Step[]) {
  const states: Record<string, any> = {};

  steps.forEach((step) => {
    const stepId = `step_${step.number}`;
    states[stepId] = {
      on: {
        PASS: step.conditions
          ? actionToTransition(step.conditions.pass, step.number, steps.length)
          : { 
              target: step.number < steps.length ? `step_${step.number + 1}` : 'complete',
              actions: assign({ retryCount: 0 })
            },
        FAIL: step.conditions
          ? actionToTransition(step.conditions.fail, step.number, steps.length)
          : { target: 'blocked' },
        RETRY: {
          actions: assign({
            retryCount: ({ context }) => context.retryCount + 1
          }),
          target: stepId
        }
      }
    };
  });

  return setup({
    types: {
      context: {} as WorkflowContext,
      events: {} as WorkflowEvent,
    },
  }).createMachine({
    id: 'workflow',
    initial: 'step_1',
    context: {
      retryCount: 0,
      variables: {},
    },
    states: {
      ...states,
      complete: { type: 'final' },
      blocked: { type: 'final' }
    }
  });
}