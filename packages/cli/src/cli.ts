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
  evaluateFailCondition,
  isNodeError,
  getErrorMessage,
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
  type Step,
  type PendingStep,
  type WorkflowMetadata,
  type ActionBlockData,
  type WorkflowState,
} from '@turboshovel/shared';
import { resolveWorkflowFile } from './helpers/resolve-workflow.js';

const program = new Command();

program.name('turboshovel').description('Workflow orchestration CLI').version('1.0.0');

const DEFAULT_RESULT_SEQUENCE: string[] = ['pass'];

/**
 * Check if workflow snapshot indicates completion
 */
function isWorkflowComplete(snapshot: { status: string; value: unknown }): boolean {
  return snapshot.status === 'done' && snapshot.value === 'complete';
}

/**
 * Check if workflow snapshot indicates blocked state
 */
function isWorkflowBlocked(snapshot: { status: string; value: unknown }): boolean {
  return snapshot.status === 'done' && snapshot.value === 'blocked';
}

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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const currentStep = steps[state.step - 1];
    const totalSteps = steps.length;

    // Print step block
    printStepBlock({ current: state.step, total: totalSteps, substep: state.substep }, currentStep);

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
    const prevSubstep = state.substep;
    const prevRetryCount = state.retryCount;

    // Send event to actor
    const actor = await manager.createActor(workflowId, steps);
    if (!actor) return 'blocked';

    actor.send({ type: execResult.success ? 'PASS' : 'FAIL' });
    const updatedState = await manager.updateFromActor(workflowId, actor, steps);

    // XState snapshot type is not fully typed
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const snapshot = actor.getPersistedSnapshot() as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const isComplete = isWorkflowComplete(snapshot);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const isBlocked = isWorkflowBlocked(snapshot);

    // Derive action string
    const retryMax = getStepRetryMax(currentStep);
    const action = deriveAction(
      prevStep,
      updatedState.step,
      prevSubstep,
      updatedState.substep,
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
      from: { current: prevStep, total: totalSteps, substep: prevSubstep },
      result: execResult.success ? 'PASS' : 'FAIL',
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
      printWorkflowBlocked({ current: prevStep, total: totalSteps, substep: prevSubstep });
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
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain, @typescript-eslint/no-unnecessary-condition
  if (step.transitions && step.transitions.fail && step.transitions.fail.type === 'RETRY') {
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
    prompted: state.prompted ?? undefined,
  };
}

/**
 * Derive action string from state transition
 */
