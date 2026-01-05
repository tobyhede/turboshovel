// packages/cli/src/commands/pass.ts

import * as fs from 'fs/promises';
import type { Command } from 'commander';
import {
  WorkflowStateManager,
  parseWorkflow,
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

export function registerPassCommand(program: Command): void {
  program
    .command('pass')
    .aliases(['yes', 'ok'])
    .description('Mark current step as passed (triggers PASS transition)')
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
        const actor = await manager.createActor(state.id, steps);
        if (!actor) {
          throw new Error('Failed to initialize workflow engine');
        }

        // Handle agent completion (substep case)
        if (options.agent) {
          const binding = await manager.getAgentBinding(state.id, options.agent);
          if (!binding) {
            throw new Error(`No binding for agent ${options.agent}`);
          }

          let result: 'pass' | 'fail' = 'pass';

          if (binding.childWorkflowId) {
            const childResult = await manager.getChildWorkflowResult(binding.childWorkflowId);
            if (childResult === null) {
              throw new Error(`Child workflow still active. Complete or stop it first.\nChild workflow: ${binding.childWorkflowId}`);
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
      });
    });
}
