# Step → Task Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename "Step" to "Task" throughout the workflow system for consistent terminology.

**Architecture:** Simple find-and-replace refactoring across 7 source files and their corresponding tests. The branded type `StepNumber` becomes `TaskNumber`, the interface `Step` becomes `Task`, and all variable/property names follow suit.

**Tech Stack:** TypeScript, Jest for testing

---

## Task 1: Rename Core Types in types.ts

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/types.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/types.test.ts`

**Step 1: Update the branded type and factory function**

Replace the entire branded type section in `src/workflow/types.ts`:

```typescript
// BEFORE (lines 3-17)
/**
 * Branded type for step numbers (1-indexed, never zero)
 */
export type StepNumber = number & { readonly __brand: 'StepNumber' };

/**
 * Factory function to create a valid StepNumber
 * Returns null if the number is invalid (zero, negative, or non-integer)
 */
export function createStepNumber(n: number): StepNumber | null {
  if (n <= 0 || !Number.isInteger(n)) {
    return null;
  }
  return n as StepNumber;
}

// AFTER
/**
 * Branded type for task numbers (1-indexed, never zero)
 */
export type TaskNumber = number & { readonly __brand: 'TaskNumber' };

/**
 * Factory function to create a valid TaskNumber
 * Returns null if the number is invalid (zero, negative, or non-integer)
 */
export function createTaskNumber(n: number): TaskNumber | null {
  if (n <= 0 || !Number.isInteger(n)) {
    return null;
  }
  return n as TaskNumber;
}
```

**Step 2: Update Action type GOTO variant**

```typescript
// BEFORE (line 26)
| { readonly type: 'GOTO'; readonly step: StepNumber }

// AFTER
| { readonly type: 'GOTO'; readonly task: TaskNumber }
```

**Step 3: Rename Step interface to Task**

```typescript
// BEFORE (lines 52-62)
/**
 * A single step in a workflow
 */
export interface Step {
  readonly number: StepNumber;
  readonly description: string;
  readonly command?: Command;
  readonly prompts: readonly Prompt[];
  readonly conditions?: Conditions;
  readonly nestedWorkflow?: string;
}

// AFTER
/**
 * A single task in a workflow
 */
export interface Task {
  readonly number: TaskNumber;
  readonly description: string;
  readonly command?: Command;
  readonly prompts: readonly Prompt[];
  readonly conditions?: Conditions;
  readonly nestedWorkflow?: string;
}
```

**Step 4: Update Workflow interface**

```typescript
// BEFORE (line 70)
readonly steps: readonly Step[];

// AFTER
readonly tasks: readonly Task[];
```

**Step 5: Update WorkflowState interface**

```typescript
// BEFORE (lines 90-91)
readonly step: StepNumber;
readonly stepName: string;

// AFTER
readonly task: TaskNumber;
readonly taskName: string;
```

**Step 6: Update test file imports and assertions**

In `__tests__/workflow/types.test.ts`:

```typescript
// BEFORE (line 2)
import { createStepNumber, type StepNumber, type Action } from '../../src/workflow/types';

// AFTER
import { createTaskNumber, type TaskNumber, type Action } from '../../src/workflow/types';

