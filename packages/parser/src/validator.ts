import { WorkflowSyntaxError } from './types.js';
import { StepSchema, ActionSchema } from './schemas.js';
import type { Step, Action } from './ast.js';

/**
 * Validates a parsed workflow against Rundown specification rules.
 */
export function validateWorkflow(steps: Step[]): void {
  if (steps.length === 0) {
    throw new WorkflowSyntaxError(
      "Workflow must contain at least one step (heading starting with '##')"
    );
  }

  // Schema validation for each step
  for (const step of steps) {
    const result = StepSchema.safeParse(step);
    if (!result.success) {
      const stepLabel = step.isDynamic ? '{N}' : String(step.number);
      throw new WorkflowSyntaxError(
        `Step ${stepLabel} failed schema validation: ${result.error.issues.map(i => i.message).join(', ')}`
      );
    }
  }

  // Conformance Rule 2: Step Pattern
  const staticSteps = steps.filter(s => !s.isDynamic);
  const dynamicSteps = steps.filter(s => s.isDynamic);

  if (staticSteps.length > 0 && dynamicSteps.length > 0) {
    throw new WorkflowSyntaxError(
      'Invalid step pattern: workflow must contain static steps OR exactly one dynamic step template, not both.'
    );
  }

  if (dynamicSteps.length > 1) {
    throw new WorkflowSyntaxError(
      'Invalid step pattern: workflow can have exactly one dynamic step template (## {N}.), not multiple.'
    );
  }

  // Conformance Rule 3: Sequencing
  if (staticSteps.length > 0) {
    for (let i = 0; i < steps.length; i++) {
      const expected = i + 1;
      if (steps[i].number !== expected) {
        throw new WorkflowSyntaxError(
          `Steps must be numbered sequentially. Expected step ${String(expected)}, found step ${String(steps[i].number)}.`
        );
      }
    }
  }

  for (const step of steps) {
    const stepNum = step.isDynamic ? 0 : (step.number ?? 0);
    const stepLabel = step.isDynamic ? '{N}' : String(stepNum);

    // Conformance Rule 4: Exclusivity (Step level)
    const hasBody = (step.command !== undefined) || step.prompts.length > 0;
    const hasSubsteps = (step.substeps !== undefined && step.substeps.length > 0);
    const hasWorkflows = (step.workflows !== undefined && step.workflows.length > 0);

    const contentCount = [hasBody, hasSubsteps, hasWorkflows].filter(Boolean).length;
    if (contentCount > 1) {
      throw new WorkflowSyntaxError(
        `Step ${stepLabel}: Violates Exclusivity Rule. A step must have exactly one of {Body, Substeps, Workflow List}.`
      );
    }

    if (step.transitions) {
      validateAction(step.transitions.pass, stepNum, undefined, steps, step);
      validateAction(step.transitions.fail, stepNum, undefined, steps, step);
    }

    if (step.substeps) {
      for (const substep of step.substeps) {
        const sHasBody = (substep.command !== undefined) || (substep.prompts && substep.prompts.length > 0);
        const sHasWorkflows = (substep.workflows !== undefined && substep.workflows.length > 0);
        
        if (sHasBody && sHasWorkflows) {
          throw new WorkflowSyntaxError(
            `Substep ${stepLabel}.${substep.id}: Violates Exclusivity Rule. A substep must have either a Body or a Workflow List, but not both.`
          );
        }

        if (substep.transitions) {
          validateAction(substep.transitions.pass, stepNum, substep.id, steps, step);
          validateAction(substep.transitions.fail, stepNum, substep.id, steps, step);
        }
      }
    }
  }
}

/**
 * Validates a single action
 */
export function validateAction(
  action: Action,
  currentStepNum: number,
  currentSubstepId: string | undefined,
  steps: Step[],
  currentStepObj: Step
): void {
  const result = ActionSchema.safeParse(action);
  if (!result.success) {
    const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
    throw new WorkflowSyntaxError(
      `Step ${context}: Action validation failed: ${result.error.issues.map(i => i.message).join(', ')}`
    );
  }

  const isDynamicContext = currentStepObj.isDynamic;

  if (action.type === 'NEXT') {
    if (!isDynamicContext) {
      const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
      throw new WorkflowSyntaxError(
        `Step ${context}: NEXT action is only valid within dynamic step context (## {N}.).`
      );
    }
  }

  if (action.type === 'GOTO') {
    const targetStep = action.target.step;
    const targetSubstep = action.target.substep;

    if (targetStep === '{N}' && !targetSubstep) {
      const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
      throw new WorkflowSyntaxError(
        `Step ${context}: GOTO {N} alone is invalid. Use NEXT to advance to the next dynamic instance.`
      );
    }

    if (targetStep === '{N}') {
      return; 
    }

    const targetStepNum = targetStep as number;

    if (targetStepNum < 1 || targetStepNum > steps.length) {
      const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
      throw new WorkflowSyntaxError(
        `Step ${context}: GOTO target step ${String(targetStepNum)} does not exist (workflow has ${String(steps.length)} steps).`
      );
    }

    const targetStepObj = steps[targetStepNum - 1];
    const isTargetDynamic = targetStepObj.isDynamic;
    const isInsideDynamicStep = isDynamicContext && targetStepNum === currentStepNum;

    if (isTargetDynamic && !isInsideDynamicStep) {
      const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
      throw new WorkflowSyntaxError(
        `Step ${context}: Cannot GOTO into dynamic step ${String(targetStepNum)} from outside. Use NEXT if it is the current template.`
      );
    }

    if (targetSubstep) {
      if (!targetStepObj.substeps || targetStepObj.substeps.length === 0) {
        const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
        throw new WorkflowSyntaxError(
          `Step ${context}: GOTO ${String(targetStepNum)}.${targetSubstep} invalid - step ${String(targetStepNum)} has no substeps.`
        );
      }

      if (targetSubstep === '{n}') {
        const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
        throw new WorkflowSyntaxError(
          `Step ${context}: GOTO ${String(targetStepNum)}.{n} is invalid. Dynamic substeps cannot be targeted directly via GOTO.`
        );
      }

      const substepExists = targetStepObj.substeps.some(s => s.id === targetSubstep);
      if (!substepExists) {
        if (targetStepObj.isDynamic) {
           const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
           throw new WorkflowSyntaxError(
             `Step ${context}: cannot GOTO substep of dynamic step. Use GOTO ${String(targetStepNum)} instead.`
           );
        }

        const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
        throw new WorkflowSyntaxError(
          `Step ${context}: GOTO ${String(targetStepNum)}.${targetSubstep} invalid - substep does not exist.`
        );
      }
    }

    if (targetStepNum === currentStepNum && targetSubstep === currentSubstepId) {
      const context = currentSubstepId ? `${String(currentStepNum)}.${currentSubstepId}` : String(currentStepNum);
      throw new WorkflowSyntaxError(
        `Step ${context}: GOTO self creates infinite loop (use RETRY instead)`
      );
    }
  }

  if (action.type === 'RETRY') {
    validateAction(action.then, currentStepNum, currentSubstepId, steps, currentStepObj);
  }
}
