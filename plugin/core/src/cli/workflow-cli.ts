#!/usr/bin/env node
// src/cli/workflow-cli.ts

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync, type ExecSyncOptions } from 'child_process';
import {
  WorkflowStateManager,
  parseWorkflow,
  WorkflowSyntaxError,
  stepIdToString,
  parseStepIdFromString,
  createStepNumber,
  isNodeError,
  getErrorMessage,
  evaluateFailCondition,
  evaluatePassCondition,
  evaluateSubstepAggregation,
  renderStep,
  type StepNumber,
  type Step,
  type PendingStep
} from '@turboshovel/shared';

const program = new Command();

program.name('workflow').description('Manage workflow execution').version('1.0.0');

function getCwd(): string {
  return process.cwd();
}

function getStepRetryMax(step: Step): number {
  if (step.conditions?.fail?.type === 'RETRY') {
    return step.conditions.fail.max;
  }
  return 0;
}

program
  .command('start [file]')
  .description('Start a new workflow or queue a step')
  .option('--step <stepId>', 'Mark step as started (adds to pending queue)')
  .option('--agent <agentId>', 'Bind agent to pending step')
  .action(async (file: string | undefined, options: { step?: string; agent?: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      // Mode 1: --step
      if (options.step && !options.agent) {
        const state = await manager.getActive();
        if (!state) {
          console.error('Error: No active workflow');
          process.exit(1);
        }

        const stepId = parseStepIdFromString(options.step);
        if (!stepId) {
          console.error(`Error: Invalid step ID format: ${options.step}`);
          console.error('Expected format: "3" or "3.1"');
          process.exit(1);
        }

        await manager.pushPendingStep(state.id, { stepId });
        console.log(`Step ${stepIdToString(stepId)} queued for agent binding`);
        return;
      }

      // Mode 3: --agent
      if (options.agent) {
        const state = await manager.getActive();
        if (!state) {
          console.error('Error: No active workflow');
          process.exit(1);
        }

        const pending = await manager.popPendingStep(state.id);
        if (!pending) {
          console.error('Error: No pending step to bind');
          process.exit(1);
        }

        await manager.bindAgent(state.id, options.agent, pending.stepId);
        console.log(`Agent ${options.agent} bound to step ${stepIdToString(pending.stepId)}`);
        return;
      }

      // Mode 2: File start
      if (file && !options.step && !options.agent) {
        const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);
        const content = await fs.readFile(filePath, 'utf8');
        const steps = parseWorkflow(content);

        if (steps.length === 0) {
          console.error('Error: Workflow has no steps');
          process.exit(1);
        }

        const workflowPath = path.isAbsolute(file) ? path.relative(cwd, file) : file;
        const state = await manager.create(workflowPath, steps);
        await manager.setActive(state.id);

        if (steps[0].substeps && steps[0].substeps.length > 0) {
          await manager.initializeSubsteps(state.id, steps[0].substeps);
        }

        console.log(`Started workflow: ${workflowPath}`);
        console.log(`ID: ${state.id}`);
        console.log(`Step 1: ${steps[0].description}`);
        printStepGuidance(steps[0]);
        return;
      }

      if (!file && !options.step && !options.agent) {
        console.error('Error: Workflow file, --step, or --agent option required');
        process.exit(1);
      }
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        console.error(`Error: Workflow file not found: ${file}`);
      } else if (error instanceof WorkflowSyntaxError) {
        console.error(`Syntax error: ${error.message}`);
      } else {
        console.error(`Error: ${getErrorMessage(error)}`);
      }
      process.exit(1);
    }
  });

