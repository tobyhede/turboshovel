#!/usr/bin/env node
// packages/cli/src/cli.ts

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync, type ExecSyncOptions } from 'child_process';
import {
  WorkflowStateManager,
  parseWorkflow,
  WorkflowSyntaxError,
  taskIdToString,
  parseTaskIdFromString,
  createTaskNumber,
  incrementTaskNumber,
  evaluateFailCondition,
  evaluatePassCondition,
  isNodeError,
  getErrorMessage,
  type TaskNumber,
  type Action,
  type Task,
  type PendingTask
} from '@turboshovel/shared';
import { resolveWorkflowFile } from './helpers/resolve-workflow.js';

const program = new Command();

program.name('turboshovel').description('Workflow orchestration CLI').version('1.0.0');

function getCwd(): string {
  return process.cwd();
}

program
  .command('start [file]')
  .description('Start a new workflow or queue a task')
  .option('--task <taskId>', 'Mark task as started (adds to pending queue)')
  .option('--agent <agentId>', 'Bind agent to pending task')
  .action(async (file: string | undefined, options: { task?: string; agent?: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      // Mode 1: --task - Push task to pending queue
      if (options.task && !options.agent) {
        const state = await manager.getActive();
        if (!state) {
          console.error('Error: No active workflow');
          process.exit(1);
        }

        // Parse TaskId from CLI argument (raw ID, no separator required)
        const taskId = parseTaskIdFromString(options.task);
        if (!taskId) {
          console.error(`Error: Invalid task ID format: ${options.task}`);
          console.error('Expected format: "3" or "3.1"');
          process.exit(1);
        }

        // file parameter becomes the workflow for this task
        const pendingTask: PendingTask = {
          taskId,
          workflow: file  // Optional workflow file
        };

        await manager.pushPendingTask(state.id, pendingTask);

        const workflowInfo = file ? ` with workflow ${file}` : '';
        console.log(`Task ${taskIdToString(taskId)} queued for agent binding${workflowInfo}`);
        return;
      }

      // Mode 3: --agent - Bind agent to pending task
      if (options.agent) {
        const state = await manager.getActive();
        if (!state) {
          console.error('Error: No active workflow');
          process.exit(1);
        }

        const pending = await manager.popPendingTask(state.id);
        if (!pending) {
          console.error('Error: No pending task to bind');
          process.exit(1);
        }

        await manager.bindAgent(state.id, options.agent, pending.taskId);
        console.log(`Agent ${options.agent} bound to task ${taskIdToString(pending.taskId)}`);

        // If workflow specified, create child workflow
        if (pending.workflow) {
          const workflowPath = await resolveWorkflowFile(cwd, pending.workflow);
          if (!workflowPath) {
            console.error(`Error: Workflow file not found: ${pending.workflow}`);
            process.exit(1);
          }

          const content = await fs.readFile(workflowPath, 'utf8');
          const tasks = parseWorkflow(content);

          if (tasks.length === 0) {
            console.error('Error: Child workflow has no tasks');
            process.exit(1);
          }

          // Create child workflow linked to parent
          const childState = await manager.create(pending.workflow, tasks[0].description, {
            agentId: options.agent,
            parentWorkflowId: state.id,
            parentTaskId: pending.taskId
          });

          // Update agent binding with child workflow ID
          await manager.updateAgentBinding(state.id, options.agent, {
            childWorkflowId: childState.id
          });

          // Set child as active (agent will work on child)
          await manager.setActive(childState.id);

          console.log(`Started child workflow: ${pending.workflow}`);
          console.log(`Child ID: ${childState.id}`);
          console.log(`Task 1: ${tasks[0].description}`);
        }
        return;
      }

      // Mode 2: File start (existing behavior)
      if (file && !options.task && !options.agent) {
        // Read and parse workflow file
        const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);
        const content = await fs.readFile(filePath, 'utf8');
        const tasks = parseWorkflow(content);

        if (tasks.length === 0) {
          console.error('Error: Workflow has no tasks');
          process.exit(1);
        }

        // Create workflow state - store relative path for later lookup
        const workflowPath = path.isAbsolute(file) ? path.relative(cwd, file) : file;
        const state = await manager.create(workflowPath, tasks[0].description);
        await manager.setActive(state.id);

        console.log(`Started workflow: ${workflowPath}`);
        console.log(`ID: ${state.id}`);
        console.log(`Task 1: ${tasks[0].description}`);
        printTaskGuidance(tasks[0]);
        return;
      }

      // If neither file, --task, nor --agent specified
      if (!file && !options.task && !options.agent) {
        console.error('Error: Workflow file, --task, or --agent option required');
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

program
  .command('next')
  .description('Advance to the next step or mark task complete')
  .option('--step <n>', 'Jump to specific step (for GOTO)')
  .option('--pass', 'Mark task as passed')
  .option('--fail', 'Mark task as failed/blocked')
  .option('--retry', 'Retry current task (increment retry count)')
  .option('--task <taskId>', 'Specify which task (for parallel tasks)')
  .option('--agent <agentId>', 'Specify agent completing task')
  .action(
    async (options: {
      step?: string;
      pass?: boolean;
      fail?: boolean;
      retry?: boolean;
      task?: string;
      agent?: string;
    }) => {
      try {
        const cwd = getCwd();
        const manager = new WorkflowStateManager(cwd);
        const state = await manager.getActive();

        if (!state) {
          console.log('No active workflow');
          return;
        }

        // Handle agent completion with --pass/--fail --agent
        if ((options.pass || options.fail) && options.agent) {
          const binding = await manager.getAgentBinding(state.id, options.agent);
          if (!binding) {
            console.error(`Error: No binding for agent ${options.agent}`);
            process.exit(1);
          }

          // If --fail, evaluate FAIL condition
          if (options.fail) {
            const workflowPath = await findWorkflowFile(cwd, state.workflow);
            if (!workflowPath) {
              console.error(`Error: Workflow file ${state.workflow} not found`);
              process.exit(1);
            }

            const content = await fs.readFile(workflowPath, 'utf8');
            const tasks = parseWorkflow(content);
            const agentTask = tasks[binding.taskId.task - 1];

            const conditionResult = evaluateFailCondition(agentTask, state.retryCount, state.retryMax);

            switch (conditionResult.action) {
              case 'retry':
                // Keep agent running, increment retry, re-present task
                if (conditionResult.newRetryCount !== undefined) {
                  await manager.update(state.id, { retryCount: conditionResult.newRetryCount });
                  console.log(`Retry ${conditionResult.newRetryCount}/${state.retryMax}`);
                }
                console.log(`Agent ${options.agent} retrying task ${binding.taskId.task}`);
                return;

              case 'blocked':
                // Mark agent as failed
                await manager.updateAgentBinding(state.id, options.agent, {
                  status: 'done',
                  result: 'fail'
                });
                console.log(`Agent ${options.agent} blocked: ${conditionResult.message ?? 'Task failed'}`);
                return;

              case 'goto':
                // Mark agent done AND update workflow to goto target
                await manager.updateAgentBinding(state.id, options.agent, {
                  status: 'done',
                  result: 'fail'
                });
                await manager.update(state.id, {
                  task: conditionResult.gotoTask,
                  retryCount: 0
                });
                console.log(`Agent ${options.agent} failed, workflow jumped to task ${conditionResult.gotoTask}`);
                return;

              case 'continue':
                // Treat as pass, fall through
                break;
            }
          }

          // --pass or continue from above
          // If agent has child workflow, it must be completed first
          let result: 'pass' | 'fail' = options.fail ? 'fail' : 'pass';
          if (binding.childWorkflowId) {
            const childResult = await manager.getChildWorkflowResult(binding.childWorkflowId);
            if (childResult === null) {
              console.error(`Error: Child workflow still active. Complete or stop it first.`);
              console.error(`Child workflow: ${binding.childWorkflowId}`);
              console.error(`Use: tsv status (to check child) or tsv stop (to abort child)`);
              process.exit(1);
            }
            result = childResult;
          }

          await manager.updateAgentBinding(state.id, options.agent, {
            status: 'done',
            result
          });

          console.log(`Agent ${options.agent} marked as ${result}`);

          // Check if all agents done
          const updated = await manager.load(state.id);
          const bindings = Object.values(updated?.agentBindings ?? {});
          const running = bindings.filter((b) => b.status === 'running').length;

          if (running > 0) {
            console.log(`${running} agent(s) still running`);
          } else {
            console.log('All agents complete. Run: tsv next');
          }
          return;
        }

        // Handle --pass without --agent (main task passed)
        if (options.pass && !options.agent) {
          const workflowPath = await findWorkflowFile(cwd, state.workflow);
          if (!workflowPath) {
            console.error(`Error: Workflow file ${state.workflow} not found`);
            process.exit(1);
          }

          const content = await fs.readFile(workflowPath, 'utf8');
          const tasks = parseWorkflow(content);
          const currentTask = tasks[state.task - 1];

          const result = evaluatePassCondition(currentTask);

          switch (result.action) {
            case 'done':
              await manager.update(state.id, {
                variables: { ...state.variables, completed: true }
              });
              console.log(`Workflow complete: ${state.workflow}`);

              // If this is a child workflow, restore parent as active
              if (state.parentWorkflowId) {
                await manager.setActive(state.parentWorkflowId);
                console.log(`Restored parent workflow: ${state.parentWorkflowId}`);
              } else {
                // Only clear active if no parent
                await manager.setActive(null);
              }
              return;

            case 'blocked':
              console.error(`Error: ${result.message ?? 'Task blocked'}`);
              process.exit(1);
              break;

            case 'goto': {
              if (result.gotoTask !== undefined) {
                const gotoTask = tasks[result.gotoTask - 1];
                await manager.update(state.id, {
                  task: result.gotoTask,
                  taskName: gotoTask.description,
                  retryCount: 0
                });
                console.log(`Task ${result.gotoTask}: ${gotoTask.description}`);
                printTaskGuidance(gotoTask);
              }
              return;
            }

            case 'continue':
              // Fall through to normal advance
              break;
          }
        }

        // Handle --fail without --agent (main task failed)
        if (options.fail && !options.agent) {
          const workflowPath = await findWorkflowFile(cwd, state.workflow);
          if (!workflowPath) {
            console.error(`Error: Workflow file ${state.workflow} not found`);
            process.exit(1);
          }

          const content = await fs.readFile(workflowPath, 'utf8');
          const tasks = parseWorkflow(content);
          const currentTask = tasks[state.task - 1];

          const result = evaluateFailCondition(currentTask, state.retryCount, state.retryMax);

          switch (result.action) {
            case 'retry': {
              if (result.newRetryCount !== undefined) {
                await manager.update(state.id, { retryCount: result.newRetryCount });
                console.log(`Retry ${result.newRetryCount}/${state.retryMax}`);
              }
              console.log(`Task ${state.task}: ${currentTask.description}`);
              printTaskGuidance(currentTask);
              return;
            }

            case 'blocked': {
              // Set blocked variable before stopping
              await manager.update(state.id, {
                variables: { ...state.variables, blocked: true }
              });
              console.error(`Error: ${result.message ?? 'Task blocked'}`);
              process.exit(1);
              break;
            }

            case 'goto': {
              if (result.gotoTask !== undefined) {
                const gotoTask = tasks[result.gotoTask - 1];
                await manager.update(state.id, {
                  task: result.gotoTask,
                  taskName: gotoTask.description,
                  retryCount: 0
                });
                console.log(`Task ${result.gotoTask}: ${gotoTask.description}`);
                printTaskGuidance(gotoTask);
              }
              return;
            }

            case 'continue':
              // Fall through to normal advance
              break;
          }
        }

        // Handle retry
        if (options.retry) {
          const newRetryCount = state.retryCount + 1;

          if (newRetryCount > state.retryMax) {
            console.error(`Error: Max retries exceeded (${state.retryMax})`);
            process.exit(1);
          }

          // Load workflow to get current task
          const workflowPath = await findWorkflowFile(cwd, state.workflow);
          if (!workflowPath) {
            console.error(`Error: Workflow file ${state.workflow} not found`);
            process.exit(1);
          }

          const content = await fs.readFile(workflowPath, 'utf8');
          const tasks = parseWorkflow(content);
          const currentTask = tasks[state.task - 1];

          await manager.update(state.id, {
            retryCount: newRetryCount
          });

          console.log(`Retry ${newRetryCount}/${state.retryMax}`);
          console.log(`Task ${state.task}: ${currentTask.description}`);
          printTaskGuidance(currentTask);
          return;
        }

        // Load workflow definition to get total tasks
        const workflowPath = await findWorkflowFile(cwd, state.workflow);
        if (!workflowPath) {
          console.error(`Error: Workflow file ${state.workflow} not found`);
          process.exit(1);
        }

        const content = await fs.readFile(workflowPath, 'utf8');
        const tasks = parseWorkflow(content);

        // Determine next task
        let nextTaskNumber: TaskNumber | null;
        if (options.step) {
          nextTaskNumber = createTaskNumber(parseInt(options.step, 10));
        } else {
          nextTaskNumber = incrementTaskNumber(state.task);
        }

        if (!nextTaskNumber) {
          console.error('Error: Invalid task number');
          process.exit(1);
        }

        // Check if workflow is complete
        if (nextTaskNumber > tasks.length) {
          // Workflow completed successfully (all tasks finished)
          await manager.update(state.id, {
            variables: { ...state.variables, completed: true }
          });
          console.log(`Workflow complete: ${state.workflow}`);

          // If this is a child workflow, restore parent as active
          if (state.parentWorkflowId) {
            await manager.setActive(state.parentWorkflowId);
            console.log(`Restored parent workflow: ${state.parentWorkflowId}`);
          } else {
            // Only clear active if no parent
            await manager.setActive(null);
          }
          return;
        }

        const nextTask = tasks[nextTaskNumber - 1];

        // Update state (taskNumber already validated)
        await manager.update(state.id, {
          task: nextTaskNumber,
          taskName: nextTask.description,
          retryCount: 0
        });

        console.log(`Task ${nextTaskNumber}: ${nextTask.description}`);
        printTaskGuidance(nextTask);
      } catch (error) {
        console.error(`Error: ${getErrorMessage(error)}`);
        process.exit(1);
      }
    }
  );

program
  .command('complete')
  .description('Mark current workflow as complete')
  .option('--status <status>', 'Completion status (ok|blocked)', 'ok')
  .action(async (options: { status: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      if (options.status === 'blocked') {
        await manager.update(state.id, {
          variables: { ...state.variables, blocked: true }
        });
        console.log(`Workflow BLOCKED: ${state.workflow}`);
      } else {
        await manager.update(state.id, {
          variables: { ...state.variables, completed: true }
        });
        await manager.setActive(null);
        console.log(`Workflow complete: ${state.workflow}`);
      }
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current workflow state')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();
      const stashedId = await manager.getStashedWorkflowId();

      if (!state && !stashedId) {
        console.log('No active workflow');
        return;
      }

      // Show stashed status
      if (stashedId && !state) {
        const stashed = await manager.load(stashedId);
        console.log(`Workflow stashed: ${stashed?.workflow ?? stashedId}`);
        console.log('Enforcement paused. Use "tsv pop" to resume.');
        return;
      }

      if (!state) return;

      console.log(`Workflow: ${state.workflow}`);
      console.log(`ID: ${state.id}`);
      console.log(`Task ${state.task}: ${state.taskName}`);
      console.log(`Retry: ${state.retryCount}/${state.retryMax}`);

      if (Object.keys(state.variables).length > 0) {
        console.log('Variables:', JSON.stringify(state.variables, null, 2));
      }

      // Show pending tasks
      if (state.pendingTasks.length > 0) {
        console.log(`\nPending Tasks: ${state.pendingTasks.map((p) => taskIdToString(p.taskId)).join(', ')}`);
      }

      // Show agent bindings
      if (Object.keys(state.agentBindings).length > 0) {
        console.log('\nAgent Bindings:');
        for (const [agentId, binding] of Object.entries(state.agentBindings)) {
          const taskStr = taskIdToString(binding.taskId);
          const resultStr = binding.result ? ` - ${binding.result}` : '';
          console.log(`  ${agentId}: ${taskStr} [${binding.status}]${resultStr}`);
        }
      }

      // Legacy task display
      if (state.tasks.length > 0) {
        console.log(`\nTasks: ${state.tasks.length}`);
        for (const task of state.tasks) {
          console.log(`  - ${task.id}: ${task.status}`);
        }
      }
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Abort current workflow')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      await manager.delete(state.id);
      await manager.setActive(null);
      console.log(`Stopped workflow: ${state.workflow}`);
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all workflows')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const states = await manager.list();
      const active = await manager.getActive();

      if (states.length === 0) {
        console.log('No workflows');
        return;
      }

      for (const state of states) {
        const marker = active?.id === state.id ? ' (active)' : '';
        console.log(`${state.id}${marker}: ${state.workflow} - Task ${state.task}`);
      }
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('stash')
  .description('Pause workflow enforcement, preserve state')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      const stashedId = await manager.stash();

      if (!stashedId) {
        console.log('No active workflow to stash');
        return;
      }

      console.log(`Workflow stashed: ${stashedId}`);
      console.log('Enforcement paused. Run freely.');
      console.log('Use "tsv pop" to resume.');
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

program
  .command('pop')
  .description('Resume enforcement from stashed workflow')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      const state = await manager.pop();

      if (!state) {
        console.log('No stashed workflow to restore');
        return;
      }

      console.log(`Workflow restored: ${state.workflow}`);
      console.log(`Resuming at Task ${state.task}: ${state.taskName}`);
      console.log('Enforcement active.');
    } catch (error) {
      console.error(`Error: ${getErrorMessage(error)}`);
      process.exit(1);
    }
  });

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

      const options: ExecSyncOptions = {
        cwd,
        stdio: 'inherit',
        shell: '/bin/bash'
      };
      execSync(gate.command, options);
      console.log(`Gate ${name}: PASS`);
    } catch {
      console.error(`Gate ${name}: FAIL`);
      process.exit(1);
    }
  });

