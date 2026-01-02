import type { Action, Conditions, StepState } from '@turboshovel/shared';

/**
 * Evaluate aggregated conditions based on step states
 */
export function evaluateConditions(steps: readonly StepState[], conditions: Conditions): Action {
  const anyBlocked = steps.some((t) => t.status === 'blocked');
  const anyComplete = steps.some((t) => t.status === 'complete');

  switch (conditions.all) {
    case true:
      return anyBlocked ? conditions.fail : conditions.pass;
    case false:
      return anyComplete ? conditions.pass : conditions.fail;
  }
}