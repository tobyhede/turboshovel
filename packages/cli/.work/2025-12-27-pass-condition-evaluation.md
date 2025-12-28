# PASS Condition Evaluation Bug Fix

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix `next --pass` to honor PASS conditions like `PASS: DONE` instead of always advancing to next task. Update both `packages/cli` and `plugin/core` implementations.

**Architecture:** Add `evaluatePassCondition()` function parallel to existing `evaluateFailCondition()`, then add handler block in both CLI implementations to evaluate PASS conditions when `--pass` flag is used without `--agent`. Add unit tests covering all PASS action types.

**Tech Stack:** TypeScript, Node.js, Commander.js, Jest

---

## Task 1: Add `done` action and `evaluatePassCondition` to shared package

**Files:**
- Modify: `packages/shared/src/workflow/condition-handler.ts`

**Step 1: Update ConditionResult interface (line 4)**

Change:
```typescript
  action: 'retry' | 'blocked' | 'goto' | 'continue';
```
To:
```typescript
  action: 'retry' | 'blocked' | 'goto' | 'continue' | 'done';
```

**Step 2: Add evaluatePassCondition function**

Add after line 74 (end of `evaluateFailCondition`):

```typescript

/**
 * Evaluate the PASS condition for a task.
 *
 * @param task - The task with conditions
 * @returns Action to take based on PASS condition
 */
export function evaluatePassCondition(task: Task): ConditionResult {
  if (!task.conditions) {
    // Default: PASS means continue to next task
    return { action: 'continue' };
  }

  const passAction = task.conditions.pass;

  switch (passAction.type) {
    case 'DONE':
      return { action: 'done' };

    case 'GOTO':
      return {
        action: 'goto',
        gotoTask: passAction.task
      };

    case 'STOP':
      return {
        action: 'blocked',
        message: passAction.message
      };

    case 'CONTINUE':
      return { action: 'continue' };

    case 'RETRY':
      // RETRY doesn't make sense for PASS, treat as continue
      return { action: 'continue' };

    default:
      return { action: 'continue' };
  }
}
```

**Step 3: Build shared package**

Run: `cd packages/shared && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shared/src/workflow/condition-handler.ts
git commit -m "feat(shared): add evaluatePassCondition function and done action"
```

---

## Task 2: Mirror changes to plugin condition-handler

**Files:**
- Modify: `plugin/core/src/cli/condition-handler.ts`

**Step 1: Update ConditionResult interface (line 4)**

Change:
```typescript
  action: 'retry' | 'blocked' | 'goto' | 'continue';
```
To:
```typescript
  action: 'retry' | 'blocked' | 'goto' | 'continue' | 'done';
```

**Step 2: Add evaluatePassCondition function**

Add after line 74 (end of file):

```typescript

/**
 * Evaluate the PASS condition for a task.
 *
 * @param task - The task with conditions
 * @returns Action to take based on PASS condition
 */
export function evaluatePassCondition(task: Task): ConditionResult {
  if (!task.conditions) {
    // Default: PASS means continue to next task
    return { action: 'continue' };
  }

  const passAction = task.conditions.pass;

  switch (passAction.type) {
    case 'DONE':
      return { action: 'done' };

    case 'GOTO':
      return {
        action: 'goto',
        gotoTask: passAction.task
      };

    case 'STOP':
      return {
        action: 'blocked',
        message: passAction.message
      };

    case 'CONTINUE':
      return { action: 'continue' };

    case 'RETRY':
      // RETRY doesn't make sense for PASS, treat as continue
      return { action: 'continue' };

    default:
      return { action: 'continue' };
  }
}
```

**Step 3: Build plugin**

Run: `cd plugin/core && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add plugin/core/src/cli/condition-handler.ts
git commit -m "feat(plugin): add evaluatePassCondition function and done action"
```

---

## Task 3: Add unit tests for evaluatePassCondition

**Files:**
- Modify: `plugin/core/__tests__/cli/condition-handler.test.ts`

**Step 1: Update import**

Change line 1:
```typescript
import { evaluateFailCondition } from '../../src/cli/condition-handler.js';
```
To:
```typescript
import { evaluateFailCondition, evaluatePassCondition } from '../../src/cli/condition-handler.js';
```

**Step 2: Add test suite for evaluatePassCondition**

Add after line 92 (before closing of file):

