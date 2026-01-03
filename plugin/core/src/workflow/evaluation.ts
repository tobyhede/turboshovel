import type { Action, Transitions, StepState } from '@turboshovel/shared';

/**
 * Evaluate aggregated conditions based on step states
 */
export function evaluateTransitions(steps: readonly StepState[], transitions: Transitions): Action {
  const anyBlocked = steps.some((t) => t.status === 'blocked');
  const anyComplete = steps.some((t) => t.status === 'complete');

  switch (transitions.all) {
    case true:
      return anyBlocked ? transitions.fail : transitions.pass;
    case false:
      return anyComplete ? transitions.pass : transitions.fail;
  }
}