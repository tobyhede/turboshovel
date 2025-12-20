#!/usr/bin/env node
// src/cli/workflow-cli.ts

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkflowStateManager } from '../workflow/state';
import { parseWorkflow, WorkflowSyntaxError } from '../workflow/parser';
import { createStepNumber, type Action, type Step } from '../workflow/types';

const program = new Command();

program
  .name('workflow')
  .description('Manage workflow execution')
  .version('1.0.0');

function getCwd(): string {
  return process.cwd();
}

program
  .command('start <file>')
  .description('Start a new workflow from a markdown file')
  .action(async (file: string) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      // Read and parse workflow file
      const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);
      const content = await fs.readFile(filePath, 'utf8');
      const steps = parseWorkflow(content);

      if (steps.length === 0) {
        console.error('Error: Workflow has no steps');
        process.exit(1);
      }

      // Create workflow state
      const workflowName = path.basename(file);
      const state = await manager.create(workflowName, steps[0].description);
      await manager.setActive(state.id);

      console.log(`Started workflow: ${workflowName}`);
      console.log(`ID: ${state.id}`);
      console.log(`Step 1: ${steps[0].description}`);
      printStepGuidance(steps[0]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`Error: Workflow file not found: ${file}`);
      } else if (error instanceof WorkflowSyntaxError) {
        console.error(`Syntax error: ${error.message}`);
      } else {
        console.error(`Error: ${(error as Error).message}`);
      }
      process.exit(1);
    }
  });

program
  .command('next')
  .description('Advance to the next step')
  .option('--step <n>', 'Jump to specific step (for GOTO)')
  .action(async (options: { step?: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      // Load workflow definition to get total steps
      const workflowPath = await findWorkflowFile(cwd, state.workflow);
      if (!workflowPath) {
        console.error(`Error: Workflow file ${state.workflow} not found`);
        process.exit(1);
      }

      const content = await fs.readFile(workflowPath, 'utf8');
      const steps = parseWorkflow(content);

      // Determine next step
      // StepNumber is a branded number type, so arithmetic works directly
      let nextStepNum: number;
      if (options.step) {
        nextStepNum = parseInt(options.step, 10);
      } else {
        nextStepNum = state.step + 1;
      }

      // Check if workflow is complete
      if (nextStepNum > steps.length) {
        console.log(`Workflow complete: ${state.workflow}`);
        await manager.setActive(null);
        return;
      }

      const nextStep = steps[nextStepNum - 1];
      const stepNumber = createStepNumber(nextStepNum);
      if (!stepNumber) {
        console.error('Error: Invalid step number');
        process.exit(1);
      }

      // Update state
      await manager.update(state.id, {
        step: stepNumber,
        stepName: nextStep.description,
        retryCount: 0,
      });

      console.log(`Step ${nextStepNum}: ${nextStep.description}`);
      printStepGuidance(nextStep);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('complete')
  .description('Mark current workflow as complete')
  .option('--status <status>', 'Completion status (ok|blocked)', 'ok')
  .action(async (options: { status: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      if (options.status === 'blocked') {
        await manager.update(state.id, {
          variables: { ...state.variables, blocked: true },
        });
        console.log(`Workflow BLOCKED: ${state.workflow}`);
      } else {
        await manager.setActive(null);
        console.log(`Workflow complete: ${state.workflow}`);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current workflow state')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      console.log(`Workflow: ${state.workflow}`);
      console.log(`ID: ${state.id}`);
      console.log(`Step ${state.step}: ${state.stepName}`);
      console.log(`Retry: ${state.retryCount}/${state.retryMax}`);

      if (Object.keys(state.variables).length > 0) {
        console.log('Variables:', JSON.stringify(state.variables, null, 2));
      }

      if (state.tasks.length > 0) {
        console.log(`Tasks: ${state.tasks.length}`);
        for (const task of state.tasks) {
          console.log(`  - ${task.id}: ${task.status}`);
        }
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Abort current workflow')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      await manager.delete(state.id);
      await manager.setActive(null);
      console.log(`Stopped workflow: ${state.workflow}`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all workflows')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const states = await manager.list();
      const active = await manager.getActive();

      if (states.length === 0) {
        console.log('No workflows');
        return;
      }

      for (const state of states) {
        const marker = active?.id === state.id ? ' (active)' : '';
        console.log(`${state.id}${marker}: ${state.workflow} - Step ${state.step}`);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

function printStepGuidance(step: Step): void {
  if (step.command) {
    console.log(`\nCommand: ${step.command.code}`);
  }

  if (step.prompts.length > 0) {
    console.log(`\nPrompt: ${step.prompts[0].text}`);
  }

  if (step.conditions) {
    console.log('\nConditions:');
    console.log(`  PASS: ${formatAction(step.conditions.pass)}`);
    console.log(`  FAIL: ${formatAction(step.conditions.fail)}`);
  }

  if (step.nestedWorkflow) {
    console.log(`\nNested workflow: ${step.nestedWorkflow}`);
  }
}

function formatAction(action: Action): string {
  switch (action.type) {
    case 'CONTINUE': return 'CONTINUE';
    case 'STOP': return action.message ? `STOP "${action.message}"` : 'STOP';
    case 'GOTO': return `GOTO ${action.step}`;
    case 'DONE': return 'DONE';
    case 'RETRY': return action.max ? `RETRY ${action.max}` : 'RETRY';
    default: return 'UNKNOWN';
  }
}

async function findWorkflowFile(cwd: string, filename: string): Promise<string | null> {
  // Check current directory
  const direct = path.join(cwd, filename);
  try {
    await fs.access(direct);
    return direct;
  } catch {
    // Not found
  }

  // Check .claude/workflows/
  const claudeDir = path.join(cwd, '.claude/workflows', filename);
  try {
    await fs.access(claudeDir);
    return claudeDir;
  } catch {
    // Not found
  }

  return null;
}

program.parse();