```typescript

describe('evaluatePassCondition', () => {
  const makeTask = (conditions?: Conditions): Task => ({
    number: createTaskNumber(1)!,
    description: 'Test Task',
    prompts: [],
    conditions
  });

  describe('DONE action', () => {
    it('returns done to complete workflow', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'DONE' },
        fail: { type: 'STOP' }
      });

      const result = evaluatePassCondition(task);

      expect(result.action).toBe('done');
    });
  });

  describe('GOTO action', () => {
    it('returns goto with target task', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'GOTO', task: createTaskNumber(5)! },
        fail: { type: 'STOP' }
      });

      const result = evaluatePassCondition(task);

      expect(result.action).toBe('goto');
      expect(result.gotoTask).toBe(5);
    });
  });

  describe('STOP action', () => {
    it('returns blocked with message', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'STOP', message: 'Should not pass' },
        fail: { type: 'STOP' }
      });

      const result = evaluatePassCondition(task);

      expect(result.action).toBe('blocked');
      expect(result.message).toBe('Should not pass');
    });
  });

  describe('CONTINUE action', () => {
    it('returns continue to advance normally', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'STOP' }
      });

      const result = evaluatePassCondition(task);

      expect(result.action).toBe('continue');
    });
  });

  describe('RETRY action', () => {
    it('treats RETRY as continue since retry on pass is nonsensical', () => {
      const task = makeTask({
        all: true,
        pass: { type: 'RETRY', max: 3 },
        fail: { type: 'STOP' }
      });

      const result = evaluatePassCondition(task);

      expect(result.action).toBe('continue');
    });
  });

  describe('no conditions', () => {
    it('returns continue when task has no conditions', () => {
      const task = makeTask(undefined);

      const result = evaluatePassCondition(task);

      expect(result.action).toBe('continue');
    });
  });
});
```

**Step 3: Run tests**

Run: `cd plugin/core && npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add plugin/core/__tests__/cli/condition-handler.test.ts
git commit -m "test(plugin): add evaluatePassCondition unit tests"
```

---

## Task 4: Add --pass handler to packages/cli

**Files:**
- Modify: `packages/cli/src/cli.ts`

**Step 1: Add evaluatePassCondition to import (line 15)**

Add after `evaluateFailCondition,`:
```typescript
  evaluatePassCondition,
```

**Step 2: Add --pass handler block**

Insert BEFORE line 231 (`// Handle --fail without --agent`):

```typescript
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
              console.log(`Workflow complete: ${state.workflow}`);
              await manager.setActive(null);
              return;

            case 'blocked':
              console.error(`Error: ${result.message || 'Task blocked'}`);
              process.exit(1);
              break;

            case 'goto': {
              const gotoTask = tasks[result.gotoTask! - 1];
              await manager.update(state.id, {
                task: result.gotoTask!,
                taskName: gotoTask.description,
                retryCount: 0
              });
              console.log(`Task ${result.gotoTask}: ${gotoTask.description}`);
              printTaskGuidance(gotoTask);
              return;
            }

            case 'continue':
              // Fall through to normal advance
              break;
          }
        }

```

**Step 3: Build CLI package**

Run: `cd packages/cli && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/cli/src/cli.ts
git commit -m "feat(cli): evaluate PASS conditions on next --pass"
```

---

## Task 5: Add --pass handler to plugin workflow-cli

**Files:**
- Modify: `plugin/core/src/cli/workflow-cli.ts`

**Step 1: Add evaluatePassCondition to import**

Find the import for `evaluateFailCondition` and add `evaluatePassCondition`:

```typescript
import { evaluateFailCondition, evaluatePassCondition } from './condition-handler.js';
```

**Step 2: Add --pass handler block**

Insert BEFORE line 235 (`// Handle --fail without --agent`):

```typescript
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
              console.log(`Workflow complete: ${state.workflow}`);
              await manager.setActive(null);
              return;

            case 'blocked':
              console.error(`Error: ${result.message || 'Task blocked'}`);
              process.exit(1);
              break;

            case 'goto': {
              const gotoTask = tasks[result.gotoTask! - 1];
              await manager.update(state.id, {
                task: result.gotoTask!,
                taskName: gotoTask.description,
                retryCount: 0
              });
              console.log(`Task ${result.gotoTask}: ${gotoTask.description}`);
              printTaskGuidance(gotoTask);
              return;
            }

            case 'continue':
              // Fall through to normal advance
              break;
          }
        }

```

**Step 3: Build plugin**

Run: `cd plugin/core && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add plugin/core/src/cli/workflow-cli.ts
git commit -m "feat(plugin): evaluate PASS conditions on next --pass"
```

---

## Task 6: Final verification

**Step 1: Run all tests**

Run: `cd plugin/core && npm test`
Expected: All tests pass (including new evaluatePassCondition tests)

**Step 2: Build all packages**

Run: `cd packages/shared && npm run build && cd ../cli && npm run build && cd ../../plugin/core && npm run build`
Expected: All builds succeed

**Step 3: Manual smoke test**

Create test workflow in `/tmp/test-pass-done.md`:
```markdown
# Test PASS: DONE

## 1. First Task

Do something.

## 2. Second Task

PASS: DONE
FAIL: GOTO 3

This task should complete workflow on pass.

## 3. Error Handler

Handle errors here.
```

Run:
```bash
cd /tmp
tsv start test-pass-done.md
tsv next
tsv next --pass
tsv status
```

Expected:
- `next --pass` outputs: "Workflow complete: test-pass-done.md"
- `status` outputs: "No active workflow"

**Step 4: Commit any stragglers**

Run: `git status`
If uncommitted changes, commit appropriately.
