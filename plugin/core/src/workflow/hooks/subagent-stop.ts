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

  // Look for STATUS: OK/PASS or STATUS: BLOCKED/FAIL
  const match = /STATUS:\s*(OK|PASS|BLOCKED|FAIL)/i.exec(output);
  if (!match) return 'pass';

  const status = match[1].toUpperCase();
  return status === 'OK' || status === 'PASS' ? 'pass' : 'fail';
}

/**
 * Handle SubagentStop hook
 *
 * Flow:
 * 1. Parse agent status from output
 * 2. Check if agent is bound to a subtask, and if so, complete it
 * 3. Call CLI to advance workflow
 * 4. Report completion context
 */
export async function handleSubagentStop(input: HookInput): Promise<SubagentStopResult> {
  if (input.hook_event_name !== 'SubagentStop') {
    return {};
  }

  const agentId = input.agent_id;
  if (!agentId) {
    // Fall back to legacy behavior (find first running task)
    return handleLegacySubagentStop(input);
  }

  // Parse status from agent output
  const status = parseAgentStatus(input.output);
  const passFlag = status === 'pass' ? '--pass' : '--fail';

  try {
    // Check if agent is bound to a subtask and complete it
    const manager = new WorkflowStateManager(input.cwd);
    const state = await manager.getActive();

    if (state?.agentBindings && state.agentBindings[agentId]) {
      const binding = state.agentBindings[agentId];
      // If agent was bound to subtask, complete the subtask
      if (binding.taskId.subtask) {
        await manager.completeSubtask(
          state.id,
          binding.taskId.subtask,
          binding.result ?? 'pass'
        );
      }
    }

    const output = execSyncImpl(`tsv next ${passFlag} --agent ${agentId}`, {
      cwd: input.cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Format completion context
    const context = formatCompletionContext(output, agentId, status);
    return { context };
  } catch (error: unknown) {
    // CLI returned non-zero
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

  // Include CLI output if available
  if (cliOutput?.trim()) {
    lines.push(cliOutput);
  }

  return lines.join('\n');
}

/**
 * Legacy fallback: find first running task (for backwards compatibility)
 */
async function handleLegacySubagentStop(input: HookInput): Promise<SubagentStopResult> {
  const manager = new WorkflowStateManager(input.cwd);
  const state = await manager.getActive();

  if (!state) return {};

  // Find running task
  const runningIndex = state.tasks.findIndex((t) => t.status === 'running');
  if (runningIndex === -1) return {};

  const isBlocked = parseAgentStatus(input.output) === 'fail';

  const updatedTasks = [...state.tasks];
  updatedTasks[runningIndex] = {
    ...updatedTasks[runningIndex],
    status: isBlocked ? 'blocked' : 'complete',
    completedAt: new Date().toISOString()
  };

  await manager.update(state.id, { tasks: updatedTasks });

  if (isBlocked) {
    return { context: 'Task BLOCKED. Present options to user.' };
  }

  const allDone = updatedTasks.every((t) => t.status !== 'running' && t.status !== 'pending');
  if (allDone) {
    return { context: 'All tasks complete. Run: workflow next' };
  }

  return {
    context: `Task complete. ${String(updatedTasks.filter((t) => t.status === 'complete').length)}/${String(updatedTasks.length)} done.`
  };
}
