import { type HookInput, type GateResult } from '@turboshovel/shared';
import { handleSubagentStart } from '../workflow/hooks/subagent-start.js';

/**
 * Workflow Subagent Start Gate
 *
 * Wraps handleSubagentStart logic as a configurable gate.
 * Binds agents to pending tasks when workflow is active.
 */
export async function execute(input: HookInput): Promise<GateResult> {
  const result = await handleSubagentStart(input);

  if (result.violation) {
    return {
      decision: 'block',
      reason: result.violation
    };
  }

  if (result.context) {
    return { additionalContext: result.context };
  }

  return {};
}