// BEFORE (lines 4-25) - entire describe block
describe('StepNumber', () => {
  test('createStepNumber with valid number returns StepNumber', () => {
    const result = createStepNumber(1);
    // ...

// AFTER
describe('TaskNumber', () => {
  test('createTaskNumber with valid number returns TaskNumber', () => {
    const result = createTaskNumber(1);
    // ...
```

Also update GOTO test (line 47-53):

```typescript
// BEFORE
test('GOTO action with step number', () => {
  const action: Action = { type: 'GOTO', step: 3 as StepNumber };
  expect(action.type).toBe('GOTO');
  if (action.type === 'GOTO') {
    expect(action.step).toBe(3);
  }
});

// AFTER
test('GOTO action with task number', () => {
  const action: Action = { type: 'GOTO', task: 3 as TaskNumber };
  expect(action.type).toBe('GOTO');
  if (action.type === 'GOTO') {
    expect(action.task).toBe(3);
  }
});
```

**Step 7: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/types.ts plugin/hooks/hooks-app/__tests__/workflow/types.test.ts
git commit -m "refactor(workflow): rename Step to Task in core types"
```

---

## Task 2: Update Parser Types

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/types.ts`

**Step 1: Update imports**

```typescript
// BEFORE (line 3)
import type { Action, Step, Conditions, Prompt, Command, StepNumber } from '../types';

// AFTER
import type { Action, Task, Conditions, Prompt, Command, TaskNumber } from '../types';
```

**Step 2: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/parser/types.ts
git commit -m "refactor(workflow): update parser types imports for Task rename"
```

---

## Task 3: Update Parser Helpers

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/helpers.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts`

**Step 1: Update imports**

```typescript
// BEFORE (line 3)
import { createStepNumber, type Action, type StepNumber } from '../types';

// AFTER
import { createTaskNumber, type Action, type TaskNumber } from '../types';
```

**Step 2: Rename extractStepHeader function**

```typescript
// BEFORE (lines 15-51)
/**
 * Extract step number and description from header text
 * Returns null if not a valid step header
 */
export function extractStepHeader(text: string): { number: StepNumber; description: string } | null {
  // ... body stays same except:
  const stepNumber = createStepNumber(number);
  if (!stepNumber) {
    return null; // Invalid step number (zero or negative)
  }
  // ...
  return { number: stepNumber, description };
}

// AFTER
/**
 * Extract task number and description from header text
 * Returns null if not a valid task header
 */
export function extractTaskHeader(text: string): { number: TaskNumber; description: string } | null {
  // ... body stays same except:
  const taskNumber = createTaskNumber(number);
  if (!taskNumber) {
    return null; // Invalid task number (zero or negative)
  }
  // ...

  // KEEP THE GUARD UNCHANGED - still rejects "Step ..." to discourage old terminology
  // Descriptions like "Task setup" are legitimate, so don't reject "Task ..."
  if (description.startsWith('Step ') || description === 'Step') {
    return null;
  }

  // ...
  return { number: taskNumber, description };
}
```

**Step 3: Update GOTO parsing in parseAction**

```typescript
// BEFORE (lines 77-85)
if (trimmed.startsWith('GOTO ')) {
  const stepStr = trimmed.slice(5).trim();
  const stepNum = parseInt(stepStr, 10);
  const step = createStepNumber(stepNum);
  if (!step) {
    return null;
  }
  return { type: 'GOTO', step };
}

// AFTER
if (trimmed.startsWith('GOTO ')) {
  const taskStr = trimmed.slice(5).trim();
  const taskNum = parseInt(taskStr, 10);
  const task = createTaskNumber(taskNum);
  if (!task) {
    return null;
  }
  return { type: 'GOTO', task };
}
```

**Step 4: Remove "Go to Step" parsing only (lines 105-113)**

Only remove the Step-related backward compatibility:

```typescript
// DELETE ONLY THIS BLOCK
if (trimmed.startsWith('Go to Step ')) {
  const stepStr = trimmed.slice(11).trim();
  const stepNum = parseInt(stepStr, 10);
  const step = createStepNumber(stepNum);
  if (!step) {
    return null;
  }
  return { type: 'GOTO', step };
}
```

Keep these (not related to Step→Task):
- `Continue` lowercase handler
- `STOP (message)` parentheses handler

**Step 5: Update any tests in helpers.test.ts**

- Update test descriptions and assertions to reference Task instead of Step
- Remove any tests for "Go to Step" syntax
- Keep tests for Pass:/Fail: lowercase (not related to rename)

**Step 6: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/parser/helpers.ts plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts
git commit -m "refactor(workflow): rename Step to Task in parser helpers"
```

---

## Task 4: Update Main Parser

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/parser.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/parser/parser.test.ts`

**Step 1: Update imports**

```typescript
// BEFORE (line 6)
import type { Step, Action, StepNumber } from '../types';

// AFTER
import type { Task, Action, TaskNumber } from '../types';

// BEFORE (line 7)
import { extractStepHeader, parseConditional, convertConditionals } from './helpers';

// AFTER
import { extractTaskHeader, parseConditional, convertConditionals } from './helpers';
```

**Step 2: Rename StepBuilder interface**

```typescript
// BEFORE (lines 58-63)
interface StepBuilder {
  number: StepNumber;
  description: string;
  command?: { code: string };
  prompts: { text: string }[];
}

// AFTER
interface TaskBuilder {
  number: TaskNumber;
  description: string;
  command?: { code: string };
  prompts: { text: string }[];
}
```

**Step 3: Update parseWorkflow function signature and body**

```typescript
// BEFORE (line 72)
export function parseWorkflow(markdown: string): Step[] {

// AFTER
export function parseWorkflow(markdown: string): Task[] {
```

**Step 4: Rename variable `currentStep` to `currentTask`**

Throughout the function (approx 15 occurrences):
- `let currentStep: StepBuilder | null = null;` → `let currentTask: TaskBuilder | null = null;`
- All references to `currentStep` → `currentTask`

**Step 5: Rename `steps` array to `tasks`**

Throughout the function:
- `const steps: Step[] = [];` → `const tasks: Task[] = [];`
- All references to `steps` → `tasks`

**Step 6: Update function call from extractStepHeader to extractTaskHeader**

```typescript
// BEFORE (line 106)
const parsed = extractStepHeader(headingText);

// AFTER
const parsed = extractTaskHeader(headingText);
```

**Step 7: Update error messages**

```typescript
// BEFORE (lines 90-91)
`H1 headers (# ...) cannot be used as step headers. Use H2 (## ${headingText}) instead.`

// AFTER
`H1 headers (# ...) cannot be used as task headers. Use H2 (## ${headingText}) instead.`

// BEFORE (line 124)
`Multiple code blocks per step not allowed. Step ${currentStep.number} already has a command block.`

// AFTER
`Multiple code blocks per task not allowed. Task ${currentTask.number} already has a command block.`

// ... update all error messages similarly
```

**Step 8: Update finalizeStep to finalizeTask**

```typescript
// BEFORE (line 193)
function finalizeStep(
  step: StepBuilder,
  pendingConditionals: ParsedConditional[],
  implicitText: string
): Step {

// AFTER
function finalizeTask(
  task: TaskBuilder,
  pendingConditionals: ParsedConditional[],
  implicitText: string
): Task {
```

Update function body to use `task` instead of `step`.

**Step 9: Update validateWorkflow**

```typescript
// BEFORE (line 215)
function validateWorkflow(steps: Step[]): void {

// AFTER
function validateWorkflow(tasks: Task[]): void {
```

Update error messages:
- "step" → "task"
- "Steps must be numbered sequentially" → "Tasks must be numbered sequentially"

**Step 10: Update validateAction**

```typescript
// BEFORE (line 243)
function validateAction(action: Action, stepNum: number, totalSteps: number): void {

// AFTER
function validateAction(action: Action, taskNum: number, totalTasks: number): void {
```

Update property access:
```typescript
// BEFORE
const target = action.step as number;

// AFTER
const target = action.task as number;
```

**Step 11: Update parser tests**

In `__tests__/workflow/parser/parser.test.ts`, update:
- `steps` → `tasks` in all assertions
- Variable names like `steps[0]` → `tasks[0]`
- Error message expectations

**Step 12: Run parser tests**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser.test" --no-coverage`
Expected: PASS

**Step 13: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/parser/parser.ts plugin/hooks/hooks-app/__tests__/workflow/parser/parser.test.ts
git commit -m "refactor(workflow): rename Step to Task in parser"
```

---

## Task 5: Update State Manager

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Step 1: Update imports**

```typescript
// BEFORE (line 4)
import { createStepNumber, type WorkflowState } from './types';

// AFTER
import { createTaskNumber, type WorkflowState } from './types';
```

**Step 2: Update create method**

```typescript
// BEFORE (line 35)
async create(workflow: string, stepName: string): Promise<WorkflowState> {

// AFTER
async create(workflow: string, taskName: string): Promise<WorkflowState> {
```

**Step 3: Update state creation**

```typescript
// BEFORE (lines 42-43)
step: createStepNumber(1)!,
stepName,

// AFTER
task: createTaskNumber(1)!,
taskName,
```

**Step 4: Update any tests**

Update assertions that reference `step` or `stepName` properties.

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/state.ts plugin/hooks/hooks-app/__tests__/workflow/state.test.ts
git commit -m "refactor(workflow): rename step to task in state manager"
```

---

## Task 6: Update Context Generator

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/context.ts`

**Step 1: Update output strings**

```typescript
// BEFORE (line 25)
lines.push(`**Step ${state.step}:** ${state.stepName}`);

// AFTER
lines.push(`**Task ${state.task}:** ${state.taskName}`);

// BEFORE (line 68)
lines.push('- Jump to step: `workflow next --step N`');

// AFTER
lines.push('- Jump to task: `workflow next --task N`');
```

**Step 2: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/context.ts
git commit -m "refactor(workflow): rename Step to Task in context output"
```

---

## Task 7: Update CLI

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts`
- Test: `plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Step 1: Update imports**

```typescript
// BEFORE (line 9)
import { createStepNumber, type Action, type Step } from '../workflow/types';

// AFTER
import { createTaskNumber, type Action, type Task } from '../workflow/types';
```

**Step 2: Update start command output**

```typescript
// BEFORE (line 42)
const state = await manager.create(workflowPath, steps[0].description);

// AFTER
const state = await manager.create(workflowPath, tasks[0].description);

// BEFORE (line 47)
console.log(`Step 1: ${steps[0].description}`);

// AFTER
console.log(`Task 1: ${tasks[0].description}`);
```

**Step 3: Update next command**

```typescript
// BEFORE (lines 63-64)
.description('Advance to the next step')
.option('--step <n>', 'Jump to specific step (for GOTO)')

// AFTER
.description('Advance to the next task')
.option('--task <n>', 'Jump to specific task (for GOTO)')

// Update options type
.action(async (options: { task?: string }) => {
```

**Step 4: Update next command body**

Rename all `steps` → `tasks`, `nextStep` → `nextTask`, `stepNumber` → `taskNumber`, etc.

```typescript
// BEFORE
let nextStepNum: number;
if (options.step) {
  nextStepNum = parseInt(options.step, 10);
} else {
  nextStepNum = state.step + 1;
}

// AFTER
let nextTaskNum: number;
if (options.task) {
  nextTaskNum = parseInt(options.task, 10);
} else {
  nextTaskNum = state.task + 1;
}
```

**Step 5: Update status command output**

```typescript
// BEFORE (line 170)
console.log(`Step ${state.step}: ${state.stepName}`);

// AFTER
console.log(`Task ${state.task}: ${state.taskName}`);
```

**Step 6: Update list command output**

```typescript
// BEFORE (line 229)
console.log(`${state.id}${marker}: ${state.workflow} - Step ${state.step}`);

// AFTER
console.log(`${state.id}${marker}: ${state.workflow} - Task ${state.task}`);
```

**Step 7: Rename printStepGuidance to printTaskGuidance**

```typescript
// BEFORE (line 237)
function printStepGuidance(step: Step): void {
  if (step.command) {
    console.log(`\nCommand: ${step.command.code}`);
  }
  // ...
}

// AFTER
function printTaskGuidance(task: Task): void {
  if (task.command) {
    console.log(`\nCommand: ${task.command.code}`);
  }
  // ...
}
```

**Step 8: Update formatAction for GOTO**

```typescript
// BEFORE (line 261)
case 'GOTO': return `GOTO ${action.step}`;

// AFTER
case 'GOTO': return `GOTO ${action.task}`;
```

**Step 9: Update CLI tests**

Update all test expectations for output strings.

**Step 10: Run all tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 11: Commit**

```bash
git add plugin/hooks/hooks-app/src/cli/workflow-cli.ts plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts
git commit -m "refactor(workflow): rename Step to Task in CLI"
```

---

## Task 8: Update Remaining Test Files

**Files:**
- Modify: Any remaining test files with Step references

**Step 1: Search for remaining Step references**

Run: `grep -r "Step" plugin/hooks/hooks-app/__tests__/workflow/`

**Step 2: Update each file found**

Update imports, variable names, and assertion strings.

**Step 3: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/__tests__/
git commit -m "refactor(workflow): update remaining test files for Task rename"
```

---

## Task 9: Update Documentation

**Files:**
- Modify: `plugin/hooks/README.md` - Workflow CLI section only
- Modify: `CLAUDE.md` - Workflow System section only
- Modify: Any `.workflow.md` example files

**Scope:** Only update workflow-specific terminology. Do NOT change generic instructional text like "Step 1: Create context file" - those are documentation steps, not workflow tasks.

**Step 1: Search for workflow-specific Step references**

Run: `grep -n "Step [0-9]" plugin/hooks/*.md CLAUDE.md`
Run: `grep -n "step" plugin/hooks/examples/*.workflow.md`

Look for:
- CLI output examples showing "Step 1:"
- Workflow state references like "current step"
- `--step` flag documentation

Do NOT change:
- Generic numbered instructions ("Step 1: Install...")
- Prose unrelated to workflow system

**Step 2: Update workflow CLI documentation sections**

Only in sections describing the workflow system:
- "Step 1:" → "Task 1:" in CLI output examples
- "--step <n>" → "--task <n>" in usage docs
- "current step" → "current task" in state descriptions

**Step 3: Commit**

```bash
git add plugin/hooks/*.md CLAUDE.md
git commit -m "docs(workflow): update CLI output examples from Step to Task"
```

---

## Task 10: Final Verification

**Step 1: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: All tests PASS

**Step 2: Run linter**

Run: `cd plugin/hooks/hooks-app && npm run lint`
Expected: No errors

**Step 3: Build**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: Build succeeds

**Step 4: Manual test**

```bash
cd /Users/tobyhede/psrc/turboshovel
./plugin/hooks/hooks-app/dist/cli/workflow-cli.js start plugin/hooks/examples/verify-code.workflow.md
./plugin/hooks/hooks-app/dist/cli/workflow-cli.js status
./plugin/hooks/hooks-app/dist/cli/workflow-cli.js stop
```

Expected: Output shows "Task 1:" instead of "Step 1:"

**Step 5: Final commit if needed**

```bash
git status
# If any unstaged changes remain
git add -A
git commit -m "refactor(workflow): complete Step to Task rename"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Core types | types.ts, types.test.ts |
| 2 | Parser types | parser/types.ts |
| 3 | Parser helpers | parser/helpers.ts, helpers.test.ts |
| 4 | Main parser | parser/parser.ts, parser.test.ts |
| 5 | State manager | state.ts, state.test.ts |
| 6 | Context generator | context.ts |
| 7 | CLI | workflow-cli.ts, workflow-cli.test.ts |
| 8 | Remaining tests | __tests__/workflow/*.ts |
| 9 | Documentation | *.md files |
| 10 | Final verification | All files |
