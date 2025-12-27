import type { Task, TaskNumber } from '@turboshovel/shared';

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
          message: `Max retries exceeded (${max})`
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
