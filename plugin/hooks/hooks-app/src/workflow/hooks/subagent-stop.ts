// src/workflow/hooks/subagent-stop.ts
import { WorkflowStateManager } from '../state';
import type { HookInput } from '../../types';
import type { TaskState } from '../types';
import { logger } from '../../logger';

/**
 * Parse STATUS field from subagent output
 */
function parseAgentStatus(output?: string): 'ok' | 'blocked' | null {
  if (!output) return null;

  // Look for STATUS: OK or STATUS: BLOCKED
  const match = output.match(/STATUS:\s*(OK|BLOCKED)/i);
  if (match) {
    return match[1].toLowerCase() as 'ok' | 'blocked';
  }

  return null;
}

/**
 * Handle subagent completion
 */
export async function handleSubagentStop(input: HookInput): Promise<string | undefined> {
  if (input.hook_event_name !== 'SubagentStop') {
    return undefined;
  }

  const manager = new WorkflowStateManager(input.cwd);

  try {
    const state = await manager.getActive();

    if (!state) {
      return undefined;
    }

    // Find running task
    const runningTaskIndex = state.tasks.findIndex(t => t.status === 'running');
    if (runningTaskIndex === -1) {
      return undefined;
    }

    // Parse status from output
    const status = parseAgentStatus(input.output);
    const isBlocked = status === 'blocked';

    // Update task
    const updatedTasks = [...state.tasks];
    updatedTasks[runningTaskIndex] = {
      ...updatedTasks[runningTaskIndex],
      status: isBlocked ? 'blocked' : 'complete',
      completedAt: new Date().toISOString(),
    };

    // Update state
    const variables = { ...state.variables };
    if (isBlocked) {
      variables.has_blocked_task = true;
    }

    await manager.update(state.id, { tasks: updatedTasks, variables });

    // Check if all tasks done
    const allDone = updatedTasks.every(t => t.status !== 'running' && t.status !== 'pending');

    if (isBlocked) {
      return `Task BLOCKED. Present options to user before continuing.`;
    }

    if (allDone) {
      return `All tasks in batch complete. Run: workflow next`;
    }

    return `Task complete. ${updatedTasks.filter(t => t.status === 'complete').length}/${updatedTasks.length} tasks done.`;
  } catch (error) {
    // Log error but return graceful message
    logger.warn('Failed to handle subagent stop', {
      error: error instanceof Error ? error.message : String(error),
    });
    return `Warning: Failed to update workflow state. Check logs for details.`;
  }
}
