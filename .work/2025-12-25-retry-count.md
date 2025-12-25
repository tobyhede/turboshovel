# Retry Count Auto-Increment

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** When `--fail` is used, evaluate FAIL condition from workflow and handle RETRY/STOP/GOTO automatically.

**Architecture:** Update `workflow next --fail` (with or without `--agent`) to read task's FAIL condition and act accordingly.

**Tech Stack:** TypeScript, Commander.js CLI

---

## Task 1: Add evaluateFailCondition helper

**Files:**
- Create: `src/cli/condition-handler.ts`
- Test: `__tests__/cli/condition-handler.test.ts`

**Step 1: Write the failing test**

Create `__tests__/cli/condition-handler.test.ts`:

```typescript
import { evaluateFailCondition, type ConditionResult } from '../../src/cli/condition-handler';
import { createTaskNumber, type Task, type Conditions } from '../../src/workflow/types';

describe('evaluateFailCondition', () => {
  const makeTask = (conditions?: Conditions): Task => ({
    number: createTaskNumber(1)!,
    description: 'Test Task',
    prompts: [],
    conditions
  });

  describe('RETRY action', () => {
    it('returns retry with incremented count when under max', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'RETRY', max: 3 }
      });

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('retry');
      expect(result.newRetryCount).toBe(1);
    });

    it('returns blocked when retry count exceeds max', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'RETRY', max: 2 }
      });

      const result = evaluateFailCondition(task, 2, 2);

      expect(result.action).toBe('blocked');
      expect(result.message).toContain('Max retries exceeded');
    });
  });

  describe('STOP action', () => {
    it('returns blocked with message', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'STOP', message: 'Fix the tests' }
      });

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('blocked');
      expect(result.message).toBe('Fix the tests');
    });

    it('returns blocked without message', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'STOP' }
      });

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('blocked');
    });
  });

  describe('GOTO action', () => {
    it('returns goto with target task', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'GOTO', task: createTaskNumber(5)! }
      });

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('goto');
      expect(result.gotoTask).toBe(5);
    });
  });

  describe('no conditions', () => {
    it('returns blocked when task has no conditions', () => {
      const task = makeTask(undefined);

      const result = evaluateFailCondition(task, 0, 3);

      expect(result.action).toBe('blocked');
      expect(result.message).toContain('No FAIL condition');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/core && npm test -- --testPathPattern=condition-handler.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/cli/condition-handler.ts`:

```typescript
import type { Task, TaskNumber } from '../workflow/types';

export interface ConditionResult {
  action: 'retry' | 'blocked' | 'goto' | 'continue';
  newRetryCount?: number;
  gotoTask?: TaskNumber;
  message?: string;
}

/**
 * Evaluate the FAIL condition for a task.
 *
 * @param task - The task with conditions
 * @param currentRetryCount - Current retry count
 * @param retryMax - Maximum retries allowed
 * @returns Action to take based on FAIL condition
 */
export function evaluateFailCondition(
  task: Task,
  currentRetryCount: number,
  retryMax: number
): ConditionResult {
  if (!task.conditions) {
    return {
      action: 'blocked',
      message: 'No FAIL condition defined for task'
    };
  }

  const failAction = task.conditions.fail;

  switch (failAction.type) {
    case 'RETRY': {
      const newCount = currentRetryCount + 1;
      const max = failAction.max ?? retryMax;

      if (newCount > max) {
        return {
          action: 'blocked',
          message: `Max retries exceeded (${max})`
        };
      }

      return {
        action: 'retry',
        newRetryCount: newCount
      };
    }

    case 'STOP':
      return {
        action: 'blocked',
        message: failAction.message
      };

    case 'GOTO':
      return {
        action: 'goto',
        gotoTask: failAction.task
      };

    case 'CONTINUE':
      return { action: 'continue' };

    case 'DONE':
      return { action: 'continue' };

    default:
      return {
        action: 'blocked',
        message: 'Unknown FAIL action'
      };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/core && npm test -- --testPathPattern=condition-handler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/core/src/cli/condition-handler.ts plugin/core/__tests__/cli/condition-handler.test.ts
git commit -m "feat(workflow): add evaluateFailCondition helper for RETRY/STOP/GOTO"
```