function deriveAction(
  prevStep: number,
  newStep: number,
  prevSubstep: string | undefined,
  newSubstep: string | undefined,
  prevRetryCount: number,
  newRetryCount: number,
  retryMax: number,
  isComplete: boolean,
  isBlocked: boolean
): string {
  if (isComplete) return 'COMPLETE';
  if (isBlocked) return 'STOP';
  if (newStep === prevStep && newRetryCount > prevRetryCount) {
    return `RETRY (${String(newRetryCount)}/${String(retryMax)})`;
  }

  // CRITICAL FIX: Any transition with a substep target is a GOTO
  // Even "sequential" step changes (1 → 2) are GOTO if substep is specified
  // Because GOTO 2.1 is meaningfully different from CONTINUE to step 2
  if (newSubstep) {
    return `GOTO ${String(newStep)}.${newSubstep}`;
  }

  // Non-sequential step change without substep
  if (newStep !== prevStep + 1 && newStep !== prevStep) {
    return `GOTO ${String(newStep)}`;
  }

  // Substep cleared (had substep, now doesn't) on same step = unusual, treat as CONTINUE
  // Sequential step change without substep = CONTINUE
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
        const totalSteps = await getStepCount(cwd, state.workflow);
        await manager.update(state.id, {
          variables: { ...state.variables, blocked: true }
        });
        printWorkflowBlocked({ current: state.step, total: totalSteps, substep: state.substep });
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
        const runningCount = bindings.filter((b) => b.status === 'running').length;

        if (runningCount > 0) {
          console.log(`${String(runningCount)} agent(s) still running`);
        } else {
          console.log('All agents complete');
        }
        return;
      }

      // Capture prev state BEFORE mutation
      const prevStep = state.step;
      const prevSubstep = state.substep;
      const prevRetryCount = state.retryCount;
      const totalSteps = steps.length;

      // Send PASS event
      actor.send({ type: 'PASS' });

      const updatedState = await manager.updateFromActor(state.id, actor, steps);
      // XState snapshot type is not fully typed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const snapshot = actor.getPersistedSnapshot() as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const isComplete = isWorkflowComplete(snapshot);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const isBlocked = isWorkflowBlocked(snapshot);

      // Derive action
      const currentStep = steps[prevStep - 1];
      const retryMax = getStepRetryMax(currentStep);
      const action = deriveAction(
        prevStep, updatedState.step,
        prevSubstep, updatedState.substep,
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
        from: { current: prevStep, total: totalSteps, substep: prevSubstep },
        result: 'PASS',
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
        printWorkflowBlocked({ current: prevStep, total: totalSteps, substep: prevSubstep });
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
          console.log(`Agent ${options.agent} retrying step ${String(binding.stepId.step)}`);
          // Continue with execution loop for retry
          const loopResult = await runExecutionLoop(manager, state.id, steps, cwd, !!state.prompted);
          if (loopResult === 'blocked') process.exit(1);
          return;
        } else if (failResult.action === 'goto') {
          actor.send({ type: 'FAIL' });
          const updated = await manager.updateFromActor(state.id, actor, steps);
          console.log(`Agent ${options.agent} failed, workflow jumped to step ${String(updated.step)}`);
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
        const runningCount = bindings.filter((b) => b.status === 'running').length;

        if (runningCount > 0) {
          console.log(`${String(runningCount)} agent(s) still running`);
        } else {
          console.log('All agents complete');
        }
        return;
      }

      // Main step fail - send FAIL event to actor
      // Capture prev state BEFORE mutation
      const prevStep = state.step;
      const prevSubstep = state.substep;
      const prevRetryCount = state.retryCount;
      const totalSteps = steps.length;

      // Send FAIL event
      actor.send({ type: 'FAIL' });

      const updatedState = await manager.updateFromActor(state.id, actor, steps);
      // XState snapshot type is not fully typed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const snapshot = actor.getPersistedSnapshot() as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const isComplete = isWorkflowComplete(snapshot);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const isBlocked = isWorkflowBlocked(snapshot);

      // Derive action
      const retryMax = getStepRetryMax(currentStep);
      const action = deriveAction(
        prevStep, updatedState.step,
        prevSubstep, updatedState.substep,
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
        from: { current: prevStep, total: totalSteps, substep: prevSubstep },
        result: 'FAIL',
      });

      // Handle blocked
      if (isBlocked) {
        await manager.update(state.id, { variables: { ...state.variables, blocked: true } });
        printWorkflowBlocked({ current: prevStep, total: totalSteps, substep: prevSubstep });
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
  .description('Jump to specific step (e.g., "3" or "3.1" for substep)')
  .action(async (stepArg: string) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      // Parse target with StepId
      const target = parseStepIdFromString(stepArg);
      if (!target) {
        console.error(`Error: Invalid step target: ${stepArg}`);
        console.error('Format: N (step) or N.M (step.substep)');
        process.exit(1);
      }

      const workflowPath = await resolveWorkflowFile(cwd, state.workflow);
      if (!workflowPath) {
        console.error(`Error: Workflow file ${state.workflow} not found`);
        process.exit(1);
      }
      const content = await fs.readFile(workflowPath, 'utf8');
      const steps = parseWorkflow(content);

      // Validate step exists
      if (target.step > steps.length) {
        console.error(`Error: Step ${String(target.step)} does not exist (workflow has ${String(steps.length)} steps)`);
        process.exit(1);
      }

      // Validate substep exists (if specified)
      if (target.substep) {
        const step = steps[target.step - 1];
        if (!step.substeps || step.substeps.length === 0) {
          console.error(`Error: Step ${String(target.step)} has no substeps`);
          process.exit(1);
        }
        if (step.substeps.some(s => s.isDynamic)) {
          console.error(`Error: Cannot goto substep of dynamic step. Use: tsv goto ${String(target.step)}`);
          process.exit(1);
        }
        const substepExists = step.substeps.some(s => s.id === target.substep);
        if (!substepExists) {
          console.error(`Error: Substep ${stepIdToString(target)} does not exist`);
          process.exit(1);
        }
      }

      // Create XState actor
      const actor = await manager.createActor(state.id, steps);
      if (!actor) {
        console.error('Error: Failed to initialize workflow engine');
        process.exit(1);
      }

      const prevStep = state.step;
      const prevSubstep = state.substep;

      // SEND GOTO EVENT TO XSTATE (not direct state manipulation!)
      actor.send({ type: 'GOTO', target });

      // Update state from XState (single source of truth)
      // Note: We call updateFromActor to persist the new state, but don't use the return value
      // since we show "from" position in the action block
      await manager.updateFromActor(state.id, actor, steps);

      // Update lastAction and CLEAR lastResult (prevent stale PASS/FAIL leaking)
      await manager.update(state.id, {
        lastAction: 'GOTO',
        lastResult: undefined  // CRITICAL: Clear stale result on manual goto
      });

      // Print output
      printSeparator();
      printActionBlock({
        action: `GOTO ${stepIdToString(target)}`,
        from: { current: prevStep, total: steps.length, substep: prevSubstep },
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
          printWorkflowStashed({ current: stashed.step, total: totalSteps, substep: stashed.substep });
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
          action: state.lastAction === 'GOTO' ? `GOTO ${String(state.step)}` :
                  state.lastAction === 'RETRY' ? `RETRY (${String(state.retryCount)}/${String(getStepRetryMax(currentStep))})` :
                  state.lastAction,
        };
        if (state.lastResult) {
          actionBlockData.result = state.lastResult === 'pass' ? 'PASS' : 'FAIL';
        }
        // For status, from would be the step before current... but we don't track that
        // Just show action without from for now
        printActionBlock(actionBlockData);
      }

      // Print step block
      // currentStep is guaranteed to exist from array index
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (currentStep) {
        printStepBlock({ current: state.step, total: totalSteps, substep: state.substep }, currentStep);
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
      const stashedId = await manager.getStashedWorkflowId();

      if (states.length === 0) {
        printNoWorkflows();
        return;
      }

      for (const state of states) {
        let status: string;
        if (active?.id === state.id) {
          status = 'active';
        } else if (state.id === stashedId) {
          status = 'stashed';
        } else if (state.variables.completed) {
          status = 'complete';
        } else {
          status = 'inactive';
        }

        const totalSteps = await getStepCount(cwd, state.workflow);
        const stepStr = `${String(state.step)}/${String(totalSteps)}`;

        printWorkflowListEntry(state.id, status, stepStr, state.workflow);
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
          action: state.lastAction === 'GOTO' ? `GOTO ${String(state.step)}` :
                  state.lastAction === 'RETRY' ? `RETRY (${String(state.retryCount)}/${String(getStepRetryMax(currentStep))})` :
                  state.lastAction,
        };
        if (state.lastResult) {
          actionBlockData.result = state.lastResult === 'pass' ? 'PASS' : 'FAIL';
        }
        printActionBlock(actionBlockData);
      }

      // Print step block
      // currentStep is guaranteed to exist from array index
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (currentStep) {
        printStepBlock({ current: state.step, total: totalSteps, substep: state.substep }, currentStep);
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
        // currentStep is guaranteed to exist from array index
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (currentStep) {
          retryMax = getStepRetryMax(currentStep);
        }
      }

      // Output verbose status
      const attempt = retryCount + 1;
      const resultUpper = result.toUpperCase();
      const commandStr = command?.join(' ') ?? '';
      console.log(`[${resultUpper}] ${commandStr} [${String(attempt)}/${String(retryMax + 1)}]`);

      // Exit with appropriate code
      process.exit(result === 'pass' ? 0 : 1);
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

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
