import type { Task, TaskNumber, SubtaskState, Action } from './types.js';

export interface ConditionResult {
  action: 'retry' | 'blocked' | 'goto' | 'continue' | 'done';
  newRetryCount?: number;
  gotoTask?: TaskNumber;
  message?: string;
}

/**
 * Evaluate the FAIL condition for a task.
 *
 * @param task - The task with conditions
 * @param currentRetryCount - Current retry count
 * @param retryMax - Maximum retries allowed
 * @returns Action to take based on FAIL condition
 */
export function evaluateFailCondition(
  task: Task,
  currentRetryCount: number,
  retryMax: number
): ConditionResult {
  if (!task.conditions) {
    return {
      action: 'blocked',
      message: 'No FAIL condition defined for task'
    };
  }

  const failAction = task.conditions.fail;

  switch (failAction.type) {
    case 'RETRY': {
      const newCount = currentRetryCount + 1;
      const max = failAction.max ?? retryMax;

      if (newCount > max) {
        return {
          action: 'blocked',
          message: `Max retries exceeded (${String(max)})`
        };
      }

      return {
        action: 'retry',
        newRetryCount: newCount
      };
    }

    case 'STOP':
      return {
        action: 'blocked',
        message: failAction.message
      };

    case 'GOTO':
      return {
        action: 'goto',
        gotoTask: failAction.task
      };

    case 'CONTINUE':
      return { action: 'continue' };

    case 'DONE':
      return { action: 'continue' };

    default:
      return {
        action: 'blocked',
        message: 'Unknown FAIL action'
      };
  }
}

/**
 * Evaluate the PASS condition for a task.
 *
 * @param task - The task with conditions
 * @returns Action to take based on PASS condition
 */
export function evaluatePassCondition(task: Task): ConditionResult {
  if (!task.conditions) {
    // Default: PASS means continue to next task
    return { action: 'continue' };
  }

  const passAction = task.conditions.pass;

  switch (passAction.type) {
    case 'DONE':
      return { action: 'done' };

    case 'GOTO':
      return {
        action: 'goto',
        gotoTask: passAction.task
      };

    case 'STOP':
      return {
        action: 'blocked',
        message: passAction.message
      };

    case 'CONTINUE':
      return { action: 'continue' };

    case 'RETRY':
      // RETRY doesn't make sense for PASS, treat as continue
      return { action: 'continue' };

    default:
      return { action: 'continue' };
  }
}


/**
 * Evaluate aggregation conditions across subtask results.
 *
 * Returns null if not all subtasks are complete (can't evaluate yet).
 * Otherwise returns the appropriate ConditionResult based on:
 * - all: true  → PASS ALL, FAIL ANY
 * - all: false → PASS ANY, FAIL ALL
 */
export function evaluateSubtaskAggregation(
  subtaskStates: readonly SubtaskState[],
  conditions: { all: boolean; pass: Action; fail: Action }
): ConditionResult | null {
  // Check if all subtasks are done
  const allDone = subtaskStates.every(s => s.status === 'done');
  if (!allDone) {
    return null;
  }

  const passCount = subtaskStates.filter(s => s.result === 'pass').length;

  if (conditions.all) {
    // PASS ALL, FAIL ANY
    const anyFailed = subtaskStates.some(s => s.result === 'fail');
    if (anyFailed) {
      return evaluateAction(conditions.fail);
    }
    return evaluateAction(conditions.pass);
  } else {
    // PASS ANY, FAIL ALL
    if (passCount > 0) {
      return evaluateAction(conditions.pass);
    }
    return evaluateAction(conditions.fail);
  }
}

function evaluateAction(action: Action): ConditionResult {
  switch (action.type) {
    case 'CONTINUE':
      return { action: 'continue' };
    case 'STOP':
      return { action: 'blocked', message: action.message };
    case 'GOTO':
      return { action: 'goto', gotoTask: action.task };
    case 'DONE':
      return { action: 'done' };
    case 'RETRY':
      return { action: 'retry' };
    default:
      return { action: 'continue' };
  }
}
