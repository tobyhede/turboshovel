# Workflow Orchestration: CLI Commands

> **For Claude:** Use cipherpowers:executing-plans (or execute tasks manually if preferred) to implement this plan task-by-task.

**Goal:** Extend CLI with --task, --agent, --pass, --fail flags and new stash/pop commands.

**Architecture:** Commander.js options on existing commands, new stash/pop commands. Uses state manager methods from 02-state-layer.md.

**Tech Stack:** TypeScript, Commander.js

**Prerequisite:** Complete 02-state-layer.md first

---

## Task 1: Extend start Command with --task Option

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts:22-59`
- Test: `plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Step 1: Write failing test for --task option**

Add to `__tests__/cli/workflow-cli.test.ts`. First, update the test infrastructure:

```typescript
// Add to imports at top of file:
import { WorkflowStateManager } from '../../src/workflow/state';

// Update the runCli helper to return structured result (replace existing):
interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const runCli = async (args: string[]): Promise<CliResult> => {
  const cliPath = join(__dirname, '../../dist/cli/workflow-cli.js');
  try {
    const stdout = execSync(`node ${cliPath} ${args.join(' ')}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: { ...process.env, TURBOSHOVEL_LOG: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
    };
  }
};
```

> **Note:** Tests use `testDir` from the existing `beforeEach` setup (lines 16-19), the updated `runCli` helper above, and a fresh `WorkflowStateManager(testDir)` instance per assertion.

Then add the test:

```typescript
describe('workflow start --task', () => {
  it('pushes task to pending queue when workflow active', async () => {
    // First start a workflow
    await runCli(['start', 'test.workflow.md']);

    // Then add a task
    const result = await runCli(['start', '--task', '3.A']);

    expect(result.stdout).toContain('Task 3.A queued');

    // Verify state
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.getActive();
    expect(state?.pendingTasks).toContainEqual({ task: 3, subtask: 'A' });
  });

  it('errors when no active workflow', async () => {
    const result = await runCli(['start', '--task', '1']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No active workflow');
  });

  it('errors for invalid task ID format', async () => {
    await runCli(['start', 'test.workflow.md']);

    const result = await runCli(['start', '--task', 'invalid']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid task ID');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: FAIL - unknown option '--task'

**Step 3: Add --task option to start command**

Update `workflow-cli.ts`:

```typescript
import { parseTaskId, taskIdToString, type TaskId } from '../workflow/task-id';

// ... existing imports ...

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

        const taskId = parseTaskIdFromArg(options.task);
        if (!taskId) {
          console.error(`Error: Invalid task ID format: ${options.task}`);
          console.error('Expected format: "3" or "3.A"');
          process.exit(1);
        }

        await manager.pushPendingTask(state.id, taskId);
        console.log(`Task ${taskIdToString(taskId)} queued for agent binding`);
        return;
      }

      // Mode 2: File start (existing behavior)
      if (file && !options.task && !options.agent) {
        // ... existing file start logic (keep as is) ...
      }

      // If neither file nor --task specified
      if (!file && !options.task) {
        console.error('Error: Workflow file or --task option required');
        process.exit(1);
      }

    } catch (error) {
      // ... existing error handling ...
    }
  });

/**
 * Parse TaskId from CLI argument (e.g., "3" or "3.A")
 */
function parseTaskIdFromArg(arg: string): TaskId | null {
  // Match "3" or "3.A" format
  const match = arg.match(/^(\d+)(?:\.([A-Za-z]))?$/);
  if (!match) return null;

  const task = parseInt(match[1], 10);
  if (task <= 0) return null;

  return {
    task,
    subtask: match[2]?.toUpperCase(),
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/cli/workflow-cli.ts __tests__/cli/workflow-cli.test.ts && git commit -m "feat(cli): add --task option to workflow start"
```

---

## Task 2: Extend start Command with --agent Option

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts`
- Test: `plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Step 1: Write failing test for --agent option**

Add to `__tests__/cli/workflow-cli.test.ts` (uses shared `runCli`, `testDir`, and `WorkflowStateManager` fixtures from Task 1):

```typescript
describe('workflow start --agent', () => {
  it('binds agent to pending task', async () => {
    await runCli(['start', 'test.workflow.md']);
    await runCli(['start', '--task', '2.A']);

    const result = await runCli(['start', '--agent', 'agent-xyz']);

    expect(result.stdout).toContain('Agent agent-xyz bound to task 2.A');

    const manager = new WorkflowStateManager(testDir);
    const state = await manager.getActive();
    expect(state?.agentBindings['agent-xyz']).toBeDefined();
    expect(state?.pendingTasks).toHaveLength(0); // Popped
  });

  it('errors when no pending task', async () => {
    await runCli(['start', 'test.workflow.md']);

    const result = await runCli(['start', '--agent', 'agent-xyz']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No pending task');
  });

  it('errors when no active workflow', async () => {
    const result = await runCli(['start', '--agent', 'agent-xyz']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No active workflow');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: FAIL - --agent not handled

**Step 3: Add --agent handling to start command**

Update the start command action in `workflow-cli.ts`:

```typescript
// Mode 3: --agent - Bind agent to pending task
if (options.agent) {
  const state = await manager.getActive();
  if (!state) {
    console.error('Error: No active workflow');
    process.exit(1);
  }

  const taskId = await manager.popPendingTask(state.id);
  if (!taskId) {
    console.error('Error: No pending task to bind');
    process.exit(1);
  }

  await manager.bindAgent(state.id, options.agent, taskId);
  console.log(`Agent ${options.agent} bound to task ${taskIdToString(taskId)}`);

  // If file also provided, start child workflow (future enhancement)
  if (file) {
    console.log(`Child workflow from ${file} not yet implemented`);
  }
  return;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/cli/workflow-cli.ts __tests__/cli/workflow-cli.test.ts && git commit -m "feat(cli): add --agent option to workflow start"
```

---

## Task 3: Extend next Command with --pass/--fail Options

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts:61-122`
- Test: `plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Step 1: Write failing tests**

Add to `__tests__/cli/workflow-cli.test.ts` (uses shared fixtures from Task 1):

```typescript
describe('workflow next --pass/--fail', () => {
  it('marks agent as passed with --pass --agent', async () => {
    await runCli(['start', 'test.workflow.md']);
    await runCli(['start', '--task', '1']);
    await runCli(['start', '--agent', 'agent-xyz']);

    const result = await runCli(['next', '--pass', '--agent', 'agent-xyz']);

    expect(result.stdout).toContain('agent-xyz');
    expect(result.stdout).toContain('pass');

    const manager = new WorkflowStateManager(testDir);
    const state = await manager.getActive();
    const binding = state?.agentBindings['agent-xyz'];
    expect(binding?.status).toBe('done');
    expect(binding?.result).toBe('pass');
  });

  it('marks agent as failed with --fail --agent', async () => {
    await runCli(['start', 'test.workflow.md']);
    await runCli(['start', '--task', '1']);
    await runCli(['start', '--agent', 'agent-xyz']);

    const result = await runCli(['next', '--fail', '--agent', 'agent-xyz']);

    expect(result.stdout).toContain('fail');

    const manager = new WorkflowStateManager(testDir);
    const state = await manager.getActive();
    expect(state?.agentBindings['agent-xyz'].result).toBe('fail');
  });

  it('errors for unknown agent', async () => {
    await runCli(['start', 'test.workflow.md']);

    const result = await runCli(['next', '--pass', '--agent', 'unknown']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No binding');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: FAIL - unknown options

**Step 3: Add --pass/--fail/--agent to next command**

Update `workflow-cli.ts`:

```typescript
program
  .command('next')
  .description('Advance to the next step or mark task complete')
  .option('--step <n>', 'Jump to specific step (for GOTO)')
  .option('--pass', 'Mark task as passed')
  .option('--fail', 'Mark task as failed/blocked')
  .option('--task <taskId>', 'Specify which task (for parallel tasks)')
  .option('--agent <agentId>', 'Specify agent completing task')
  .action(async (options: {
    step?: string;
    pass?: boolean;
    fail?: boolean;
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

        const result = options.fail ? 'fail' : 'pass';
        await manager.updateAgentBinding(state.id, options.agent, {
          status: 'done',
          result,
        });

        console.log(`Agent ${options.agent} marked as ${result}`);

        // Check if all agents done
        const updated = await manager.load(state.id);
        const bindings = Object.values(updated?.agentBindings || {});
        const running = bindings.filter(b => b.status === 'running').length;

        if (running > 0) {
          console.log(`${running} agent(s) still running`);
        } else {
          console.log('All agents complete. Run: workflow next');
        }
        return;
      }

      // ... existing step advancement logic (keep as is) ...
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/cli/workflow-cli.ts __tests__/cli/workflow-cli.test.ts && git commit -m "feat(cli): add --pass/--fail/--agent to workflow next"
```

---

## Task 4: Add stash Command

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts`
- Test: `plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Step 1: Write failing tests**

Add to `__tests__/cli/workflow-cli.test.ts` (uses shared fixtures from Task 1):

```typescript
describe('workflow stash', () => {
  it('stashes active workflow', async () => {
    await runCli(['start', 'test.workflow.md']);

    const result = await runCli(['stash']);

    expect(result.stdout).toContain('stashed');
    expect(result.stdout).toContain('Enforcement paused');

    const manager = new WorkflowStateManager(testDir);
    const active = await manager.getActive();
    expect(active).toBeNull();

    const stashedId = await manager.getStashedWorkflowId();
    expect(stashedId).not.toBeNull();
  });

  it('reports when nothing to stash', async () => {
    const result = await runCli(['stash']);

    expect(result.stdout).toContain('No active workflow');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: FAIL - unknown command 'stash'

**Step 3: Add stash command**

Add to `workflow-cli.ts`:

```typescript
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
      console.log('Use "workflow pop" to resume.');
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/cli/workflow-cli.ts __tests__/cli/workflow-cli.test.ts && git commit -m "feat(cli): add workflow stash command"
```

---

## Task 5: Add pop Command

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts`
- Test: `plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Step 1: Write failing tests**

Add to `__tests__/cli/workflow-cli.test.ts` (uses shared fixtures from Task 1):

```typescript
describe('workflow pop', () => {
  it('restores stashed workflow', async () => {
    await runCli(['start', 'test.workflow.md']);
    await runCli(['stash']);

    const result = await runCli(['pop']);

    expect(result.stdout).toContain('restored');
    expect(result.stdout).toContain('Enforcement active');

    const manager = new WorkflowStateManager(testDir);
    const active = await manager.getActive();
    expect(active).not.toBeNull();
  });

  it('reports when nothing to pop', async () => {
    const result = await runCli(['pop']);

    expect(result.stdout).toContain('No stashed workflow');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: FAIL - unknown command 'pop'

**Step 3: Add pop command**

Add to `workflow-cli.ts`:

```typescript
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
      console.log(`Resuming at step ${state.task}: ${state.taskName}`);
      console.log('Enforcement active.');
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/cli/workflow-cli.ts __tests__/cli/workflow-cli.test.ts && git commit -m "feat(cli): add workflow pop command"
```

---

## Task 6: Update status Command for Orchestration

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts:154-187`
- Test: `plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Step 1: Write failing tests**

Add to `__tests__/cli/workflow-cli.test.ts` (uses shared fixtures from Task 1):

```typescript
describe('workflow status (orchestration)', () => {
  it('shows pending tasks', async () => {
    await runCli(['start', 'test.workflow.md']);
    await runCli(['start', '--task', '2.A']);
    await runCli(['start', '--task', '2.B']);

    const result = await runCli(['status']);

    expect(result.stdout).toContain('Pending Tasks');
    expect(result.stdout).toContain('2.A');
    expect(result.stdout).toContain('2.B');
  });

  it('shows agent bindings', async () => {
    await runCli(['start', 'test.workflow.md']);
    await runCli(['start', '--task', '1']);
    await runCli(['start', '--agent', 'agent-xyz']);

    const result = await runCli(['status']);

    expect(result.stdout).toContain('Agent Bindings');
    expect(result.stdout).toContain('agent-xyz');
    expect(result.stdout).toContain('running');
  });

  it('shows stashed status', async () => {
    await runCli(['start', 'test.workflow.md']);
    await runCli(['stash']);

    const result = await runCli(['status']);

    expect(result.stdout).toContain('stashed');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: FAIL - orchestration info not shown

**Step 3: Update status command**

Update status command in `workflow-cli.ts`:

```typescript
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
        console.log(`Workflow stashed: ${stashed?.workflow || stashedId}`);
        console.log('Enforcement paused. Use "workflow pop" to resume.');
        return;
      }

      if (!state) return;

      console.log(`Workflow: ${state.workflow}`);
      console.log(`ID: ${state.id}`);
      console.log(`Step ${state.task}: ${state.taskName}`);
      console.log(`Retry: ${state.retryCount}/${state.retryMax}`);

      if (Object.keys(state.variables).length > 0) {
        console.log('Variables:', JSON.stringify(state.variables, null, 2));
      }

      // Show pending tasks
      if (state.pendingTasks && state.pendingTasks.length > 0) {
        console.log(`\nPending Tasks: ${state.pendingTasks.map(taskIdToString).join(', ')}`);
      }

      // Show agent bindings
      if (state.agentBindings && Object.keys(state.agentBindings).length > 0) {
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
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow-cli" --no-coverage`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test --no-coverage`
Expected: PASS (all tests green)

**Step 6: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/cli/workflow-cli.ts __tests__/cli/workflow-cli.test.ts && git commit -m "feat(cli): update status to show orchestration state"
```

---

## Task 7: Update Help Text and Examples

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts` (command descriptions)
- Modify: `plugin/hooks/README.md` (user-facing docs)

**Step 1: Verify help text is self-documenting**

Run: `cd plugin/hooks/hooks-app && npm run build && node dist/cli.js workflow --help`

Expected output should include all new commands and options:

```
Usage: workflow [options] [command]

Manage workflow execution

Options:
  -V, --version         output the version number
  -h, --help            display help for command

Commands:
  start [options] [file]  Start a new workflow or queue a task
  next [options]          Advance to the next step or mark task complete
  status                  Show current workflow state
  stop                    Abort current workflow
  complete [options]      Mark current workflow as complete
  list                    List all workflows
  stash                   Pause workflow enforcement, preserve state
  pop                     Resume enforcement from stashed workflow
```

**Step 2: Verify subcommand help**

Run: `node dist/cli.js workflow start --help`

Expected:
```
Usage: workflow start [options] [file]

Start a new workflow or queue a task

Options:
  --task <taskId>    Mark task as started (adds to pending queue)
  --agent <agentId>  Bind agent to pending task
  -h, --help         display help for command
```

Run: `node dist/cli.js workflow next --help`

Expected:
```
Usage: workflow next [options]

Advance to the next step or mark task complete

Options:
  --step <n>         Jump to specific step (for GOTO)
  --pass             Mark task as passed
  --fail             Mark task as failed/blocked
  --task <taskId>    Specify which task (for parallel tasks)
  --agent <agentId>  Specify agent completing task
  -h, --help         display help for command
```

**Step 3: Update README with orchestration examples**

Add to `plugin/hooks/README.md` under Workflow System section:

```markdown
### Orchestration (Subagent Dispatch)

Queue tasks for subagent binding:
```bash
workflow start --task 3.A      # Queue task 3.A
workflow start --agent xyz123  # Bind agent xyz123 to pending task
```

Mark task completion:
```bash
workflow next --pass --agent xyz123  # Mark agent as passed
workflow next --fail --agent xyz123  # Mark agent as failed
```

Pause enforcement for ad-hoc work:
```bash
workflow stash   # Pause enforcement
# ... do untracked work ...
workflow pop     # Resume enforcement
```
```

**Step 4: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/cli/workflow-cli.ts && cd ../../.. && git add plugin/hooks/README.md && git commit -m "docs(cli): update help text and README for orchestration commands"
```

---

## Exit Criteria

Before proceeding to next plan, verify ALL of the following:

| Criterion | Verification Command |
|-----------|---------------------|
| `--task` queues task | `workflow start test.md && workflow start --task 3.A && workflow status` shows pending |
| `--agent` binds agent | `workflow start --agent xyz && workflow status` shows binding |
| `--pass` marks passed | `workflow next --pass --agent xyz && workflow status` shows pass |
| `--fail` marks failed | `workflow next --fail --agent xyz && workflow status` shows fail |
| `stash` pauses enforcement | `workflow stash && workflow status` shows stashed |
| `pop` resumes workflow | `workflow pop && workflow status` shows active |
| Help text is complete | `workflow --help` shows all commands |
| Subcommand help works | `workflow start --help` shows --task and --agent |
| All CLI tests pass | `npm test -- --testPathPattern="workflow-cli" --no-coverage` |
| All tests pass | `npm test --no-coverage` exits 0 |

**E2E CLI verification:**
```bash
cd plugin/hooks/hooks-app && npm run build
node dist/cli.js workflow start ../examples/code-review.workflow.md
node dist/cli.js workflow start --task 1
node dist/cli.js workflow start --agent test-agent
node dist/cli.js workflow status  # Should show task 1 bound to test-agent
node dist/cli.js workflow stash
node dist/cli.js workflow status  # Should show stashed
node dist/cli.js workflow pop
node dist/cli.js workflow stop
```

---

## Summary

After completing this plan:
- [x] `workflow start --task <taskId>` - queue task for binding
- [x] `workflow start --agent <agentId>` - bind agent to pending task
- [x] `workflow next --pass --agent <id>` - mark agent passed
- [x] `workflow next --fail --agent <id>` - mark agent failed
- [x] `workflow stash` - pause enforcement
- [x] `workflow pop` - resume enforcement
- [x] `workflow status` - shows orchestration state
- [x] Help text and README updated for self-documentation

**Next Plan:** 04-hook-handlers.md - Hook handler integration
