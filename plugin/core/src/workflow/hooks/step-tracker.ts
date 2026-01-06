// src/workflow/hooks/step-tracker.ts
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  WorkflowStateManager,
  parseStepIdFromString,
  stepIdToString,
  parseWorkflow,
  type StepId,
  type HookInput
} from '@turboshovel/shared';

/** Maximum characters to show in step description before truncation */
const DESCRIPTION_DISPLAY_LIMIT = 60;

export interface StepDispatchResult {
  stepId?: StepId;
  violation?: string;
}

/**
 * Track Step tool dispatches in workflow state
 */
export async function trackStepDispatch(input: HookInput): Promise<StepDispatchResult> {
  // Handle both Step and Task tool (Task for backward compatibility/LLM training)
  if (input.tool_name !== 'Step' && input.tool_name !== 'Task') {
    return {};
  }

  const manager = new WorkflowStateManager(input.cwd);

  try {
    const state = await manager.getActive();
    if (!state) return {};

    const stashedId = await manager.getStashedWorkflowId();
    if (stashedId) return {};

    const description = input.tool_input?.description ?? '';
    const stepId = parseStepIdFromString(description, { requireSeparator: true });

    if (!stepId) {
      return {
        violation:
          `Step description must start with StepId (e.g., "3.1 - Review code"). ` +
          `Got: "${description.substring(0, DESCRIPTION_DISPLAY_LIMIT)}${description.length > DESCRIPTION_DISPLAY_LIMIT ? '...' : ''}"`
      };
    }

    const workflow = await getSubstepWorkflow(input.cwd, stepId);

    const stepIdStr = stepIdToString(stepId);
    // Use --step instead of --task
    const cmd = workflow
      ? `tsv run --step ${stepIdStr} ${workflow}`
      : `tsv run --step ${stepIdStr}`;

    try {
      execSync(cmd, { cwd: input.cwd, stdio: 'pipe' });
      return { stepId };
    } catch {
      return {};
    }
  } catch (error: unknown) {
    console.error('Failed to track step dispatch:', error);
    return {};
  }
}

async function getSubstepWorkflow(cwd: string, stepId: StepId): Promise<string | undefined> {
  const manager = new WorkflowStateManager(cwd);
  const state = await manager.getActive();
  if (!state) return undefined;

  // Dynamic references {N} are resolved at runtime, not at parse time
  if (stepId.step === '{N}') {
    return undefined;
  }

  const workflowPath = path.join(cwd, state.workflow);
  let content: string;
  try {
    content = await fs.readFile(workflowPath, 'utf8');
  } catch {
    return undefined;
  }
  const steps = parseWorkflow(content);

  const step = steps[stepId.step - 1];
  // substeps is either defined or undefined (not null), stepId.substep is a string if set
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!step?.substeps || !stepId.substep) return undefined;

  const substepIndex = parseInt(stepId.substep, 10);
  if (isNaN(substepIndex) || substepIndex < 1) return undefined;

  const staticSubstep = step.substeps.find(
    s => !s.isDynamic && s.id === stepId.substep
  );
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
  if (staticSubstep && staticSubstep.workflows?.length) {
    return staticSubstep.workflows[0];
  }

  const dynamicSubstep = step.substeps.find(s => s.isDynamic);
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
  if (!dynamicSubstep || !dynamicSubstep.workflows?.length) return undefined;

  const workflowIndex = (substepIndex - 1) % dynamicSubstep.workflows.length;
  return dynamicSubstep.workflows[workflowIndex];
}