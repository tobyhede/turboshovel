import { setup, assign } from 'xstate';
import { type Step, type StepNumber, type Action, type NonRetryAction } from './types.js';
import type { StepId } from './step-id.js';

export interface WorkflowContext {
  retryCount: number;
  substep?: string;
  nextInstance?: boolean;
  variables: Record<string, boolean | number | string>;
}

export type WorkflowEvent =
  | { type: 'PASS' }
  | { type: 'FAIL' }
  | { type: 'RETRY' }
  | { type: 'GOTO'; target: StepId };

// XState requires any for transition builder (snapshot types not fully typed)
function actionToTransition(
  action: Action,
  currentStep: StepNumber,
  maxSteps: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (action.type === 'RETRY') {
    return [
      {
        guard: ({ context }: { context: WorkflowContext }) => context.retryCount < action.max,
        actions: assign({
          retryCount: ({ context }) => (context.retryCount as number) + 1
        }),
        target: `step_${String(currentStep)}`
      },
      nonRetryActionToTransition(action.then, currentStep, maxSteps)
    ];
  }

  return nonRetryActionToTransition(action, currentStep, maxSteps);
}

// XState requires any for transition builder (snapshot types not fully typed)
function nonRetryActionToTransition(
  action: NonRetryAction,
  currentStep: StepNumber,
  maxSteps: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  switch (action.type) {
    case 'CONTINUE':
      if (currentStep >= maxSteps) {
        return { target: 'complete' };
      }
      return {
        target: `step_${String(currentStep + 1)}`,
        actions: assign({ retryCount: 0, substep: undefined })
      };
    case 'DONE':
      return { target: 'complete' };
    case 'STOP':
      return { target: 'blocked' };
    case 'GOTO': {
      const targetStep = action.target.step;

      // Handle dynamic {N}.M references (substep navigation within current instance)
      if (targetStep === '{N}') {
        // {N}.M - stay in step_1, navigate to substep M
        return {
          target: 'step_1',
          actions: assign({
            retryCount: 0,
            substep: action.target.substep
          })
        };
      }

      // Static numeric target
      return {
        target: `step_${String(targetStep)}`,
        actions: assign({
          retryCount: 0,
          substep: action.target.substep
        })
      };
    }
    case 'NEXT':
      // NEXT creates next instance - stay in step_1 but signal instance increment
      return {
        target: 'step_1',
        actions: assign({
          retryCount: 0,
          substep: '1',
          nextInstance: true  // Signal to executor: increment instance number
        })
      };
  }
}

// XState snapshot type is not fully typed
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function compileWorkflowToMachine(steps: Step[]) {
  // XState snapshot type is not fully typed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const states: Record<string, any> = {};

  // Generate GOTO transitions for all possible target steps (static steps only)
  const gotoTransitions = steps
    .filter(step => step.number !== undefined) // Only static steps have numbers
    .map((targetStep) => ({
      guard: ({ event }: { event: WorkflowEvent }) => {
        if (event.type !== 'GOTO') return false;
        return event.target.step === targetStep.number;
      },
      target: `step_${String(targetStep.number)}`,
      actions: assign({
        retryCount: 0,
        substep: ({ event }: { event: WorkflowEvent }) =>
          event.type === 'GOTO' ? event.target.substep : undefined
      })
    }));

  steps.forEach((step, index) => {
    // Use index + 1 as step number for state ID (works for both static and dynamic)
     
    const stepNum = step.number ?? ((index + 1) as StepNumber);
    const stepId = `step_${String(stepNum)}`;
    // XState state object type is not fully typed
    states[stepId] = {
      on: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        PASS: step.transitions
          ? actionToTransition(step.transitions.pass, stepNum, steps.length)
          : {
              target: stepNum < steps.length ? `step_${String(stepNum + 1)}` : 'complete',
              actions: assign({ retryCount: 0, substep: undefined })
            },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        FAIL: step.transitions
          ? actionToTransition(step.transitions.fail, stepNum, steps.length)
          : { target: 'blocked' },
        RETRY: {
          actions: assign({
            retryCount: ({ context }) => (context.retryCount as number) + 1
          }),
          target: stepId
        },
        GOTO: gotoTransitions
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
      substep: undefined,
      variables: {},
    },
    states: {
      ...states,
      complete: { type: 'final' },
      blocked: { type: 'final' }
    }
  });
}