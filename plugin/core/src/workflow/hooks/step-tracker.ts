// src/workflow/hooks/step-tracker.ts
import { execSync } from 'child_process';
import type { HookInput } from '@turboshovel/shared';

export interface StepDispatchResult {
  violation?: string;
}

/**
 * Track Step tool dispatches in workflow state
 */
export async function trackStepDispatch(input: HookInput): Promise<StepDispatchResult> {
  // Handle both Step and Task tool (Task for backward compatibility/LLM training)
  if (input.tool_name !== 'Step' && input.tool_name !== 'Task') {
    return {};
  }

  try {
    const description = input.tool_input?.description ?? '';

    if (!description.trim()) {
      return {
        violation: 'Step description cannot be empty'
      };
    }

    const cmd = `rundown run --step "${description}"`;

    try {
      execSync(cmd, { cwd: input.cwd, stdio: 'pipe' });
      return {};
    } catch {
      return {};
    }
  } catch (error: unknown) {
    console.error('Failed to track step dispatch:', error);
    return {};
  }
}