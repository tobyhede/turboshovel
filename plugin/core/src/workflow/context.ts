// src/workflow/context.ts
import { WorkflowStateManager, type WorkflowState } from '@turboshovel/shared';

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
  lines.push(`**Step ${String(state.step)}:** ${state.stepName}`);

  // Show retry info if relevant
  if (state.retryCount > 0) {
    lines.push(`**Attempt:** ${String(state.retryCount + 1)}`);
  }

  // Show variables
  if (Object.keys(state.variables).length > 0) {
    lines.push('');
    lines.push('**Variables:**');
    for (const [key, value] of Object.entries(state.variables)) {
      lines.push(`  - ${key}: ${String(value)}`);
    }
  }

  // BLOCKED warning
  if (state.variables.stopped) {
    lines.push('');
    lines.push('*** WORKFLOW BLOCKED *** - Present options to user before continuing.');
  }

  // Next action guidance
  lines.push('');
  lines.push('**Actions:**');
  lines.push('- Continue: `tsv pass`');
  lines.push('- Jump to step: `tsv goto N`');
  lines.push('- Abort: `tsv stop`');

  return lines.join('\n');
}