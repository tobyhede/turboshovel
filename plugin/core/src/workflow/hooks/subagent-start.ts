import { execSync } from 'child_process';
import type { HookInput } from '@turboshovel/shared';

export interface SubagentStartResult {
  context?: string;
  violation?: string;
}

/**
 * Handle SubagentStart hook
 *
 * Flow:
 * 1. Call CLI: tsv start --agent {agentId}
 * 2. CLI manages pending task popping and agent binding
 * 3. Parse CLI output for context injection
 * 4. Return context with agent binding info
 */
export async function handleSubagentStart(input: HookInput): Promise<SubagentStartResult> {
  if (input.hook_event_name !== 'SubagentStart') {
    return {};
  }

  const agentId = input.agent_id;
  if (!agentId) {
    return {}; // No agent_id available, skip (graceful degradation)
  }

  try {
    const output = execSync(`tsv start --agent ${agentId}`, {
      cwd: input.cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });

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

function parseStartAgentOutput(output: string, agentId: string): string {
  // Format context for subagent
  const lines = [
    '## Workflow Agent Context',
    '',
    `AGENT_ID: ${agentId}`,
    ''
  ];

  // Extract task ID and workflow from output
  const taskMatch = output.match(/bound to task (\d+(?:\.\d+)?)/);
  if (taskMatch) {
    lines.push(`TASK_ID: ${taskMatch[1]}`);
  }

  const workflowMatch = output.match(/Started child workflow: (.+)/);
  if (workflowMatch) {
    lines.push(`WORKFLOW: ${workflowMatch[1]}`);
  }

  lines.push('', '## Commands', '');
  lines.push(`tsv next --pass --agent ${agentId}`);
  lines.push(`tsv next --fail --agent ${agentId}`);
  lines.push('');

  return lines.join('\n');
}
