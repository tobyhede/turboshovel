# Workflow Command Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bash command execution to `workflow next` with exit code evaluation, action handling (CONTINUE/GOTO/STOP/DONE/RETRY), and both automatic and agent-controlled modes.

**Architecture:** Enhance the `next` command to optionally execute the current step's bash command, evaluate exit code (0=PASS, non-zero=FAIL), and apply the corresponding action. Provide `--skip-exec` for Claude-controlled execution and `--exit-code N` for agent-injected results.

**Tech Stack:** TypeScript, Node.js child_process, Commander.js

---

### Task 1: Add Executor Module

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/executor.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/executor.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/workflow/executor.test.ts
import { executeCommand, CommandResult } from '../../src/workflow/executor';

describe('executeCommand', () => {
  test('returns success for exit code 0', async () => {
    const result = await executeCommand('exit 0');
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test('returns failure for non-zero exit code', async () => {
    const result = await executeCommand('exit 1');
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  test('captures stdout', async () => {
    const result = await executeCommand('echo hello');
    expect(result.stdout).toContain('hello');
    expect(result.success).toBe(true);
  });

  test('captures stderr', async () => {
    const result = await executeCommand('echo error >&2');
    expect(result.stderr).toContain('error');
  });

  test('handles command not found', async () => {
    const result = await executeCommand('nonexistent_command_xyz');
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=executor`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/workflow/executor.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly success: boolean;
}

export async function executeCommand(code: string, cwd?: string): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execAsync(code, {
      shell: '/bin/sh',
      cwd,
      timeout: 300000, // 5 minute timeout
    });
    return {
      stdout,
      stderr,
      exitCode: 0,
      success: true,
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.code ?? 1,
      success: false,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=executor`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/executor.ts plugin/hooks/hooks-app/__tests__/workflow/executor.test.ts
git commit -m "feat(workflow): add command executor module"
```

---

### Task 2: Add Action Evaluator

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/action-evaluator.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/action-evaluator.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/workflow/action-evaluator.test.ts
import { evaluateAction, ActionOutcome } from '../../src/workflow/action-evaluator';
import { createStepNumber, type Step, type Action } from '../../src/workflow/types';

describe('evaluateAction', () => {
  const makeStep = (conditions?: { pass: Action; fail: Action }): Step => ({
    number: createStepNumber(1)!,
    description: 'Test step',
    prompts: [],
    conditions,
  });

  describe('with explicit conditions', () => {
    test('returns PASS action on success', () => {
      const step = makeStep({
        pass: { type: 'CONTINUE' },
        fail: { type: 'STOP', message: 'Failed' },
      });
      const outcome = evaluateAction(step, true);
      expect(outcome.action).toEqual({ type: 'CONTINUE' });
    });

    test('returns FAIL action on failure', () => {
      const step = makeStep({
        pass: { type: 'CONTINUE' },
        fail: { type: 'STOP', message: 'Failed' },
      });
      const outcome = evaluateAction(step, false);
      expect(outcome.action).toEqual({ type: 'STOP', message: 'Failed' });
    });
  });

  describe('with implicit defaults', () => {
    test('returns CONTINUE on success when no conditions', () => {
      const step = makeStep();
      const outcome = evaluateAction(step, true);
      expect(outcome.action).toEqual({ type: 'CONTINUE' });
    });

    test('returns STOP on failure when no conditions', () => {
      const step = makeStep();
      const outcome = evaluateAction(step, false);
      expect(outcome.action.type).toBe('STOP');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=action-evaluator`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/workflow/action-evaluator.ts
import type { Step, Action } from './types';

export interface ActionOutcome {
  readonly action: Action;
  readonly wasSuccess: boolean;
}

const DEFAULT_PASS: Action = { type: 'CONTINUE' };
const DEFAULT_FAIL: Action = { type: 'STOP' };

export function evaluateAction(step: Step, success: boolean): ActionOutcome {
  if (step.conditions) {
    return {
      action: success ? step.conditions.pass : step.conditions.fail,
      wasSuccess: success,
    };
  }

  // Implicit defaults: PASS → CONTINUE, FAIL → STOP
  return {
    action: success ? DEFAULT_PASS : DEFAULT_FAIL,
    wasSuccess: success,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=action-evaluator`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/action-evaluator.ts plugin/hooks/hooks-app/__tests__/workflow/action-evaluator.test.ts
git commit -m "feat(workflow): add action evaluator for PASS/FAIL conditions"
```

---

### Task 3: Add Step Runner

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/step-runner.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/step-runner.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/workflow/step-runner.test.ts
import { runStep, StepResult } from '../../src/workflow/step-runner';
import { createStepNumber, type Step, type WorkflowState } from '../../src/workflow/types';

describe('runStep', () => {
  const makeStep = (command?: string, conditions?: { pass: any; fail: any }): Step => ({
    number: createStepNumber(1)!,
    description: 'Test step',
    command: command ? { code: command } : undefined,
    prompts: [],
    conditions,
  });

  const makeState = (retryCount = 0): WorkflowState => ({
    id: 'test-id',
    workflow: 'test.md',
    step: createStepNumber(1)!,
    stepName: 'Test step',
    retryCount,
    retryMax: 3,
    variables: {},
    tasks: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  test('executes command and returns CONTINUE on success', async () => {
    const step = makeStep('exit 0', {
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP' },
    });
    const result = await runStep(step, makeState());

    expect(result.action.type).toBe('CONTINUE');
    expect(result.exitCode).toBe(0);
  });

  test('executes command and returns STOP on failure', async () => {
    const step = makeStep('exit 1', {
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP', message: 'Command failed' },
    });
    const result = await runStep(step, makeState());

    expect(result.action.type).toBe('STOP');
    expect(result.exitCode).toBe(1);
  });

  test('handles GOTO action', async () => {
    const step = makeStep('exit 0', {
      pass: { type: 'GOTO', step: createStepNumber(5)! },
      fail: { type: 'STOP' },
    });
    const result = await runStep(step, makeState());

    expect(result.action.type).toBe('GOTO');
    if (result.action.type === 'GOTO') {
      expect(result.action.step).toBe(5);
    }
  });

  test('handles RETRY with increment', async () => {
    const step = makeStep('exit 1', {
      pass: { type: 'CONTINUE' },
      fail: { type: 'RETRY', max: 3 },
    });
    const result = await runStep(step, makeState(0));

    expect(result.action.type).toBe('RETRY');
    expect(result.shouldRetry).toBe(true);
    expect(result.newRetryCount).toBe(1);
  });

  test('RETRY becomes STOP when max reached', async () => {
    const step = makeStep('exit 1', {
      pass: { type: 'CONTINUE' },
      fail: { type: 'RETRY', max: 3 },
    });
    const result = await runStep(step, makeState(3));

    expect(result.shouldRetry).toBe(false);
    expect(result.action.type).toBe('STOP');
  });

  test('skips execution with injected exit code', async () => {
    const step = makeStep('echo should-not-run', {
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP' },
    });
    const result = await runStep(step, makeState(), { injectExitCode: 0 });

    expect(result.action.type).toBe('CONTINUE');
    expect(result.stdout).toBeUndefined(); // Command was not executed
  });

  test('returns CONTINUE for step without command', async () => {
    const step = makeStep(); // No command
    const result = await runStep(step, makeState());

    expect(result.action.type).toBe('CONTINUE');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=step-runner`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/workflow/step-runner.ts
import type { Step, Action, WorkflowState } from './types';
import { executeCommand } from './executor';
import { evaluateAction } from './action-evaluator';

export interface StepResult {
  readonly action: Action;
  readonly exitCode?: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly shouldRetry: boolean;
  readonly newRetryCount: number;
}

export interface RunOptions {
  readonly injectExitCode?: number; // Skip execution, use this exit code
  readonly cwd?: string;
}

export async function runStep(
  step: Step,
  state: WorkflowState,
  options: RunOptions = {}
): Promise<StepResult> {
  // If no command, just continue
  if (!step.command) {
    return {
      action: { type: 'CONTINUE' },
      shouldRetry: false,
      newRetryCount: 0,
    };
  }

  let exitCode: number;
  let stdout: string | undefined;
  let stderr: string | undefined;

  if (options.injectExitCode !== undefined) {
    // Agent-injected exit code (skip actual execution)
    exitCode = options.injectExitCode;
  } else {
    // Execute command
    const result = await executeCommand(step.command.code, options.cwd);
    exitCode = result.exitCode;
    stdout = result.stdout;
    stderr = result.stderr;
  }

  const success = exitCode === 0;
  const { action } = evaluateAction(step, success);

  // Handle RETRY logic
  if (action.type === 'RETRY') {
    const max = action.max ?? state.retryMax;
    const newRetryCount = state.retryCount + 1;

    if (newRetryCount > max) {
      // Retry limit exceeded → STOP
      return {
        action: { type: 'STOP', message: `Retry limit (${max}) exceeded` },
        exitCode,
        stdout,
        stderr,
        shouldRetry: false,
        newRetryCount,
      };
    }

    return {
      action,
      exitCode,
      stdout,
      stderr,
      shouldRetry: true,
      newRetryCount,
    };
  }

  return {
    action,
    exitCode,
    stdout,
    stderr,
    shouldRetry: false,
    newRetryCount: 0,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=step-runner`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/step-runner.ts plugin/hooks/hooks-app/__tests__/workflow/step-runner.test.ts
git commit -m "feat(workflow): add step runner with RETRY handling"
```

---

### Task 4: Update CLI with Execution Options

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts:61-122`
- Test: `plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Step 1: Write the failing tests**

Add to `__tests__/cli/workflow-cli.test.ts`:

```typescript
describe('workflow next with execution', () => {
  test('executes command and advances on PASS', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
exit 0
\`\`\`

- PASS: CONTINUE
- FAIL: STOP

## 2. Second step

Done.
`);

    runCli(`start ${workflowPath}`);
    const output = runCli('next');

    expect(output).toContain('Step 2');
    expect(output).toContain('exit code: 0');
  });

  test('stops workflow on FAIL', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
exit 1
\`\`\`

- PASS: CONTINUE
- FAIL: STOP "Command failed"

## 2. Second step

Should not reach here.
`);

    runCli(`start ${workflowPath}`);

    try {
      runCli('next');
      fail('Should have thrown');
    } catch (error) {
      const e = error as { status: number; stdout: string };
      expect(e.stdout).toContain('STOP');
      expect(e.stdout).toContain('Command failed');
    }
  });

  test('handles GOTO action', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
exit 0
\`\`\`

- PASS: GOTO 3
- FAIL: STOP

## 2. Skipped step

This should be skipped.

## 3. Target step

Jumped here.
`);

    runCli(`start ${workflowPath}`);
    const output = runCli('next');

    expect(output).toContain('Step 3');
    expect(output).toContain('Target step');
  });

  test('--skip-exec skips command execution', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
exit 1
\`\`\`

- PASS: CONTINUE
- FAIL: STOP

## 2. Second step

Done.
`);

    runCli(`start ${workflowPath}`);
    const output = runCli('next --skip-exec');

    expect(output).toContain('Step 2'); // Skipped execution, just advanced
  });

  test('--exit-code injects result without execution', async () => {
    const workflowPath = join(testDir, 'test.workflow.md');
    await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "should not run"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP

## 2. Second step

Done.
`);

    runCli(`start ${workflowPath}`);
    const output = runCli('next --exit-code 0');

    expect(output).toContain('Step 2');
    expect(output).toContain('injected exit code: 0');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=workflow-cli`
Expected: FAIL (--skip-exec and --exit-code not recognized)

**Step 3: Update CLI implementation**

Replace the `next` command in `workflow-cli.ts`:

```typescript
import { runStep } from '../workflow/step-runner';

program
  .command('next')
  .description('Advance to next step (executes command if present)')
  .option('--step <n>', 'Jump to specific step (for GOTO)')
  .option('--skip-exec', 'Skip command execution, just advance')
  .option('--exit-code <n>', 'Inject exit code without executing command')
  .action(async (options: { step?: string; skipExec?: boolean; exitCode?: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      // Load workflow definition
      const workflowPath = await findWorkflowFile(cwd, state.workflow);
      if (!workflowPath) {
        console.error(`Error: Workflow file ${state.workflow} not found`);
        process.exit(1);
      }

      const content = await fs.readFile(workflowPath, 'utf8');
      const steps = parseWorkflow(content);

      // Get current step
      const currentStep = steps[state.step - 1];
      if (!currentStep) {
        console.error(`Error: Step ${state.step} not found`);
        process.exit(1);
      }

      // Determine execution mode
      let nextStepNum: number;

      if (options.step) {
        // Direct jump (--step N)
        nextStepNum = parseInt(options.step, 10);
      } else if (options.skipExec) {
        // Skip execution, just advance
        nextStepNum = state.step + 1;
        console.log('Skipped execution');
      } else {
        // Execute current step and evaluate action
        const injectExitCode = options.exitCode !== undefined
          ? parseInt(options.exitCode, 10)
          : undefined;

        const result = await runStep(currentStep, state, {
          injectExitCode,
          cwd
        });

        // Show execution info
        if (injectExitCode !== undefined) {
          console.log(`Injected exit code: ${injectExitCode}`);
        } else if (result.exitCode !== undefined) {
          console.log(`Exit code: ${result.exitCode}`);
        }

        // Handle action
        switch (result.action.type) {
          case 'CONTINUE':
            nextStepNum = state.step + 1;
            break;

          case 'GOTO':
            nextStepNum = result.action.step;
            console.log(`GOTO Step ${nextStepNum}`);
            break;

          case 'DONE':
            console.log('Workflow DONE');
            await manager.setActive(null);
            return;

          case 'STOP':
            console.log(`STOP: ${result.action.message ?? 'Workflow stopped'}`);
            await manager.setActive(null);
            process.exit(1);
            return;

          case 'RETRY':
            if (result.shouldRetry) {
              // Update retry count, stay on same step
              await manager.update(state.id, {
                retryCount: result.newRetryCount,
              });
              console.log(`RETRY ${result.newRetryCount}/${result.action.max ?? state.retryMax}`);
              console.log(`Step ${state.step}: ${currentStep.description}`);
              printStepGuidance(currentStep);
              return;
            } else {
              // Retry limit exceeded
              console.log(`STOP: ${result.action.message ?? 'Retry limit exceeded'}`);
              await manager.setActive(null);
              process.exit(1);
              return;
            }
        }
      }

      // Check if workflow is complete
      if (nextStepNum > steps.length) {
        console.log(`Workflow complete: ${state.workflow}`);
        await manager.setActive(null);
        return;
      }

      // Validate step number
      const stepNumber = createStepNumber(nextStepNum);
      if (!stepNumber) {
        console.error('Error: Invalid step number');
        process.exit(1);
      }

      const nextStep = steps[nextStepNum - 1];

      // Update state
      await manager.update(state.id, {
        step: stepNumber,
        stepName: nextStep.description,
        retryCount: 0, // Reset retry count on step change
      });

      console.log(`Step ${nextStepNum}: ${nextStep.description}`);
      printStepGuidance(nextStep);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=workflow-cli`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/cli/workflow-cli.ts plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts
git commit -m "feat(workflow): add command execution to workflow next"
```

---

### Task 5: Add Barrel Export

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/index.ts` (create if needed)

**Step 1: Check if index.ts exists**

Run: `ls plugin/hooks/hooks-app/src/workflow/index.ts`
Expected: File not found OR exists

**Step 2: Create or update barrel export**

```typescript
// src/workflow/index.ts
export * from './types';
export * from './state';
export * from './parser';
export * from './executor';
export * from './action-evaluator';
export * from './step-runner';
```

**Step 3: Verify build**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/index.ts
git commit -m "chore(workflow): add barrel exports for workflow modules"
```

---

### Task 6: Update Documentation

**Files:**
- Modify: `plugin/hooks/README.md` (Workflow System section)

**Step 1: Read current documentation**

Run: Read `plugin/hooks/README.md` lines 436-500

**Step 2: Update CLI Commands section**

Add execution options to the Quick Start:

```markdown
### Quick Start

```bash
# Start a workflow
workflow start execute.workflow.md

# Advance to next step (executes command, evaluates exit code)
workflow next

# Jump to specific step (for GOTO loops)
workflow next --step 3

# Skip command execution (Claude controls)
workflow next --skip-exec

# Inject exit code without executing (agent provides result)
workflow next --exit-code 0

# Check status
workflow status

# List all workflows
workflow list

# Stop workflow
workflow stop
```
```

**Step 3: Add Execution Modes section**

After the "Execution Paradigm" section, add:

```markdown
### Command Execution

When `workflow next` is called:

1. **With command**: Execute bash, evaluate exit code (0=PASS, non-zero=FAIL)
2. **Without command**: PASS (continue to next step)
3. **With `--skip-exec`**: Skip execution, just advance (Claude controls)
4. **With `--exit-code N`**: Use N as exit code without executing (agent injection)

**Exit Code Semantics:**
- Exit code 0 → PASS path
- Exit code ≠ 0 → FAIL path

**Action Handling:**

| Action | Behavior |
|--------|----------|
| `CONTINUE` | Advance to next step |
| `GOTO N` | Jump to step N |
| `DONE` | Complete workflow, clear active |
| `STOP "msg"` | Halt workflow with message, exit 1 |
| `RETRY N` | Increment retry count, stay on step (STOP if max exceeded) |

**Implicit Defaults (when no conditions specified):**
- PASS → CONTINUE
- FAIL → STOP
```

**Step 4: Commit**

```bash
git add plugin/hooks/README.md
git commit -m "docs(workflow): add command execution documentation"
```

---

### Task 7: Run Full Test Suite

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: All tests PASS

**Step 2: Run build**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: PASS

**Step 3: Run lint**

Run: `cd plugin/hooks/hooks-app && npm run lint`
Expected: PASS or only pre-existing warnings

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Executor module | `executor.ts`, test |
| 2 | Action evaluator | `action-evaluator.ts`, test |
| 3 | Step runner | `step-runner.ts`, test |
| 4 | CLI update | `workflow-cli.ts`, tests |
| 5 | Barrel export | `index.ts` |
| 6 | Documentation | `README.md` |
| 7 | Verification | tests, build, lint |
