// src/workflow/parser/validator.ts

import { WorkflowSyntaxError } from './types.js';
import { StepSchema, ActionSchema } from '../../schemas.js';
import type { Step, Action } from '../types.js';

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
  // Workflow contains EITHER static steps OR exactly one dynamic template
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

  // Conformance Rule 3: Sequencing (only for static workflows)
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
    const stepLabel = step.isDynamic ? '{N}' : String(step.number);

    // Conformance Rule 4: Exclusivity
    // Validate: cannot have both workflows and substeps
    if (step.workflows?.length && step.substeps?.length) {
      throw new WorkflowSyntaxError(
        `Step ${stepLabel}: Cannot have both workflows and substeps`
      );
    }

    // Validate: cannot have both body content and workflows
    const hasBody = step.command ?? step.prompts.length > 0;
    if (hasBody && step.workflows?.length) {
      throw new WorkflowSyntaxError(
        `Step ${stepLabel}: Cannot have both body (command/prompts) and workflow list`
      );
    }

    if (step.transitions) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stepLabel = step.isDynamic ? '{N}' : String(step.number!);
      validateAction(step.transitions.pass, stepLabel, steps.length, steps, step);
      validateAction(step.transitions.fail, stepLabel, steps.length, steps, step);
    }

    // Validate substep transitions
    if (step.substeps) {
      for (const substep of step.substeps) {
        if (substep.transitions) {
          const substepLabel = `${stepLabel}.${substep.id}`;
          validateAction(substep.transitions.pass, substepLabel, steps.length, steps, step);
          validateAction(substep.transitions.fail, substepLabel, steps.length, steps, step);
        }
      }
    }
  }
}

/**
 * Validates a single action (e.g., GOTO target, loop prevention, RETRY constraints).
 * @param action The action to validate
 * @param stepLabel The step label (number for static steps, "{N}" for dynamic steps)
 * @param totalSteps Total number of steps in the workflow
 * @param steps The full steps array for reference
 * @param currentStep The step object containing this action (for context-dependent validation)
 */
export function validateAction(
  action: Action,
  stepLabel: string | number,
  totalSteps: number,
  steps: Step[],
  currentStep?: Step
): void {
  // Schema validation
  const result = ActionSchema.safeParse(action);
  if (!result.success) {
    throw new WorkflowSyntaxError(
      `Step ${String(stepLabel)}: Action validation failed: ${result.error.issues.map(i => i.message).join(', ')}`
    );
  }

  if (action.type === 'NEXT') {
    // Check if we're in a dynamic step context
    if (!currentStep) {
      throw new WorkflowSyntaxError(
        `NEXT action is only valid within dynamic step context (## {N}.). ` +
        `Found in static context at ${String(stepLabel)}.`
      );
    }
    if (!currentStep.isDynamic) {
      throw new WorkflowSyntaxError(
        `NEXT action is only valid within dynamic step context (## {N}.). ` +
        `Found in static step ${String(stepLabel)}.`
      );
    }
  }

  if (action.type === 'GOTO') {
    const targetStep = action.target.step;

    // Skip validation for dynamic references (resolved at runtime)
    if (targetStep === '{N}') {
      return;  // Cannot validate substep existence at parse time
    }

    const targetStepNum = targetStep as number;
    const targetSubstep = action.target.substep;

    // Validate step exists
    if (targetStepNum < 1 || targetStepNum > totalSteps) {
      throw new WorkflowSyntaxError(
        `Step ${String(stepLabel)}: GOTO target step ${String(targetStepNum)} does not exist (workflow has ${String(totalSteps)} steps).`
      );
    }

    // Validate substep (if specified)
    if (targetSubstep) {
      const step = steps[targetStepNum - 1];

      // Step must have substeps
      if (!step.substeps || step.substeps.length === 0) {
        throw new WorkflowSyntaxError(
          `Step ${String(stepLabel)}: GOTO ${String(targetStepNum)}.${targetSubstep} invalid - step ${String(targetStepNum)} has no substeps.`
        );
      }

      // Reject GOTO into dynamic substeps (Conformance Rule 5/GOTO Rules)
      const hasDynamic = step.substeps.some(s => s.isDynamic);
      if (hasDynamic) {
        throw new WorkflowSyntaxError(
          `Step ${String(stepLabel)}: Cannot GOTO substep of dynamic step. Use GOTO ${String(targetStepNum)} instead.`
        );
      }

      // Substep must exist
      const substepExists = step.substeps.some(s => s.id === targetSubstep);
      if (!substepExists) {
        throw new WorkflowSyntaxError(
          `Step ${String(stepLabel)}: GOTO ${String(targetStepNum)}.${targetSubstep} invalid - substep does not exist.`
        );
      }
    }

    // Step-level self-reference check: only for static steps (not dynamic)
    if (typeof stepLabel === 'string' && stepLabel !== '{N}') {
      const stepNum = parseInt(stepLabel, 10);
      if (targetStepNum === stepNum && !targetSubstep) {
        throw new WorkflowSyntaxError(
          `Step ${stepLabel}: GOTO self creates infinite loop (use RETRY instead)`
        );
      }
    }
  }

  // Recurse into RETRY exhaustion action
  if (action.type === 'RETRY') {
    // Conformance Rule 5: Recursion (Already enforced by ActionSchema union not including RETRY in 'then')
    validateAction(action.then, stepLabel, totalSteps, steps, currentStep);
  }
}
