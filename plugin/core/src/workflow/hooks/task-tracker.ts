// src/workflow/hooks/task-tracker.ts
import {
  WorkflowStateManager,
  parseTaskIdFromString,
  taskIdToString,
  type TaskId,
  type HookInput
} from '@turboshovel/shared';

/** Maximum characters to show in task description before truncation */
const DESCRIPTION_DISPLAY_LIMIT = 60;

export interface TaskDispatchResult {
  taskId?: TaskId;
  violation?: string;
}

/**
 * Track Task tool dispatches in workflow state
 *
 * When workflow is active:
 * 1. Parse TaskId from tool_input.description
 * 2. If no TaskId prefix, return violation (enforcement)
 * 3. Push TaskId to pending queue
 *
 * When no workflow or stashed: pass through silently
 */
export async function trackTaskDispatch(input: HookInput): Promise<TaskDispatchResult> {
  // Only handle Task tool
  if (input.tool_name !== 'Task') {
    return {};
  }

  const manager = new WorkflowStateManager(input.cwd);

  try {
    const state = await manager.getActive();

    // No active workflow = pass through silently (enforcement off)
    if (!state) {
      return {};
    }

    // Check if workflow is stashed (enforcement paused)
    const stashedId = await manager.getStashedWorkflowId();
    if (stashedId) {
      return {}; // Enforcement paused
    }

    // Parse TaskId from description
    const description = input.tool_input?.description || '';
    const taskId = parseTaskIdFromString(description, { requireSeparator: true });

    // VIOLATION: Task without TaskId prefix
    if (!taskId) {
      return {
        violation:
          `Task description must start with TaskId (e.g., "3.1 - Review code"). ` +
          `Got: "${description.substring(0, DESCRIPTION_DISPLAY_LIMIT)}${description.length > DESCRIPTION_DISPLAY_LIMIT ? '...' : ''}"`
      };
    }

    // Push to pending queue
    await manager.pushPendingTask(state.id, taskId);

    return { taskId };
  } catch (error) {
    // Log but don't throw - task tracking is non-critical
    console.error('Failed to track task dispatch:', error);
    return {};
  }
}
