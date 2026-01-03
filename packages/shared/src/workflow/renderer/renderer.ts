import { type Step, type Action, type Conditions, type Substep } from '../types.js';

/**
 * Render an Action to its DSL string representation
 */
export function renderAction(action: Action): string {
  if (action.type === 'RETRY') {
    return `RETRY ${action.max} ${renderAction(action.then)}`;
  }

  switch (action.type) {
    case 'CONTINUE':
      return 'CONTINUE';
    case 'DONE':
      return 'DONE';
    case 'STOP':
      return action.message ? `STOP "${action.message}"` : 'STOP';
    case 'GOTO':
      return `GOTO ${action.step}`;
  }
}

/**
 * Render Conditions to Markdown list items
 */
export function renderConditions(conditions: Conditions): string {
  const lines: string[] = [];
  lines.push(`- PASS: ${renderAction(conditions.pass)}`);
  lines.push(`- FAIL: ${renderAction(conditions.fail)}`);
  return lines.join('\n');
}

/**
 * Render a Substep to Markdown
 */
export function renderSubstep(substep: Substep): string {
  const agentSuffix = substep.agentType ? ` (${substep.agentType})` : '';
  const workflowSuffix = substep.workflows?.length ? ` [@${substep.workflows.join(', ')}]` : '';
  return `### ${substep.id}. ${substep.description}${agentSuffix}${workflowSuffix}`;
}

/**
 * Render a Step to its Markdown representation
 */
export function renderStep(step: Step): string {
  const lines: string[] = [];

  // Header
  lines.push(`## ${step.number}. ${step.description}`);
  lines.push('');

  // Command
  if (step.command) {
    lines.push('```bash');
    lines.push(step.command.code);
    lines.push('```');
    lines.push('');
  }

  // Prompts
  for (const prompt of step.prompts) {
    lines.push(prompt.text);
    lines.push('');
  }

  // Conditions
  if (step.conditions) {
    lines.push(renderConditions(step.conditions));
    lines.push('');
  }

  // Substeps
  if (step.substeps) {
    for (const substep of step.substeps) {
      lines.push(renderSubstep(substep));
      lines.push('');
    }
  }

  // Nested Workflow
  if (step.nestedWorkflow) {
    lines.push(`@${step.nestedWorkflow}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}
