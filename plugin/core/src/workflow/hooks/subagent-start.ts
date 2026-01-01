import { execSync } from 'child_process';
import { WorkflowStateManager } from '@turboshovel/shared';
import type { HookInput } from '@turboshovel/shared';

export interface SubagentStartResult {
  context?: string;
  violation?: string;
}

/**
 * Handle SubagentStart hook
 *
 * Flow:
 * 1. Get active workflow
 * 2. Pop pending task from queue
 * 3. Call CLI: tsv start --agent {agentId}
 * 4. If task has subtask, bind agent to subtask
 * 5. Parse CLI output for context injection
 * 6. Return context with agent binding info
 */
export async function handleSubagentStart(input: HookInput): Promise<SubagentStartResult> {
  if (input.hook_event_name !== 'SubagentStart') {
    return {};
  }

  const agentId = input.agent_id;
  if (!agentId) {
    return {}; // No agent_id available, skip (graceful degradation)
  }

  const manager = new WorkflowStateManager(input.cwd);

  try {
    // Get active workflow and peek at pending task (without popping yet)
    const state = await manager.getActive();
    if (!state) {
      // CLI will handle this error
      return handleCliCall(input.cwd, agentId);
    }

    // Peek at pending task to check if it has a subtask
    const pending = state.pendingTasks[0];

    // Call CLI which will pop the task and bind agent
    const output = execSync(`tsv start --agent ${agentId}`, {
      cwd: input.cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // If task has subtask, also update subtaskState
    if (pending?.taskId.subtask) {
      await manager.bindSubtaskAgent(state.id, pending.taskId.subtask, agentId);
    }

    // Parse output for context injection
    const context = parseStartAgentOutput(output, agentId);
    return { context };
  } catch (error) {
    // CLI returned non-zero
    const stderr = (error as any).stderr?.toString() ?? '';
    if (stderr.includes('No pending task')) {
      return {
        violation: 'SubagentStart with no pending task. Task dispatch must precede agent start.'
      };
    }
    return {};
  }
}

async function handleCliCall(cwd: string, agentId: string): Promise<SubagentStartResult> {
  try {
    const output = execSync(`tsv start --agent ${agentId}`, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const context = parseStartAgentOutput(output, agentId);
    return { context };
  } catch (error) {
    const stderr = (error as any).stderr?.toString() ?? '';
    if (stderr.includes('No pending task')) {
      return {
        violation: 'SubagentStart with no pending task. Task dispatch must precede agent start.'
      };
    }
    return {};
  }
}

function parseStartAgentOutput(output: string, agentId: string): string {
  // Format context for subagent
  const lines = [
    '## Workflow Agent Context',
    '',
    `AGENT_ID: ${agentId}`,
    ''
  ];

  // Extract task ID and workflow from output
  const taskMatch = /bound to task (\d+(?:\.\d+)?)/.exec(output);
  if (taskMatch) {
    lines.push(`TASK_ID: ${taskMatch[1]}`);
  }

  const workflowMatch = /Started child workflow: (.+)/.exec(output);
  if (workflowMatch) {
    lines.push(`WORKFLOW: ${workflowMatch[1]}`);
  }

  lines.push('', '## Commands', '');
  lines.push(`tsv next --pass --agent ${agentId}`);
  lines.push(`tsv next --fail --agent ${agentId}`);
  lines.push('');

  return lines.join('\n');
}
