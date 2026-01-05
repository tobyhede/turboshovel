// packages/cli/src/commands/list.ts

import type { Command } from 'commander';
import {
  WorkflowStateManager,
  printNoWorkflows,
  printWorkflowListEntry,
} from '@turboshovel/shared';
import { getCwd, getStepCount } from '../helpers/context.js';
import { withErrorHandling } from '../helpers/wrapper.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all workflows')
    .action(async () => {
      await withErrorHandling(async () => {
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

          printWorkflowListEntry(state.id, status, stepStr, state.workflow, state.title);
        }
      });
    });
}