function printTaskGuidance(task: Task): void {
  if (task.command) {
    console.log(`\nCommand: ${task.command.code}`);
  }

  if (task.prompts.length > 0) {
    console.log(`\nPrompt: ${task.prompts[0].text}`);
  }

  if (task.conditions) {
    console.log('\nConditions:');
    console.log(`  PASS: ${formatAction(task.conditions.pass)}`);
    console.log(`  FAIL: ${formatAction(task.conditions.fail)}`);
  }

  if (task.nestedWorkflow) {
    console.log(`\nNested workflow: ${task.nestedWorkflow}`);
  }
}

function formatAction(action: Action): string {
  switch (action.type) {
    case 'CONTINUE':
      return 'CONTINUE';
    case 'STOP':
      return action.message ? `STOP "${action.message}"` : 'STOP';
    case 'GOTO':
      return `GOTO ${action.task}`;
    case 'DONE':
      return 'DONE';
    case 'RETRY':
      return action.max ? `RETRY ${action.max}` : 'RETRY';
    default:
      return 'UNKNOWN';
  }
}

async function findWorkflowFile(cwd: string, filename: string): Promise<string | null> {
  // Check if filename is a relative path from cwd (e.g., "plugin/examples/code-review.workflow.md")
  const directPath = path.join(cwd, filename);
  try {
    await fs.access(directPath);
    return directPath;
  } catch {
    // Not found at direct path
  }

  // Check .claude/workflows/ for basename only (fallback for workflows stored there)
  const basename = path.basename(filename);
  const claudeDir = path.join(cwd, '.claude/workflows', basename);
  try {
    await fs.access(claudeDir);
    return claudeDir;
  } catch {
    // Not found
  }

  return null;
}

program.parse();
