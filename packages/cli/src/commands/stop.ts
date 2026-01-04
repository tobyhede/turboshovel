// packages/cli/src/commands/stop.ts

import type { Command } from 'commander';
import {
  WorkflowStateManager,
  printMetadata,
  printWorkflowStopped,
  printNoActiveWorkflow,
} from '@turboshovel/shared';
import { getCwd } from '../helpers/context.js';
import { buildMetadata } from '../services/execution.js';
import { withErrorHandling } from '../helpers/wrapper.js';

export function registerStopCommand(program: Command): void {
  program
    .command('stop')
    .description('Abort current workflow')
    .action(async () => {
      await withErrorHandling(async () => {
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
      });
    });
}
