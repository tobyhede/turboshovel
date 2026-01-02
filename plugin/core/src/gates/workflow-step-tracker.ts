import { type HookInput, type GateResult } from '@turboshovel/shared';
import { trackStepDispatch } from '../workflow/hooks/step-tracker.js';

/**
 * Workflow Step Tracker Gate
 *
 * Wraps trackStepDispatch logic as a configurable gate.
 * Enforces StepId prefix on Step tool descriptions when workflow is active.
 */
export async function execute(input: HookInput): Promise<GateResult> {
  const result = await trackStepDispatch(input);

  if (result.violation) {
    return {
      decision: 'block',
      reason: result.violation
    };
  }

  return {};
}