import { type HookInput, type GateResult } from '@turboshovel/shared';
import { trackTaskDispatch } from '../workflow/hooks/task-tracker.js';

/**
 * Workflow Task Tracker Gate
 *
 * Wraps trackTaskDispatch logic as a configurable gate.
 * Enforces TaskId prefix on Task tool descriptions when workflow is active.
 */
export async function execute(input: HookInput): Promise<GateResult> {
  const result = await trackTaskDispatch(input);

  if (result.violation) {
    return {
      decision: 'block',
      reason: result.violation
    };
  }

  return {};
}
