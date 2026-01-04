// packages/cli/src/commands/start.ts

import type { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  WorkflowStateManager,
  parseWorkflow,
  WorkflowSyntaxError,
  stepIdToString,
  parseStepIdFromString,
  isNodeError,
  getErrorMessage,
  printMetadata,
  printActionBlock,
  type PendingStep,
} from '@turboshovel/shared';
import { resolveWorkflowFile } from '../helpers/resolve-workflow.js';
import { getCwd } from '../helpers/context.js';
import {
  runExecutionLoop,
  buildMetadata,
} from '../services/execution.js';

export function registerStartCommand(program: Command): void {
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
}
