import type { Action, Transitions, StepState } from '@turboshovel/shared';

/**
 * Evaluate aggregated conditions based on step states
 */
export function evaluateTransitions(steps: readonly StepState[], transitions: Transitions): Action {
  const anyStopped = steps.some((t) => t.status === 'stopped');
  const anyComplete = steps.some((t) => t.status === 'complete');

  switch (transitions.all) {
    case true:
      return anyStopped ? transitions.fail.action : transitions.pass.action;
    case false:
      return anyComplete ? transitions.pass.action : transitions.fail.action;
  }
}