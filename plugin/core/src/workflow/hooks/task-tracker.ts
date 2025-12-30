// src/workflow/hooks/task-tracker.ts
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  WorkflowStateManager,
  parseTaskIdFromString,
  taskIdToString,
  parseWorkflow,
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
 * 3. Call CLI to start workflow for task
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
    const description = input.tool_input?.description ?? '';
    const taskId = parseTaskIdFromString(description, { requireSeparator: true });

    // VIOLATION: Task without TaskId prefix
    if (!taskId) {
      return {
        violation:
          `Task description must start with TaskId (e.g., "3.1 - Review code"). ` +
          `Got: "${description.substring(0, DESCRIPTION_DISPLAY_LIMIT)}${description.length > DESCRIPTION_DISPLAY_LIMIT ? '...' : ''}"`
      };
    }

    // Determine workflow from parent workflow's subtask definition
    const workflow = await getSubtaskWorkflow(input.cwd, taskId);

    // Build CLI command
    const taskIdStr = taskIdToString(taskId);
    const cmd = workflow
      ? `tsv start --task ${taskIdStr} ${workflow}`
      : `tsv start --task ${taskIdStr}`;

    try {
      execSync(cmd, { cwd: input.cwd, stdio: 'pipe' });
      return { taskId };
    } catch (error) {
      // CLI returned non-zero - likely no active workflow or other issue
      return {};
    }
  } catch (error) {
    // Log but don't throw - task tracking is non-critical
    console.error('Failed to track task dispatch:', error);
    return {};
  }
}

/**
 * Get workflow for a subtask from the parent workflow definition.
 * Handles both dynamic subtasks ({n}) and static subtasks.
 */
async function getSubtaskWorkflow(cwd: string, taskId: TaskId): Promise<string | undefined> {
  const manager = new WorkflowStateManager(cwd);
  const state = await manager.getActive();
  if (!state) return undefined;

  // Load and parse the workflow file
  const workflowPath = path.join(cwd, state.workflow);
  let content: string;
  try {
    content = await fs.readFile(workflowPath, 'utf8');
  } catch {
    return undefined;  // Workflow file not found
  }
  const tasks = parseWorkflow(content);

  // Find the task containing this subtask
  const task = tasks[taskId.task - 1];
  if (!task || !task.subtasks || !taskId.subtask) return undefined;

  // Parse subtask index - handle non-numeric IDs gracefully
  const subtaskIndex = parseInt(taskId.subtask, 10);
  if (isNaN(subtaskIndex) || subtaskIndex < 1) {
    // Non-numeric subtask ID (e.g., "1.a") - no workflow assignment
    return undefined;
  }

  // Try to find matching static subtask first
  const staticSubtask = task.subtasks.find(
    s => !s.isDynamic && s.id === taskId.subtask
  );
  if (staticSubtask?.workflows?.length) {
    return staticSubtask.workflows[0];  // Static subtask uses first workflow
  }

  // Fall back to dynamic subtask template
  const dynamicSubtask = task.subtasks.find(s => s.isDynamic);
  if (!dynamicSubtask?.workflows?.length) return undefined;

  // Cycle through workflow list for dynamic subtasks
  const workflowIndex = (subtaskIndex - 1) % dynamicSubtask.workflows.length;
  return dynamicSubtask.workflows[workflowIndex];
}