---

## Task 2: Update workflow next --fail to use condition handler

**Files:**
- Modify: `src/cli/workflow-cli.ts`
- Modify: `__tests__/cli/workflow-cli.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/cli/workflow-cli.test.ts`:

```typescript
describe('workflow next --fail (condition evaluation)', () => {
  it('retries task when FAIL: RETRY and under max', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(
      workflowPath,
      `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 3
`
    );
    await runCli(['start', workflowPath]);

    const result = await runCli(['next', '--fail']);

    expect(result.stdout).toContain('Retry 1/3');
    expect(result.stdout).toContain('Task 1');

    const manager = new WorkflowStateManager(testDir);
    const state = await manager.getActive();
    expect(state?.retryCount).toBe(1);
    expect(state?.task).toBe(1); // Still on task 1
  });

  it('blocks when FAIL: RETRY and max exceeded', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(
      workflowPath,
      `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 1
`
    );
    await runCli(['start', workflowPath]);
    await runCli(['next', '--fail']); // retry 1

    const result = await runCli(['next', '--fail']); // should block

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Max retries exceeded');
  });

  it('blocks with message when FAIL: STOP', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(
      workflowPath,
      `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP Fix the build
`
    );
    await runCli(['start', workflowPath]);

    const result = await runCli(['next', '--fail']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Fix the build');
  });

  it('jumps to task when FAIL: GOTO', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(
      workflowPath,
      `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: GOTO 3

## 2. Second step

\`\`\`bash
echo "test"
\`\`\`

## 3. Error handler

**Prompt:** Handle the error.
`
    );
    await runCli(['start', workflowPath]);

    const result = await runCli(['next', '--fail']);

    expect(result.stdout).toContain('Task 3');
    expect(result.stdout).toContain('Error handler');

    const manager = new WorkflowStateManager(testDir);
    const state = await manager.getActive();
    expect(state?.task).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/core && npm test -- --testPathPattern=workflow-cli.test.ts`
Expected: FAIL

**Step 3: Update workflow next implementation**

In `src/cli/workflow-cli.ts`, update the `next` command action to handle `--fail` without `--agent`:

```typescript
import { evaluateFailCondition } from './condition-handler';

