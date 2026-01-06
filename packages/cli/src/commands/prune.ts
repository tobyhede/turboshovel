// packages/cli/src/commands/prune.ts

import type { Command } from 'commander';
import { WorkflowStateManager } from '@turboshovel/shared';
import { getCwd } from '../helpers/context.js';
import { withErrorHandling } from '../helpers/wrapper.js';

export function registerPruneCommand(program: Command): void {
  program
    .command('prune')
    .description('Remove completed workflow state')
    .option('--dry-run', 'Show what would be removed without deleting')
    .action(async (options: { dryRun?: boolean }) => {
      await withErrorHandling(async () => {
        const cwd = getCwd();
        const manager = new WorkflowStateManager(cwd);
        const states = await manager.list();
        const active = await manager.getActive();
        const stashedId = await manager.getStashedWorkflowId();

        // Only delete completed, non-active, non-stashed state
        const toDelete = states.filter((state) => {
          const isActive = active?.id === state.id;
          const isStashed = state.id === stashedId;
          const isCompleted = state.variables.completed;
          return isCompleted && !isActive && !isStashed;
        });

        if (toDelete.length === 0) {
          console.log('No completed workflow state to prune.');
          return;
        }

        if (options.dryRun) {
          console.log('Would remove state for:');
          for (const state of toDelete) {
            console.log(`  ${state.id} (${state.title || state.workflow})`);
          }
          return;
        }

        for (const state of toDelete) {
          await manager.delete(state.id);
        }
        console.log(`Pruned state for ${toDelete.length} completed workflow(s).`);
      });
    });
}
