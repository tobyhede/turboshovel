#!/usr/bin/env node
// packages/cli/src/cli.ts

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
  evaluateFailCondition,
  isNodeError,
  getErrorMessage,
  renderStep,
  executeCommand,
  printMetadata,
  printActionBlock,
  printStepBlock,
  printSeparator,
  printCommandExec,
  printWorkflowComplete,
  printWorkflowStopped,
  printWorkflowBlocked,
  printWorkflowStashed,
  printNoActiveWorkflow,
  printNoWorkflows,
  printWorkflowListEntry,
  formatPosition,
  type Step,
  type PendingStep,
  type WorkflowMetadata,
  type ActionBlockData,
  type StepPosition,
  type WorkflowState,
} from '@turboshovel/shared';
import { resolveWorkflowFile } from './helpers/resolve-workflow.js';

const program = new Command();

program.name('turboshovel').description('Workflow orchestration CLI').version('1.0.0');

const DEFAULT_RESULT_SEQUENCE: string[] = ['pass'];

/**
 * Execute command steps in a loop until:
 * - Workflow completes or blocks
 * - A prompt-only step is reached (no command)
 * - In prompted mode (no auto-execution)
 *
 * @returns 'done' | 'blocked' | 'waiting' (waiting = prompt-only step reached)
 */
async function runExecutionLoop(
  manager: WorkflowStateManager,
  workflowId: string,
  steps: Step[],
  cwd: string,
  prompted: boolean
): Promise<'done' | 'blocked' | 'waiting'> {
  let state = await manager.load(workflowId);
  if (!state) return 'blocked';

  while (true) {
    const currentStep = steps[state.step - 1];
    const totalSteps = steps.length;

    // Print step block
    printStepBlock({ current: state.step, total: totalSteps }, currentStep);

    // If prompted mode OR no command, wait for manual tsv pass/fail
    if (prompted || !currentStep.command) {
      return 'waiting';
    }

    // Execute command (output via stdio:inherit)
    printCommandExec(currentStep.command.code);
    const execResult = await executeCommand(currentStep.command.code, cwd);

    // Store result
    await manager.setLastResult(workflowId, execResult.success ? 'pass' : 'fail');

    // Capture prev state BEFORE mutation
    const prevStep = state.step;
    const prevRetryCount = state.retryCount;

    // Send event to actor
    const actor = await manager.createActor(workflowId, steps);
    if (!actor) return 'blocked';

    actor.send({ type: execResult.success ? 'PASS' : 'FAIL' });
    const updatedState = await manager.updateFromActor(workflowId, actor, steps);

    const snapshot = actor.getPersistedSnapshot() as any;
    const isComplete = snapshot.status === 'done' && snapshot.value === 'complete';
    const isBlocked = snapshot.status === 'done' && snapshot.value === 'blocked';

    // Derive action string
    const retryMax = getStepRetryMax(currentStep);
    const action = deriveAction(
      prevStep,
      updatedState.step,
      prevRetryCount,
      updatedState.retryCount,
      retryMax,
      isComplete,
      isBlocked
    );

    // Update lastAction in state
    const actionType = action.startsWith('GOTO') ? 'GOTO' :
                       action.startsWith('RETRY') ? 'RETRY' :
                       action as 'CONTINUE' | 'COMPLETE' | 'STOP';
    await manager.update(workflowId, { lastAction: actionType });

    // Print separator and action block
    printSeparator();
    printActionBlock({
      action,
      prev: { current: prevStep, total: totalSteps },
      outcome: execResult.success ? 'PASS' : 'FAIL',
    });

    // Handle workflow end states
    if (isComplete) {
      await manager.update(workflowId, { variables: { ...updatedState.variables, completed: true } });
      printWorkflowComplete();
      if (state.parentWorkflowId) {
        await manager.setActive(state.parentWorkflowId);
      } else {
        await manager.setActive(null);
      }
      return 'done';
    }

    if (isBlocked) {
      await manager.update(workflowId, { variables: { ...updatedState.variables, blocked: true } });
      printWorkflowBlocked(prevStep);
      if (state.parentWorkflowId) {
        await manager.setActive(state.parentWorkflowId);
      } else {
        await manager.setActive(null);
      }
      return 'blocked';
    }

    // Reload state for next iteration
    state = await manager.load(workflowId);
    if (!state) return 'blocked';
  }
}

