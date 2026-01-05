// packages/cli/src/commands/workflows.ts

import type { Command } from 'commander';
import { discoverWorkflows } from '../services/discovery.js';
import { getCwd } from '../helpers/context.js';
import { withErrorHandling } from '../helpers/wrapper.js';
import type { DiscoveredWorkflow } from '../services/discovery.js';

export function registerWorkflowsCommand(program: Command): void {
  program
    .command('workflows')
    .description('List available workflows')
    .option('--json', 'Output as JSON for programmatic use')
    .option('--tags <tags>', 'Filter by comma-separated tags')
    .action(async (options: { json?: boolean; tags?: string }) => {
      await withErrorHandling(async () => {
        const cwd = getCwd();
        let workflows = await discoverWorkflows(cwd);

        // Filter by tags if specified
        if (options.tags) {
          const filterTags = options.tags.split(',').map((t) => t.trim().toLowerCase());
          workflows = workflows.filter((w) =>
            w.tags?.some((tag) => filterTags.includes(tag.toLowerCase()))
          );
        }

        if (workflows.length === 0) {
          console.log('No workflows found.');
          return;
        }

        if (options.json) {
          // JSON output for programmatic use
          const output = workflows.map((w) => ({
            name: w.name,
            source: w.source,
            description: w.description,
            tags: w.tags,
            path: w.path,
          }));
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Table output
        console.log('Available workflows:\n');

        for (const workflow of workflows) {
          const displayName =
            workflow.source === 'plugin' ? `${workflow.name} [${workflow.source}]` : workflow.name;
          const description = workflow.description ? ` - ${workflow.description}` : '';
          console.log(`  ${displayName}${description}`);
        }

        console.log("\nUse 'tsv start <name>' to start a workflow.");
      });
    });
}
