import { execSync } from 'child_process';
import { WorkflowStateManager } from '@turboshovel/shared';
import type { HookInput } from '@turboshovel/shared';

export interface SubagentStartResult {
  context?: string;
  violation?: string;
}

interface ExecSyncError extends Error {
  stderr?: Buffer | string;
}

function isExecSyncError(error: unknown): error is ExecSyncError {
  return error instanceof Error && 'status' in error && 'stderr' in error;
}

/**
 * Handle SubagentStart hook
 */
export async function handleSubagentStart(input: HookInput): Promise<SubagentStartResult> {
  if (input.hook_event_name !== 'SubagentStart') {
    return {};
  }

  const agentId = input.agent_id;
  if (!agentId) {
    return {};
  }

  const manager = new WorkflowStateManager(input.cwd);

  try {
    const state = await manager.getActive();
    if (!state) {
      return handleCliCall(input.cwd, agentId);
    }

    const pending = state.pendingSteps[0];

    const output = execSync(`tsv run --agent ${agentId}`, {
      cwd: input.cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    if (pending.stepId.substep) {
      await manager.bindSubstepAgent(state.id, pending.stepId.substep, agentId);
    }

    const context = parseStartAgentOutput(output, agentId);
    return { context };
  } catch (error) {
    if (!isExecSyncError(error)) {
      return {};
    }
    const stderr = error.stderr?.toString() ?? '';
    if (stderr.includes('No pending step')) {
      return {
        violation: 'SubagentStart with no pending step. Step dispatch must precede agent start.'
      };
    }
    return {};
  }
}

function handleCliCall(cwd: string, agentId: string): SubagentStartResult {
  try {
    const output = execSync(`tsv run --agent ${agentId}`, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const context = parseStartAgentOutput(output, agentId);
    return { context };
  } catch (error) {
    if (!isExecSyncError(error)) {
      return {};
    }
    const stderr = error.stderr?.toString() ?? '';
    if (stderr.includes('No pending step')) {
      return {
        violation: 'SubagentStart with no pending step. Step dispatch must precede agent start.'
      };
    }
    return {};
  }
}

function parseStartAgentOutput(output: string, agentId: string): string {
  const lines = [
    '## Workflow Agent Context',
    '',
    `AGENT_ID: ${agentId}`,
    ''
  ];

  const stepMatch = /bound to step (\d+(?:\.\d+)?)/.exec(output);
  if (stepMatch) {
    lines.push(`STEP_ID: ${stepMatch[1]}`);
  }

  const workflowMatch = /Started child workflow: (.+)/.exec(output);
  if (workflowMatch) {
    lines.push(`WORKFLOW: ${workflowMatch[1]}`);
  }

  lines.push('', '## Commands', '');
  lines.push(`tsv pass --agent ${agentId}`);
  lines.push(`tsv fail --agent ${agentId}`);
  lines.push('');

  return lines.join('\n');
}