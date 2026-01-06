// packages/cli/src/commands/validate.ts

import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { parseWorkflowDocument, validateWorkflow, type ValidationError, type Step } from '@turboshovel/parser';

function formatErrors(errors: ValidationError[]): string {
  return errors
    .map(e => e.line ? `Line ${e.line}: ${e.message}` : e.message)
    .join('\n');
}

function countSubsteps(steps: readonly Step[]): number {
  return steps.reduce((count, step) => {
    return count + (step.substeps?.length || 0);
  }, 0);
}

export function registerValidateCommand(program: Command): void {
  program
    .command('validate <file>')
    .description('Validate a workflow file without starting it')
    .action(async (file: string) => {
      // Resolve file path
      const resolvedPath = path.resolve(file);

      if (!fs.existsSync(resolvedPath)) {
        console.error(`FAIL: File not found: ${file}`);
        process.exit(1);
      }

      try {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        const workflow = parseWorkflowDocument(content, path.basename(resolvedPath));
        const errors = validateWorkflow(workflow.steps);

        if (errors.length > 0) {
          console.log(`FAIL: ${errors.length} error${errors.length > 1 ? 's' : ''}\n`);
          console.log(formatErrors(errors));
          process.exit(1);
        }

        const stepCount = workflow.steps.length;
        const substepCount = countSubsteps(workflow.steps);

        if (substepCount > 0) {
          console.log(`PASS: ${stepCount} step${stepCount > 1 ? 's' : ''}, ${substepCount} substep${substepCount > 1 ? 's' : ''}`);
        } else {
          console.log(`PASS: ${stepCount} step${stepCount > 1 ? 's' : ''}`);
        }
      } catch (error: any) {
        console.error(`FAIL: ${error.message}`);
        process.exit(1);
      }
    });
}
