// src/workflow/hooks/subagent-stop.ts
import {
  WorkflowStateManager,
  taskIdToString,
  type HookInput,
  type AgentBinding
} from '@turboshovel/shared';

export interface SubagentStopResult {
  context?: string;
  violation?: string;
}

/**
 * Parse STATUS field from subagent output
 */
function parseAgentStatus(output?: string): 'pass' | 'fail' | null {
  if (!output) return null;

  // Look for STATUS: OK/PASS or STATUS: BLOCKED/FAIL
  const match = output.match(/STATUS:\s*(OK|PASS|BLOCKED|FAIL)/i);
  if (match) {
    const status = match[1].toUpperCase();
    return status === 'OK' || status === 'PASS' ? 'pass' : 'fail';
  }

  return null;
}

/**
 * Handle SubagentStop hook
 *
 * Flow:
 * 1. Lookup agent binding by agent_id
 * 2. Determine pass/fail from output
 * 3. Update binding status
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

  const manager = new WorkflowStateManager(input.cwd);

  try {
    const state = await manager.getActive();

    if (!state) {
      return {};
    }

    // Check if stashed
    const stashedId = await manager.getStashedWorkflowId();
    if (stashedId) {
      return {};
    }

    // Lookup agent binding
    const binding = await manager.getAgentBinding(state.id, agentId);

    // VIOLATION: Unknown agent
    if (!binding) {
      return {
        violation:
          `SubagentStop for unknown agent ${agentId}. ` + `Agent was not bound at SubagentStart.`
      };
    }

    // Determine result
    const result = parseAgentStatus(input.output) || 'pass'; // Default to pass

    // Update binding
    await manager.updateAgentBinding(state.id, agentId, {
      status: 'done',
      result
    });

    // Generate completion context
    const context = await formatCompletionContext(state.id, binding, result, manager);

    return { context };
  } catch (error) {
    console.error('Failed to handle subagent stop:', error);
    return { context: 'Warning: Failed to update workflow state.' };
  }
}

async function formatCompletionContext(
  workflowId: string,
  binding: AgentBinding,
  result: 'pass' | 'fail',
  manager: WorkflowStateManager
): Promise<string> {
  const taskIdStr = taskIdToString(binding.taskId);
  const lines: string[] = [];

  if (result === 'fail') {
    lines.push(`Task ${taskIdStr} FAILED.`);
  } else {
    lines.push(`Task ${taskIdStr} complete.`);
  }

  // Check how many agents still running
  const state = await manager.load(workflowId);
  if (state) {
    const bindings = Object.values(state.agentBindings || {});
    const running = bindings.filter((b) => b.status === 'running').length;
    const done = bindings.filter((b) => b.status === 'done').length;
    const failed = bindings.filter((b) => b.result === 'fail').length;

    if (running > 0) {
      lines.push(`${done}/${done + running} tasks done. Waiting for ${running} more.`);
    } else {
      if (failed > 0) {
        lines.push(`All tasks complete. ${failed} failed.`);
        lines.push(`Run: workflow next --fail`);
      } else {
        lines.push(`All tasks complete.`);
        lines.push(`Run: workflow next --pass`);
      }
    }
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
    context: `Task complete. ${updatedTasks.filter((t) => t.status === 'complete').length}/${updatedTasks.length} done.`
  };
}
