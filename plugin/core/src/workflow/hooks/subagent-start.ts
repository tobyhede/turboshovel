import { WorkflowStateManager } from '../state';
import { taskIdToString, type TaskId } from '../task-id';
import type { HookInput } from '../../types';

export interface SubagentStartResult {
  context?: string;
  violation?: string;
}

/**
 * Handle SubagentStart hook
 *
 * Flow:
 * 1. Pop pending task from queue
 * 2. Bind agent_id to TaskId
 * 3. Inject agent_id context for subagent
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
    const state = await manager.getActive();

    // No active workflow = pass through silently
    if (!state) {
      return {};
    }

    // Check if workflow is stashed
    const stashedId = await manager.getStashedWorkflowId();
    if (stashedId) {
      return {}; // Enforcement paused
    }

    // Pop pending task
    const taskId = await manager.popPendingTask(state.id);

    // VIOLATION: No pending task
    if (!taskId) {
      return {
        violation:
          `SubagentStart with no pending task. ` +
          `Task dispatch must precede agent start. ` +
          `Ensure Task tool is used before subagent starts.`
      };
    }

    // Bind agent to task
    await manager.bindAgent(state.id, agentId, taskId);

    // Inject context for subagent
    const context = formatAgentContext(agentId, taskId);

    return { context };
  } catch (error) {
    console.error('Failed to handle subagent start:', error);
    return {};
  }
}

function formatAgentContext(agentId: string, taskId: TaskId): string {
  return [
    '## Workflow Agent Context',
    '',
    `AGENT_ID: ${agentId}`,
    `TASK_ID: ${taskIdToString(taskId)}`,
    '',
    'If you need to run workflow commands, use:',
    `  workflow next --pass --agent ${agentId}`,
    `  workflow next --fail --agent ${agentId}`,
    ''
  ].join('\n');
}
