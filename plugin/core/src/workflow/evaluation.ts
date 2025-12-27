import type { Action, Conditions, TaskState } from './types.js';

/**
 * Evaluate aggregated conditions based on task states
 *
 * For PASS ALL + FAIL ANY (all: true, pessimistic):
 *   - Any blocked -> fail action
 *   - All complete -> pass action
 *
 * For PASS ANY + FAIL ALL (all: false, optimistic):
 *   - Any complete -> pass action
 *   - All blocked -> fail action
 */
export function evaluateConditions(tasks: readonly TaskState[], conditions: Conditions): Action {
  const anyBlocked = tasks.some((t) => t.status === 'blocked');
  const anyComplete = tasks.some((t) => t.status === 'complete');

  // Exhaustive switch on discriminant
  switch (conditions.all) {
    case true:
      // PASS ALL + FAIL ANY: any failure triggers fail
      return anyBlocked ? conditions.fail : conditions.pass;
    case false:
      // PASS ANY + FAIL ALL: any success triggers pass
      return anyComplete ? conditions.pass : conditions.fail;
  }
}