program
  .command('next')
  .description('Advance to the next step or mark current step complete')
  .option('--goto <n>', 'Jump to specific step number')
  .option('--pass', 'Mark step as passed')
  .option('--fail', 'Mark step as failed/blocked')
  .option('--retry', 'Retry current step (increment retry count)')
  .option('--step <stepId>', 'Specify which step/substep (for parallel steps)')
  .option('--agent <agentId>', 'Specify agent completing step')
  .action(
    async (options: {
      goto?: string;
      pass?: boolean;
      fail?: boolean;
      retry?: boolean;
      step?: string;
      agent?: string;
    }) => {
      try {
        const cwd = getCwd();
        const manager = new WorkflowStateManager(cwd);
        const state = await manager.getActive();

        if (!state) {
          console.log('No active workflow');
          return;
        }

        const workflowPath = await findWorkflowFile(cwd, state.workflow);
        if (!workflowPath) {
          console.error(`Error: Workflow file ${state.workflow} not found`);
          process.exit(1);
        }
        const content = await fs.readFile(workflowPath, 'utf8');
        const steps = parseWorkflow(content);
        const actor = await manager.createActor(state.id, steps);
        if (!actor) {
          console.error('Error: Failed to initialize workflow engine');
          process.exit(1);
        }

        // Handle agent completion
        if ((options.pass || options.fail) && options.agent) {
          const binding = await manager.getAgentBinding(state.id, options.agent);
          if (!binding) {
            console.error(`Error: No binding for agent ${options.agent}`);
            process.exit(1);
          }

          if (options.fail) {
            const agentStep = steps[binding.stepId.step - 1];
            const result = evaluateFailCondition(agentStep, state.retryCount);

            if (result.action === 'retry') {
               actor.send({ type: 'FAIL' });
               await manager.updateFromActor(state.id, actor, steps);
               console.log(`Agent ${options.agent} retrying step ${binding.stepId.step}`);
               return;
            } else if (result.action === 'goto') {
               actor.send({ type: 'FAIL' });
               const updated = await manager.updateFromActor(state.id, actor, steps);
               console.log(`Agent ${options.agent} failed, workflow jumped to step ${updated.step}`);
               return;
            }
          }

          let result: 'pass' | 'fail' = options.fail ? 'fail' : 'pass';
          
          if (binding.childWorkflowId) {
            const childResult = await manager.getChildWorkflowResult(binding.childWorkflowId);
            if (childResult === null) {
              console.error(`Error: Child workflow still active. Complete or stop it first.`);
              console.error(`Child workflow: ${binding.childWorkflowId}`);
              process.exit(1);
            }
            result = childResult;
          }

          await manager.updateAgentBinding(state.id, options.agent, {
            status: 'done',
            result
          });
          console.log(`Agent ${options.agent} marked as ${result}`);

          // Check if all agents done
          const updated = await manager.load(state.id);
          const bindings = Object.values(updated?.agentBindings ?? {});
          const running = bindings.filter((b) => b.status === 'running').length;

          if (running > 0) {
            console.log(`${running} agent(s) still running`);
          } else {
            console.log('All agents complete. Run: workflow next');
          }
          return;
        }

        // Handle main step results
        if (options.pass) {
          actor.send({ type: 'PASS' });
        } else if (options.fail) {
          actor.send({ type: 'FAIL' });
        } else if (options.retry) {
          const currentStep = steps[state.step - 1];
          const retryMax = getStepRetryMax(currentStep);
          if (retryMax === 0) {
            console.error(`Error: Step ${state.step} has no RETRY action configured`);
            process.exit(1);
          }
          if (state.retryCount >= retryMax) {
            console.error(`Error: Max retries exceeded (${retryMax})`);
            process.exit(1);
          }
          actor.send({ type: 'RETRY' });
        } else if (options.goto) {
          const target = createStepNumber(parseInt(options.goto, 10));
          if (!target) {
            console.error('Error: Invalid step number for --goto');
            process.exit(1);
          }
          await manager.update(state.id, {
            step: target,
            retryCount: 0,
            snapshot: {
              status: 'active',
              value: `step_${target}`,
              context: {
                retryCount: 0,
                variables: state.variables
              }
            }
          });
          const nextStep = steps[target - 1];
          console.log(`Step ${target}: ${nextStep.description}`);
          printStepGuidance(nextStep);
          return;
        } else {
          actor.send({ type: 'NEXT' });
        }

        const updatedState = await manager.updateFromActor(state.id, actor, steps);
        const snapshot = actor.getPersistedSnapshot() as any;

        if (snapshot.status === 'done') {
          if (snapshot.value === 'complete') {
            await manager.update(state.id, { variables: { ...state.variables, completed: true } });
            console.log(`Workflow complete: ${state.workflow}`);
            await manager.setActive(null);
          } else if (snapshot.value === 'blocked') {
            await manager.update(state.id, { variables: { ...state.variables, blocked: true } });
            console.error(`Error: Step blocked`);
            console.log(`Workflow blocked: ${state.workflow}`);
            process.exit(1);
          }
          return;
        }

        const currentStep = steps[updatedState.step - 1];
        if (updatedState.retryCount > 0) {
          const retryMax = getStepRetryMax(currentStep);
          console.log(`Retry ${updatedState.retryCount}/${retryMax}`);
        }
        console.log(`Step ${updatedState.step}: ${currentStep.description}`);
        printStepGuidance(currentStep);

      } catch (error) {
        console.error(`Error: ${getErrorMessage(error)}`);
        process.exit(1);
      }
    }
  );

program
  .command('status')
  .description('Show current workflow state')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();
      const stashedId = await manager.getStashedWorkflowId();

      if (!state && !stashedId) {
        console.log('No active workflow');
        return;
      }

      if (stashedId && !state) {
        const stashed = await manager.load(stashedId);
        console.log(`Workflow stashed: ${stashed?.workflow ?? stashedId}`);
        return;
      }

      if (!state) return;

      console.log(`Workflow: ${state.workflow}`);
      console.log(`Step ${state.step}: ${state.stepName}`);

      const workflowPath = await findWorkflowFile(cwd, state.workflow);
      if (workflowPath) {
        const content = await fs.readFile(workflowPath, 'utf8');
        const steps = parseWorkflow(content);
        const currentStep = steps[state.step - 1];
        if (currentStep) {
          console.log(`Retry: ${state.retryCount}/${getStepRetryMax(currentStep)}`);
          printStepGuidance(currentStep);
        }
      }
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
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
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

function printStepGuidance(step: Step): void {
  console.log('\n' + renderStep(step));
}

async function findWorkflowFile(cwd: string, filename: string): Promise<string | null> {
  const directPath = path.join(cwd, filename);
  try {
    await fs.access(directPath);
    return directPath;
  } catch {}
  return null;
}

program.parse();