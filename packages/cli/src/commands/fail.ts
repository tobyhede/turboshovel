// packages/cli/src/commands/fail.ts

import * as fs from 'fs/promises';
import type { Command } from 'commander';
import {
  WorkflowStateManager,
  parseWorkflow,
  evaluateFailCondition,
  printSeparator,
  printActionBlock,
  printWorkflowComplete,
  printWorkflowBlocked,
} from '@turboshovel/shared';
import { resolveWorkflowFile } from '../helpers/resolve-workflow.js';
import { getCwd } from '../helpers/context.js';
import {
  runExecutionLoop,
  deriveAction,
  getStepRetryMax,
  isWorkflowComplete,
  isWorkflowBlocked,
} from '../services/execution.js';
import { withErrorHandling } from '../helpers/wrapper.js';

export function registerFailCommand(program: Command): void {
  program
    .command('fail')
    .alias('no')
    .description('Mark current step as failed (triggers FAIL transition)')
    .option('--agent <agentId>', 'Specify agent completing step')
    .action(async (options: { agent?: string }) => {
      await withErrorHandling(async () => {
        const cwd = getCwd();
        const manager = new WorkflowStateManager(cwd);
        const state = await manager.getActive();

        if (!state) {
          console.log('No active workflow');
          return;
        }

        const workflowPath = await resolveWorkflowFile(cwd, state.workflow);
        if (!workflowPath) {
          throw new Error(`Workflow file ${state.workflow} not found`);
        }
        const content = await fs.readFile(workflowPath, 'utf8');
        const steps = parseWorkflow(content);
        const currentStep = steps[state.step - 1];
        const actor = await manager.createActor(state.id, steps);
        if (!actor) {
          throw new Error('Failed to initialize workflow engine');
        }

        // Handle agent completion (substep case) - REUSE evaluateFailCondition
        if (options.agent) {
          const binding = await manager.getAgentBinding(state.id, options.agent);
          if (!binding) {
            throw new Error(`No binding for agent ${options.agent}`);
          }

          // Evaluate fail condition for the agent's step (preserves RETRY/GOTO behavior)
          const stepNum = binding.stepId.step as number;
          const agentStep = steps[stepNum - 1];
          const failResult = evaluateFailCondition(agentStep, state.retryCount);

          if (failResult.action === 'retry') {
            actor.send({ type: 'FAIL' });
            await manager.updateFromActor(state.id, actor, steps);
            console.log(`Agent ${options.agent} retrying step ${String(stepNum)}`);
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
      });
    });
}
