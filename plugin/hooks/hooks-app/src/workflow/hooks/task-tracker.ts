// src/workflow/hooks/task-tracker.ts
import { WorkflowStateManager } from '../state';
import type { HookInput } from '../../types';
import type { TaskState } from '../types';

function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `task-${timestamp}-${random}`;
}

/**
 * Track Task tool dispatches in workflow state
 *
 * Note: This uses a read-modify-write pattern which has a theoretical race
 * condition if multiple Task tools are dispatched simultaneously. In practice,
 * Claude Code dispatches tasks sequentially, so this is not a concern.
 * If concurrent dispatch becomes supported, consider file locking.
 */
export async function trackTaskDispatch(input: HookInput): Promise<void> {
  // Only handle Task tool
  if (input.tool_name !== 'Task') {
    return;
  }

  const manager = new WorkflowStateManager(input.cwd);

  try {
    const state = await manager.getActive();

    // No active workflow, nothing to track
    if (!state) {
      return;
    }

    // Create task entry
    const task: TaskState = {
      id: generateTaskId(),
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    // Add task to state
    await manager.update(state.id, {
      tasks: [...state.tasks, task],
    });
  } catch (error) {
    // Log but don't throw - task tracking is non-critical
    // The workflow should continue even if tracking fails
    console.error('Failed to track task dispatch:', error);
  }
}
