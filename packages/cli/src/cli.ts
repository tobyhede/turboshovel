#!/usr/bin/env node
// packages/cli/src/cli.ts

import { Command as CommandClass } from 'commander';
import { registerRunCommand } from './commands/run.js';
import { registerGotoCommand } from './commands/goto.js';
import { registerPassCommand } from './commands/pass.js';
import { registerFailCommand } from './commands/fail.js';
import { registerCompleteCommand } from './commands/complete.js';
import { registerStatusCommand } from './commands/status.js';
import { registerStopCommand } from './commands/stop.js';
import { registerLsCommand } from './commands/ls.js';
import { registerStashCommand } from './commands/stash.js';
import { registerPopCommand } from './commands/pop.js';
import { registerGateCommand } from './commands/gate.js';
import { registerEchoCommand } from './commands/echo.js';
import { registerCheckCommand } from './commands/check.js';

const program = new CommandClass();

program.name('turboshovel').description('Workflow orchestration CLI').version('1.0.0');

registerRunCommand(program);

registerPassCommand(program);

registerFailCommand(program);

registerCompleteCommand(program);

registerGotoCommand(program);

registerStatusCommand(program);

registerStopCommand(program);

registerLsCommand(program);

registerStashCommand(program);

registerPopCommand(program);

registerGateCommand(program);

registerEchoCommand(program);

registerCheckCommand(program);

program.parse();