// ... in the action handler, after agent completion block ...

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
            case 'retry':
              await manager.update(state.id, { retryCount: result.newRetryCount! });
              console.log(`Retry ${result.newRetryCount}/${state.retryMax}`);
              console.log(`Task ${state.task}: ${currentTask.description}`);
              printTaskGuidance(currentTask);
              return;

            case 'blocked':
              console.error(`Error: ${result.message || 'Task blocked'}`);
              process.exit(1);

            case 'goto':
              const gotoTask = tasks[result.gotoTask! - 1];
              await manager.update(state.id, {
                task: result.gotoTask!,
                taskName: gotoTask.description,
                retryCount: 0
              });
              console.log(`Task ${result.gotoTask}: ${gotoTask.description}`);
              printTaskGuidance(gotoTask);
              return;

            case 'continue':
              // Fall through to normal advance
              break;
          }
        }

        // ... rest of existing next logic ...
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/core && npm test -- --testPathPattern=workflow-cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/core/src/cli/workflow-cli.ts plugin/core/__tests__/cli/workflow-cli.test.ts
git commit -m "feat(workflow): evaluate FAIL condition on workflow next --fail"
```

---

## Task 3: Update --fail --agent to use condition handler

**Files:**
- Modify: `src/cli/workflow-cli.ts`
- Modify: `__tests__/cli/workflow-cli.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/cli/workflow-cli.test.ts`:

```typescript
describe('workflow next --fail --agent (with retry)', () => {
  it('retries agent task when FAIL: RETRY', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(
      workflowPath,
      `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 3
`
    );
    await runCli(['start', workflowPath]);
    await runCli(['start', '--task', '1']);
    await runCli(['start', '--agent', 'agent-xyz']);

    const result = await runCli(['next', '--fail', '--agent', 'agent-xyz']);

    // Agent should be marked for retry, not just failed
    expect(result.stdout).toContain('Retry 1/3');

    const manager = new WorkflowStateManager(testDir);
    const state = await manager.getActive();
    // Agent should be re-queued for retry
    expect(state?.agentBindings['agent-xyz'].status).toBe('running');
  });

  it('blocks agent when FAIL: STOP', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(
      workflowPath,
      `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`
    );
    await runCli(['start', workflowPath]);
    await runCli(['start', '--task', '1']);
    await runCli(['start', '--agent', 'agent-xyz']);

    const result = await runCli(['next', '--fail', '--agent', 'agent-xyz']);

    expect(result.stdout).toContain('blocked');

    const manager = new WorkflowStateManager(testDir);
    const state = await manager.getActive();
    expect(state?.agentBindings['agent-xyz'].status).toBe('done');
    expect(state?.agentBindings['agent-xyz'].result).toBe('fail');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/core && npm test -- --testPathPattern=workflow-cli.test.ts`
Expected: FAIL

**Step 3: Update --fail --agent handling**

In `src/cli/workflow-cli.ts`, update the agent completion block:

```typescript
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
                await manager.update(state.id, { retryCount: conditionResult.newRetryCount! });
                console.log(`Retry ${conditionResult.newRetryCount}/${state.retryMax}`);
                console.log(`Agent ${options.agent} retrying task ${binding.taskId.task}`);
                return;

              case 'blocked':
                // Mark agent as failed
                await manager.updateAgentBinding(state.id, options.agent, {
                  status: 'done',
                  result: 'fail'
                });
                console.log(`Agent ${options.agent} blocked: ${conditionResult.message || 'Task failed'}`);
                return;

              case 'goto':
                // Mark agent done, workflow will handle goto
                await manager.updateAgentBinding(state.id, options.agent, {
                  status: 'done',
                  result: 'fail'
                });
                console.log(`Agent ${options.agent} failed, workflow jumping to task ${conditionResult.gotoTask}`);
                return;

              case 'continue':
                // Treat as pass
                break;
            }
          }

          // --pass or continue from above
          const result = options.fail ? 'fail' : 'pass';
          await manager.updateAgentBinding(state.id, options.agent, {
            status: 'done',
            result
          });

          console.log(`Agent ${options.agent} marked as ${result}`);

          // ... rest of existing logic ...
        }
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/core && npm test -- --testPathPattern=workflow-cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/core/src/cli/workflow-cli.ts plugin/core/__tests__/cli/workflow-cli.test.ts
git commit -m "feat(workflow): evaluate FAIL condition for agent retries"
```

---

## Task 4: Run full test suite and update ISSUES.md

**Files:**
- Verify: All tests pass
- Modify: `.work/ISSUES.md`

**Step 1: Run full test suite**

Run: `cd plugin/core && npm test`
Expected: All tests pass

**Step 2: Run lint and build**

Run: `cd plugin/core && npm run lint && npm run build`
Expected: No errors

**Step 3: Update ISSUES.md**

Mark Issue 3 as FIXED with resolution details.

**Step 4: Commit**

```bash
git add .work/ISSUES.md
git commit -m "docs: mark retry count issue as resolved"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add evaluateFailCondition helper | `condition-handler.ts`, `condition-handler.test.ts` |
| 2 | Update `workflow next --fail` | `workflow-cli.ts`, `workflow-cli.test.ts` |
| 3 | Update `--fail --agent` handling | `workflow-cli.ts`, `workflow-cli.test.ts` |
| 4 | Run tests, update ISSUES.md | Verification, `.work/ISSUES.md` |
