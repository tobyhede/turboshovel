// src/workflow/context.ts
import { WorkflowStateManager } from './state.js';
import type { WorkflowState } from './types.js';

/**
 * Get workflow context for injection into agent prompts
 */
export async function getWorkflowContext(cwd: string): Promise<string | null> {
  const manager = new WorkflowStateManager(cwd);
  const state = await manager.getActive();

  if (!state) {
    return null;
  }

  return formatWorkflowContext(state);
}

function formatWorkflowContext(state: WorkflowState): string {
  const lines: string[] = [];

  lines.push('## Active Workflow');
  lines.push('');
  lines.push(`**Workflow:** ${state.workflow}`);
  lines.push(`**Task ${state.task}:** ${state.taskName}`);

  // Show retry info if relevant
  if (state.retryCount > 0) {
    lines.push(`**Attempt:** ${state.retryCount + 1} of ${state.retryMax}`);
  }

  // Show task progress if there are tasks
  if (state.tasks.length > 0) {
    const complete = state.tasks.filter((t) => t.status === 'complete').length;
    const running = state.tasks.filter((t) => t.status === 'running').length;
    const blocked = state.tasks.filter((t) => t.status === 'blocked').length;

    lines.push('');
    lines.push(`**Tasks:** ${complete}/${state.tasks.length} complete`);

    if (running > 0) {
      lines.push(`  - ${running} running`);
    }
    if (blocked > 0) {
      lines.push(`  - ${blocked} blocked`);
    }
  }

  // Show variables
  if (Object.keys(state.variables).length > 0) {
    lines.push('');
    lines.push('**Variables:**');
    for (const [key, value] of Object.entries(state.variables)) {
      lines.push(`  - ${key}: ${value}`);
    }
  }

  // BLOCKED warning (using ASCII for terminal compatibility)
  if (state.variables.has_blocked_task || state.variables.blocked) {
    lines.push('');
    lines.push('*** WORKFLOW BLOCKED *** - Present options to user before continuing.');
  }

  // Next action guidance
  lines.push('');
  lines.push('**Actions:**');
  lines.push('- Continue: `workflow next`');
  lines.push('- Jump to task: `workflow next --task N`');
  lines.push('- Abort: `workflow stop`');

  return lines.join('\n');
}
