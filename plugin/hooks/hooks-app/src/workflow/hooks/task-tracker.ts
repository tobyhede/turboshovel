// src/workflow/hooks/task-tracker.ts
import { WorkflowStateManager } from '../state';
import type { HookInput } from '../../types';
import type { TaskState } from '../types';
import { logger } from '../../logger';

/**
 * Generate a unique task ID.
 *
 * Format: `task-{timestamp}-{random}` where:
 * - timestamp: Base36-encoded milliseconds since epoch (compact, sortable)
 * - random: 4 chars of base36 random (slice(2,6) skips "0." prefix from Math.random)
 *
 * Example: `task-m5kx7p2-a1b2`
 *
 * Collision probability: ~1.7 million possible values per millisecond (36^4).
 * With sequential dispatch, practical collision risk is zero.
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `task-${timestamp}-${random}`;
}

/**
 * Track Task tool dispatches in workflow state
 *
 * ## Race Condition Analysis
 *
 * This uses a read-modify-write pattern with a theoretical race condition if
 * multiple Task tools dispatch simultaneously. Risk assessment:
 *
 * - **Current risk:** Negligible. Claude Code dispatches tasks sequentially
 *   within a conversation.
 * - **Impact if race occurs:** Task entries may be lost from state, but workflow
 *   continues. This is non-critical tracking data.
 * - **Mitigation considered:** File locking via `lockfile` package was considered
 *   but adds complexity for a near-zero probability event.
 *
 * If concurrent Task dispatch becomes supported in future Claude Code versions,
 * add file locking or atomic JSON update pattern.
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
    logger.warn('Failed to track task dispatch', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
