// src/workflow/hooks/subagent-stop.ts
import {
  WorkflowStateManager,
  type HookInput
} from '@turboshovel/shared';
import { execSync as nodeExecSync } from 'child_process';

export interface SubagentStopResult {
  context?: string;
  violation?: string;
}

// Allow dependency injection for testing
let execSyncImpl = nodeExecSync;

export function setExecSync(fn: typeof nodeExecSync): void {
  execSyncImpl = fn;
}

/**
 * Parse STATUS field from subagent output
 */
function parseAgentStatus(output?: string): 'pass' | 'fail' {
  if (!output) return 'pass';

  const match = /STATUS:\s*(OK|PASS|BLOCKED|FAIL)/i.exec(output);
  if (!match) return 'pass';

  const status = match[1].toUpperCase();
  return status === 'OK' || status === 'PASS' ? 'pass' : 'fail';
}

/**
 * Handle SubagentStop hook
 */
export async function handleSubagentStop(input: HookInput): Promise<SubagentStopResult> {
  if (input.hook_event_name !== 'SubagentStop') {
    return {};
  }

  const agentId = input.agent_id;
  if (!agentId) return {};

  const status = parseAgentStatus(input.output);
  const passFlag = status === 'pass' ? '--pass' : '--fail';

  try {
    const manager = new WorkflowStateManager(input.cwd);
    const state = await manager.getActive();

    if (state?.agentBindings?.[agentId]) {
      const binding = state.agentBindings[agentId];
      if (binding.stepId.substep) {
        await manager.completeSubstep(
          state.id,
          binding.stepId.substep,
          status
        );
      }
    }

    const command = passFlag === '--pass' ? 'pass' : 'fail';
    const output = execSyncImpl(`tsv ${command} --agent ${agentId}`, {
      cwd: input.cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const context = formatCompletionContext(output, agentId, status);
    return { context };
  } catch (error: unknown) {
    const execError = error as { stderr?: Buffer | string };
    const stderr = execError.stderr?.toString() ?? '';
    if (stderr.includes('No binding for agent')) {
      return {
        violation: `SubagentStop for unknown agent: ${agentId}`
      };
    }
    return {};
  }
}

function formatCompletionContext(
  cliOutput: string,
  agentId: string,
  result: 'pass' | 'fail'
): string {
  const lines: string[] = [];

  if (result === 'fail') {
    lines.push(`Agent ${agentId} FAILED.`);
  } else {
    lines.push(`Agent ${agentId} complete.`);
  }

  if (cliOutput?.trim()) {
    lines.push(cliOutput);
  }

  return lines.join('\n');
}