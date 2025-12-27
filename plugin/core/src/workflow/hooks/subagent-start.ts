import * as fs from 'fs/promises';
import * as path from 'path';
import {
  WorkflowStateManager,
  taskIdToString,
  type TaskId,
  parseWorkflow,
  type HookInput
} from '@turboshovel/shared';
import { substituteVariables, getTaskPrompt } from './substitute.js';

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
 * 3. Load workflow and find task prompt
 * 4. Substitute $n with subtask number
 * 5. Inject agent context with substituted prompt
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

    // Load workflow and get substituted prompt
    const prompt = await loadAndSubstitutePrompt(input.cwd, state.workflow, taskId);

    // Inject context for subagent
    const context = formatAgentContext(agentId, taskId, prompt);

    return { context };
  } catch (error) {
    console.error('Failed to handle subagent start:', error);
    return {};
  }
}

/**
 * Load workflow file, parse it, find task prompt, and substitute variables.
 * Returns undefined on any error (graceful degradation).
 */
async function loadAndSubstitutePrompt(
  cwd: string,
  workflowPath: string,
  taskId: TaskId
): Promise<string | undefined> {
  try {
    const fullPath = path.join(cwd, workflowPath);
    const content = await fs.readFile(fullPath, 'utf8');
    const tasks = parseWorkflow(content);
    const prompt = getTaskPrompt(tasks, taskId);

    if (!prompt) {
      return undefined;
    }

    return substituteVariables(prompt, taskId);
  } catch {
    // Workflow file not found or parse error - graceful degradation
    return undefined;
  }
}

function formatAgentContext(agentId: string, taskId: TaskId, prompt?: string): string {
  const lines = [
    '## Workflow Agent Context',
    '',
    `AGENT_ID: ${agentId}`,
    `TASK_ID: ${taskIdToString(taskId)}`,
    ''
  ];

  if (prompt) {
    lines.push('## Task Prompt', '', prompt, '');
  }

  lines.push(
    '## Commands',
    '',
    `workflow next --pass --agent ${agentId}`,
    `workflow next --fail --agent ${agentId}`,
    ''
  );

  return lines.join('\n');
}