function getCwd(): string {
  return process.cwd();
}

function isValidResult(r: string): r is 'pass' | 'fail' {
  return r === 'pass' || r === 'fail';
}

function getStepRetryMax(step: Step): number {
  if (step.transitions?.fail?.type === 'RETRY') {
    return step.transitions.fail.max;
  }
  return 0; // No retry configured
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Get total step count for a workflow file.
 */
async function getStepCount(cwd: string, workflowPath: string): Promise<number> {
  try {
    const fullPath = await resolveWorkflowFile(cwd, workflowPath);
    if (!fullPath) return 0;
    const content = await fs.readFile(fullPath, 'utf8');
    const steps = parseWorkflow(content);
    return steps.length;
  } catch {
    return 0;
  }
}

/**
 * Build metadata object for output
 */
function buildMetadata(state: WorkflowState): WorkflowMetadata {
  return {
    file: state.workflow,
    state: `.claude/turboshovel/workflows/${state.id}.json`,
    prompted: state.prompted || undefined,
  };
}

/**
 * Derive action string from state transition
 */
function deriveAction(
  prevStep: number,
  newStep: number,
  prevRetryCount: number,
  newRetryCount: number,
  retryMax: number,
  isComplete: boolean,
  isBlocked: boolean
): string {
  if (isComplete) return 'COMPLETE';
  if (isBlocked) return 'STOP';
  if (newStep === prevStep && newRetryCount > prevRetryCount) {
    return `RETRY (${newRetryCount}/${retryMax})`;
  }
  if (newStep !== prevStep + 1 && newStep !== prevStep) {
    return `GOTO ${newStep}`;
  }
  return 'CONTINUE';
}

program
  .command('start [file]')
  .description('Start a new workflow or queue a step')
  .option('--step <stepId>', 'Mark step as started (adds to pending queue)')
  .option('--agent <agentId>', 'Bind agent to pending step')
  .option('--prompted', 'Prompted mode: show commands without auto-executing')
  .action(async (file: string | undefined, options: { step?: string; agent?: string; prompted?: boolean }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      // Mode 1: --step - Push step to pending queue
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

        const pendingStep: PendingStep = {
          stepId,
          workflow: file
        };

        await manager.pushPendingStep(state.id, pendingStep);

        const workflowInfo = file ? ` with workflow ${file}` : '';
        console.log(`Step ${stepIdToString(stepId)} queued for agent binding${workflowInfo}`);
        return;
      }

      // Mode 3: --agent - Bind agent to pending step
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

        if (pending.workflow) {
          const workflowPath = await resolveWorkflowFile(cwd, pending.workflow);
          if (!workflowPath) {
            console.error(`Error: Workflow file not found: ${pending.workflow}`);
            process.exit(1);
          }

          const content = await fs.readFile(workflowPath, 'utf8');
          const steps = parseWorkflow(content);

          if (steps.length === 0) {
            console.error('Error: Child workflow has no steps');
            process.exit(1);
          }

          // Inherit prompted flag from parent workflow
          const parentState = await manager.load(state.id);
          const parentPrompted = parentState?.prompted ?? false;

          const childState = await manager.create(pending.workflow, steps, {
            agentId: options.agent,
            parentWorkflowId: state.id,
            parentStepId: pending.stepId,
            prompted: parentPrompted  // Inherit from parent
          });

          await manager.updateAgentBinding(state.id, options.agent, {
            childWorkflowId: childState.id
          });

          await manager.setActive(childState.id);

          // Print metadata and action
          printMetadata(buildMetadata(childState));
          printActionBlock({ action: 'START' });

          // Update lastAction
          await manager.update(childState.id, { lastAction: 'START' });

          // Run execution loop (chains command steps automatically)
          const result = await runExecutionLoop(manager, childState.id, steps, cwd, parentPrompted);

          if (result === 'blocked') {
            process.exit(1);
          }
        }
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
        const state = await manager.create(workflowPath, steps, { prompted: options.prompted });
        await manager.setActive(state.id);

        if (steps[0].substeps && steps[0].substeps.length > 0) {
          await manager.initializeSubsteps(state.id, steps[0].substeps);
        }

        // Print metadata and action
        printMetadata(buildMetadata(state));
        printActionBlock({ action: 'START' });

        // Update lastAction
        await manager.update(state.id, { lastAction: 'START' });

        // Run execution loop (chains command steps automatically)
        const result = await runExecutionLoop(manager, state.id, steps, cwd, !!options.prompted);

        if (result === 'blocked') {
          process.exit(1);
        }
        return;
      }

      if (!file && !options.step && !options.agent) {
        console.error('Error: Workflow file, --step, or --agent option required');
        process.exit(1);
      }
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        console.error(`Error: Workflow file not found: ${file ?? 'unknown'}`);
      } else if (error instanceof WorkflowSyntaxError) {
        console.error(`Syntax error: ${error.message}`);
      } else {
        console.error(`Error: ${getErrorMessage(error)}`);
      }
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
        printNoActiveWorkflow();
        return;
      }

      // Print metadata
      printMetadata(buildMetadata(state));

      if (options.status === 'blocked') {
        await manager.update(state.id, {
          variables: { ...state.variables, blocked: true }
        });
        printWorkflowBlocked(state.step);
      } else {
        await manager.update(state.id, {
          variables: { ...state.variables, completed: true }
        });
        await manager.setActive(null);
        printWorkflowComplete();
      }
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('pass')
  .description('Mark current step as passed (triggers PASS transition)')
  .option('--agent <agentId>', 'Specify agent completing step')
  .action(async (options: { agent?: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      const workflowPath = await resolveWorkflowFile(cwd, state.workflow);
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

      // Handle agent completion (substep case)
      if (options.agent) {
        const binding = await manager.getAgentBinding(state.id, options.agent);
        if (!binding) {
          console.error(`Error: No binding for agent ${options.agent}`);
          process.exit(1);
        }

        let result: 'pass' | 'fail' = 'pass';

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
        console.log(`Agent ${options.agent} marked as pass`);

        const updated = await manager.load(state.id);
        const bindings = Object.values(updated?.agentBindings ?? {});
        const running = bindings.filter((b) => b.status === 'running').length;

        if (running > 0) {
          console.log(`${running} agent(s) still running`);
        } else {
          console.log('All agents complete');
        }
        return;
      }

      // Capture prev state BEFORE mutation
      const prevStep = state.step;
      const prevRetryCount = state.retryCount;
      const totalSteps = steps.length;

      // Send PASS event
      actor.send({ type: 'PASS' });

      const updatedState = await manager.updateFromActor(state.id, actor, steps);
      const snapshot = actor.getPersistedSnapshot() as any;
      const isComplete = snapshot.status === 'done' && snapshot.value === 'complete';
      const isBlocked = snapshot.status === 'done' && snapshot.value === 'blocked';

      // Derive action
      const currentStep = steps[prevStep - 1];
      const retryMax = getStepRetryMax(currentStep);
      const action = deriveAction(
        prevStep, updatedState.step,
        prevRetryCount, updatedState.retryCount,
        retryMax, isComplete, isBlocked
      );

      // Update lastAction
      const actionType = action.startsWith('GOTO') ? 'GOTO' :
                         action.startsWith('RETRY') ? 'RETRY' :
                         action as 'CONTINUE' | 'COMPLETE' | 'STOP';
      await manager.update(state.id, { lastAction: actionType });

      // Print separator and action block
      printSeparator();
      printActionBlock({
        action,
        prev: { current: prevStep, total: totalSteps },
        outcome: 'PASS',
      });

      // Handle completion
      if (isComplete) {
        await manager.update(state.id, { variables: { ...state.variables, completed: true } });
        printWorkflowComplete();
        if (state.parentWorkflowId) {
          await manager.setActive(state.parentWorkflowId);
        } else {
          await manager.setActive(null);
        }
        return;
      }

      if (isBlocked) {
        await manager.update(state.id, { variables: { ...state.variables, blocked: true } });
        printWorkflowBlocked(prevStep);
        process.exit(1);
      }

      // Continue with execution loop
      const loopResult = await runExecutionLoop(manager, state.id, steps, cwd, !!state.prompted);
      if (loopResult === 'blocked') {
        process.exit(1);
      }

    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('fail')
  .description('Mark current step as failed (triggers FAIL transition)')
  .option('--agent <agentId>', 'Specify agent completing step')
  .action(async (options: { agent?: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      const workflowPath = await resolveWorkflowFile(cwd, state.workflow);
      if (!workflowPath) {
        console.error(`Error: Workflow file ${state.workflow} not found`);
        process.exit(1);
      }
      const content = await fs.readFile(workflowPath, 'utf8');
      const steps = parseWorkflow(content);
      const currentStep = steps[state.step - 1];
      const actor = await manager.createActor(state.id, steps);
      if (!actor) {
        console.error('Error: Failed to initialize workflow engine');
        process.exit(1);
      }

      // Handle agent completion (substep case) - REUSE evaluateFailCondition
      if (options.agent) {
        const binding = await manager.getAgentBinding(state.id, options.agent);
        if (!binding) {
          console.error(`Error: No binding for agent ${options.agent}`);
          process.exit(1);
        }

        // Evaluate fail condition for the agent's step (preserves RETRY/GOTO behavior)
        const agentStep = steps[binding.stepId.step - 1];
        const failResult = evaluateFailCondition(agentStep, state.retryCount);

        if (failResult.action === 'retry') {
          actor.send({ type: 'FAIL' });
          await manager.updateFromActor(state.id, actor, steps);
          console.log(`Agent ${options.agent} retrying step ${binding.stepId.step}`);
          // Continue with execution loop for retry
          const loopResult = await runExecutionLoop(manager, state.id, steps, cwd, !!state.prompted);
          if (loopResult === 'blocked') process.exit(1);
          return;
        } else if (failResult.action === 'goto') {
          actor.send({ type: 'FAIL' });
          const updated = await manager.updateFromActor(state.id, actor, steps);
          console.log(`Agent ${options.agent} failed, workflow jumped to step ${updated.step}`);
          // Continue with execution loop after GOTO
          const loopResult = await runExecutionLoop(manager, state.id, steps, cwd, !!state.prompted);
          if (loopResult === 'blocked') process.exit(1);
          return;
        }

        // Only mark binding as fail if no retry/goto triggered
        await manager.updateAgentBinding(state.id, options.agent, {
          status: 'done',
          result: 'fail'
        });
        console.log(`Agent ${options.agent} marked as fail`);

        const updated = await manager.load(state.id);
        const bindings = Object.values(updated?.agentBindings ?? {});
        const running = bindings.filter((b) => b.status === 'running').length;

        if (running > 0) {
          console.log(`${running} agent(s) still running`);
        } else {
          console.log('All agents complete');
        }
        return;
      }

      // Main step fail - send FAIL event to actor
      // Capture prev state BEFORE mutation
      const prevStep = state.step;
      const prevRetryCount = state.retryCount;
      const totalSteps = steps.length;

      // Send FAIL event
      actor.send({ type: 'FAIL' });

      const updatedState = await manager.updateFromActor(state.id, actor, steps);
      const snapshot = actor.getPersistedSnapshot() as any;
      const isComplete = snapshot.status === 'done' && snapshot.value === 'complete';
      const isBlocked = snapshot.status === 'done' && snapshot.value === 'blocked';

      // Derive action
      const retryMax = getStepRetryMax(currentStep);
      const action = deriveAction(
        prevStep, updatedState.step,
        prevRetryCount, updatedState.retryCount,
        retryMax, isComplete, isBlocked
      );

      // Update lastAction
      const actionType = action.startsWith('GOTO') ? 'GOTO' :
                         action.startsWith('RETRY') ? 'RETRY' :
                         action as 'CONTINUE' | 'COMPLETE' | 'STOP';
      await manager.update(state.id, { lastAction: actionType });

      // Print separator and action block
      printSeparator();
      printActionBlock({
        action,
        prev: { current: prevStep, total: totalSteps },
        outcome: 'FAIL',
      });

      // Handle blocked
      if (isBlocked) {
        await manager.update(state.id, { variables: { ...state.variables, blocked: true } });
        printWorkflowBlocked(prevStep);
        if (state.parentWorkflowId) {
          await manager.setActive(state.parentWorkflowId);
        } else {
          await manager.setActive(null);
        }
        process.exit(1);
      }

      // Handle completion (rare for fail, but possible with GOTO to end)
      if (isComplete) {
        await manager.update(state.id, { variables: { ...state.variables, completed: true } });
        printWorkflowComplete();
        if (state.parentWorkflowId) {
          await manager.setActive(state.parentWorkflowId);
        } else {
          await manager.setActive(null);
        }
        return;
      }

      // Continue with execution loop
      const loopResult = await runExecutionLoop(manager, state.id, steps, cwd, !!state.prompted);
      if (loopResult === 'blocked') {
        process.exit(1);
      }

    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('goto <step>')
  .description('Jump to specific step number')
  .action(async (stepArg: string) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      const target = createStepNumber(parseInt(stepArg, 10));
      if (!target) {
        console.error(`Error: Invalid step number: ${stepArg}`);
        process.exit(1);
      }

      const workflowPath = await resolveWorkflowFile(cwd, state.workflow);
      if (!workflowPath) {
        console.error(`Error: Workflow file ${state.workflow} not found`);
        process.exit(1);
      }
      const content = await fs.readFile(workflowPath, 'utf8');
      const steps = parseWorkflow(content);

      if (target > steps.length) {
        console.error(`Error: Step ${target} does not exist (workflow has ${steps.length} steps)`);
        process.exit(1);
      }

      // Direct state update (not via actor - GOTO is manual override)
      await manager.update(state.id, {
        step: target,
        retryCount: 0,
        lastResult: undefined,  // Clear lastResult on GOTO
        snapshot: {
          status: 'active',
          value: `step_${target}`,
          context: {
            retryCount: 0,
            variables: state.variables
          }
        }
      });

      // Update lastAction
      await manager.update(state.id, { lastAction: 'GOTO' });

      // Print separator and action block (no outcome for goto)
      printSeparator();
      printActionBlock({
        action: `GOTO ${target}`,
        prev: { current: state.step, total: steps.length },
      });

      // Continue with execution loop
      const loopResult = await runExecutionLoop(manager, state.id, steps, cwd, !!state.prompted);

      if (loopResult === 'blocked') {
        process.exit(1);
      }

    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
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
      const stashedId = await manager.getStashedWorkflowId();

      if (!state && !stashedId) {
        printNoActiveWorkflow();
        return;
      }

      if (stashedId && !state) {
        const stashed = await manager.load(stashedId);
        if (stashed) {
          printMetadata(buildMetadata(stashed));
          const totalSteps = await getStepCount(cwd, stashed.workflow);
          printWorkflowStashed({ current: stashed.step, total: totalSteps });
        }
        return;
      }

      if (!state) return;

      const workflowPath = await findWorkflowFile(cwd, state.workflow);
      if (!workflowPath) {
        console.error(`Error: Workflow file ${state.workflow} not found`);
        process.exit(1);
      }
      const content = await fs.readFile(workflowPath, 'utf8');
      const steps = parseWorkflow(content);
      const currentStep = steps[state.step - 1];
      const totalSteps = steps.length;

      // Print metadata
      printMetadata(buildMetadata(state));

      // Print action block if lastAction exists
      if (state.lastAction) {
        const actionBlockData: ActionBlockData = {
          action: state.lastAction === 'GOTO' ? `GOTO ${state.step}` :
                  state.lastAction === 'RETRY' ? `RETRY (${state.retryCount}/${getStepRetryMax(currentStep)})` :
                  state.lastAction,
        };
        if (state.lastResult) {
          actionBlockData.outcome = state.lastResult === 'pass' ? 'PASS' : 'FAIL';
        }
        // For status, prev would be the step before current... but we don't track that
        // Just show action without prev for now
        printActionBlock(actionBlockData);
      }

      // Print step block
      if (currentStep) {
        printStepBlock({ current: state.step, total: totalSteps }, currentStep);
      }

      // Show pending steps and agent bindings
      if (state.pendingSteps.length > 0) {
        console.log(`\nPending: ${state.pendingSteps.map((p) => stepIdToString(p.stepId)).join(', ')}`);
      }

      if (Object.keys(state.agentBindings).length > 0) {
        console.log('\nAgents:');
        for (const [agentId, binding] of Object.entries(state.agentBindings)) {
          const stepStr = stepIdToString(binding.stepId);
          const resultStr = binding.result ? ` (${binding.result})` : '';
          console.log(`  ${agentId}: ${stepStr} [${binding.status}]${resultStr}`);
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
        printNoActiveWorkflow();
        return;
      }

      // Print metadata
      printMetadata(buildMetadata(state));

      // Delete and clear
      await manager.delete(state.id);
      await manager.setActive(null);

      // Print terminal message
      printWorkflowStopped();
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
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
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('stash')
  .description('Pause workflow enforcement, preserve state')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        printNoActiveWorkflow();
        return;
      }

      const totalSteps = await getStepCount(cwd, state.workflow);

      // Print metadata
      printMetadata(buildMetadata(state));

      // Stash
      await manager.stash();

      // Print step position and message
      printWorkflowStashed({ current: state.step, total: totalSteps });
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('pop')
  .description('Resume enforcement from stashed workflow')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      const state = await manager.pop();

      if (!state) {
        console.log('No stashed workflow to restore.');
        return;
      }

      const workflowPath = await findWorkflowFile(cwd, state.workflow);
      if (!workflowPath) {
        console.error(`Error: Workflow file ${state.workflow} not found`);
        process.exit(1);
      }
      const content = await fs.readFile(workflowPath, 'utf8');
      const steps = parseWorkflow(content);
      const currentStep = steps[state.step - 1];
      const totalSteps = steps.length;

      // Print metadata
      printMetadata(buildMetadata(state));

      // Print action block if lastAction exists
      if (state.lastAction) {
        const actionBlockData: ActionBlockData = {
          action: state.lastAction === 'GOTO' ? `GOTO ${state.step}` :
                  state.lastAction === 'RETRY' ? `RETRY (${state.retryCount}/${getStepRetryMax(currentStep)})` :
                  state.lastAction,
        };
        if (state.lastResult) {
          actionBlockData.outcome = state.lastResult === 'pass' ? 'PASS' : 'FAIL';
        }
        printActionBlock(actionBlockData);
      }

      // Print step block
      if (currentStep) {
        printStepBlock({ current: state.step, total: totalSteps }, currentStep);
      }
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('gate <name>')
  .description('Run a gate by name')
  .action(async (name: string) => {
    try {
      const cwd = getCwd();
      const { loadConfig } = await import('@turboshovel/shared');
      const config = await loadConfig(cwd);
      if (!config || !(name in config.gates)) {
        console.error(`Gate not found: ${name}`);
        process.exit(1);
      }
      const gate = config.gates[name];
      if (!gate.command) {
        console.error(`Gate has no command: ${name}`);
        process.exit(1);
      }
      const options: ExecSyncOptions = { cwd, stdio: 'inherit', shell: '/bin/bash' };
      execSync(gate.command, options);
      console.log(`Gate ${name}: PASS`);
    } catch {
      console.error(`Gate ${name}: FAIL`);
      process.exit(1);
    }
  });

program
  .command('test [command...]')
  .description('Test command for workflow testing')
  .option('-r, --result <outcome>', 'Add result to sequence (pass|fail)', collect, [])
  .action(async (command: string[] | undefined, options: { result: string[] }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();
      if (!state) {
        console.error('Error: No active workflow.');
        process.exit(1);
      }
      const sequence = options.result.length > 0 ? options.result.map(r => r.toLowerCase()) : DEFAULT_RESULT_SEQUENCE;
      
      // Validate all results are 'pass' or 'fail'
      for (const r of sequence) {
        if (!isValidResult(r)) {
          console.error(`Error: Invalid result "${r}". Use "pass" or "fail".`);
          process.exit(1);
        }
      }

      const retryCount = state.retryCount;
      const index = Math.min(retryCount, sequence.length - 1);
      const result = sequence[index] as 'pass' | 'fail';

      // Load workflow to get current step for retry max
      const workflowPath = await findWorkflowFile(cwd, state.workflow);
      let retryMax = 0;
      if (workflowPath) {
        const workflowContent = await fs.readFile(workflowPath, 'utf8');
        const steps = parseWorkflow(workflowContent);
        const currentStep = steps[state.step - 1];
        if (currentStep) {
          retryMax = getStepRetryMax(currentStep);
        }
      }

      // Output verbose status
      const attempt = retryCount + 1;
      const resultUpper = result.toUpperCase();
      const commandStr = command?.join(' ') ?? '';
      console.log(`[${resultUpper}] ${commandStr} [${attempt}/${retryMax + 1}]`);

      // Exit with appropriate code
      process.exit(result === 'pass' ? 0 : 1);
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
  } catch {
    // File does not exist
  }
  return null;
}

program.parse();
