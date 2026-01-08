#!/usr/bin/env node
// packages/cli/src/cli.ts

import { Command as CommandClass } from 'commander';
import { registerGateCommand } from './commands/gate.js';

const program = new CommandClass();

program.name('turboshovel').description('Quality gates CLI').version('1.0.0');

registerGateCommand(program);

program.parse();
