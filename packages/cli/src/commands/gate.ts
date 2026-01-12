// packages/cli/src/commands/gate.ts

import type { Command } from 'commander';
import { execSync, type ExecSyncOptions } from 'child_process';
import { getCwd } from '../helpers/context.js';

/**
 * Register the 'gate' command with the CLI program.
 * Adds 'turboshovel gate <name>' command to run named gates.
 *
 * @param program - The Commander program instance to register the command on
 */
export function registerGateCommand(program: Command): void {
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
}
