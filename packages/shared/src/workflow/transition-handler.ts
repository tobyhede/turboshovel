import type { Step, SubstepState, Action, NonRetryAction, StepId } from './types.js';

export interface ConditionResult {
  action: 'retry' | 'stopped' | 'goto' | 'continue' | 'complete' | 'next';
  newRetryCount?: number;
  gotoTarget?: StepId;
  message?: string;
}

/**
 * Evaluate the FAIL condition for a step.
 */
export function evaluateFailCondition(
  step: Step,
  currentRetryCount: number
): ConditionResult {
  if (!step.transitions) {
    return {
      action: 'stopped',
      message: 'No FAIL condition defined for step'
    };
  }

  const failAction = step.transitions.fail;

  switch (failAction.type) {
    case 'RETRY': {
      const newCount = currentRetryCount + 1;

      if (newCount > failAction.max) {
        return evaluateNonRetryAction(failAction.then);
      }

      return {
        action: 'retry',
        newRetryCount: newCount
      };
    }

    case 'STOP':
      return {
        action: 'stopped',
        message: failAction.message
      };

    case 'GOTO':
      return {
        action: 'goto',
        gotoTarget: failAction.target
      };

    case 'CONTINUE':
    case 'COMPLETE':
      return { action: 'continue' };

    case 'NEXT':
      return { action: 'next' };

    default:
      return {
        action: 'stopped',
        message: 'Unknown FAIL action'
      };
  }
}

/**
 * Evaluate the PASS condition for a step.
 */
export function evaluatePassCondition(step: Step): ConditionResult {
  if (!step.transitions) {
    return { action: 'continue' };
  }

  const passAction = step.transitions.pass;

  switch (passAction.type) {
    case 'COMPLETE':
      return { action: 'complete' };

    case 'GOTO':
      return {
        action: 'goto',
        gotoTarget: passAction.target
      };

    case 'STOP':
      return {
        action: 'stopped',
        message: passAction.message
      };

    case 'CONTINUE':
    case 'RETRY':
      return { action: 'continue' };

    case 'NEXT':
      return { action: 'next' };

    default:
      return { action: 'continue' };
  }
}

/**
 * Evaluate aggregation conditions across substep results.
 */
export function evaluateSubstepAggregation(
  substepStates: readonly SubstepState[],
  transitions: { all: boolean; pass: Action; fail: Action }
): ConditionResult | null {
  const allDone = substepStates.every(s => s.status === 'done');
  if (!allDone) return null;

  const passCount = substepStates.filter(s => s.result === 'pass').length;

  if (transitions.all) {
    const anyFailed = substepStates.some(s => s.result === 'fail');
    if (anyFailed) return evaluateAction(transitions.fail);
    return evaluateAction(transitions.pass);
  } else {
    if (passCount > 0) return evaluateAction(transitions.pass);
    return evaluateAction(transitions.fail);
  }
}

function evaluateNonRetryAction(action: NonRetryAction): ConditionResult {
  switch (action.type) {
    case 'CONTINUE':
      return { action: 'continue' };
    case 'STOP':
      return { action: 'stopped', message: action.message };
    case 'COMPLETE':
      return { action: 'complete' };
    case 'GOTO':
      return { action: 'goto', gotoTarget: action.target };
    case 'NEXT':
      return { action: 'next' };
  }
}

function evaluateAction(action: Action): ConditionResult {
  if (action.type === 'RETRY') return { action: 'retry' };
  return evaluateNonRetryAction(action);
}