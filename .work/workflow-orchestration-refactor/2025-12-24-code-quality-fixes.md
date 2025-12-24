# Code Quality Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address 8 non-blocking code quality issues identified in the collated verification report for improved maintainability and consistency.

**Architecture:** Extract magic numbers to constants, consolidate duplicated types, unify TaskId parsing logic, improve error handling consistency, and add edge case tests. Each fix is isolated and independently testable.

**Tech Stack:** TypeScript, Jest

---

## Task 1: Fix Terminology Consistency ("step" → "Task")

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts:401`

**Issue:** Agent A3 - Uses "step" instead of standardized "Task" terminology in pop command output.

**Step 1: Locate and update the string**

In `src/cli/workflow-cli.ts` around line 401, change:

```typescript
// Current:
console.log(`Resuming at step ${state.task}: ${state.taskName}`);

// New:
console.log(`Resuming at Task ${state.task}: ${state.taskName}`);
```

**Step 2: Run tests to verify no regression**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS (no functional change)

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/src/cli/workflow-cli.ts
git commit -m "fix(cli): use 'Task' terminology consistently in pop command"
```

---

## Task 2: Extract Magic Number to Named Constant

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/hooks/task-tracker.ts:52`

**Issue:** Agent A2 - Hardcoded 60 character limit for description truncation.

**Step 1: Add constant and update usage**

In `src/workflow/hooks/task-tracker.ts`, add constant at top of file and update usage:

```typescript
// Add at top of file (after imports):
/** Maximum characters to show in task description before truncation */
const DESCRIPTION_DISPLAY_LIMIT = 60;

// Update line ~52 from:
`Got: "${description.substring(0, 60)}${description.length > 60 ? '...' : ''}"`

// To:
`Got: "${description.substring(0, DESCRIPTION_DISPLAY_LIMIT)}${description.length > DESCRIPTION_DISPLAY_LIMIT ? '...' : ''}"`
```

**Step 2: Run tests**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="task-tracker"`
Expected: PASS

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/hooks/task-tracker.ts
git commit -m "refactor(task-tracker): extract DESCRIPTION_DISPLAY_LIMIT constant"
```

---

## Task 3: Consolidate Session Type Definition

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts:335-350`

**Issue:** Agent A4 - Session file structure defined inline in both `loadSession()` and `saveSession()`.

**Step 1: Extract to named type**

In `src/workflow/state.ts`, add type before `WorkflowStateManager` class:

```typescript
/**
 * Session data stored in session.json
 * Tracks active and stashed workflows
 */
interface SessionData {
  active_workflow: string | null;
  stashedWorkflowId?: string;
}
```

**Step 2: Update loadSession signature**

Replace the inline type with the named type:

```typescript
// From:
private async loadSession(): Promise<{
  active_workflow: string | null;
  stashedWorkflowId?: string;
}> {

// To:
private async loadSession(): Promise<SessionData> {
```

**Step 3: Update saveSession signature**

```typescript
// From:
private async saveSession(session: {
  active_workflow: string | null;
  stashedWorkflowId?: string;
}): Promise<void> {

// To:
private async saveSession(session: SessionData): Promise<void> {
```

**Step 4: Run tests**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="state"`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/state.ts
git commit -m "refactor(state): extract SessionData type for loadSession/saveSession"
```

---

## Task 4: Make Error Handling Consistent (getAgentBinding vs updateAgentBinding)

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts:246-270`
- Modify: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Issue:** Agent A5 - `getAgentBinding` returns null for non-existent workflow, but `updateAgentBinding` throws.

**Step 1: Write the failing test**

Add to `__tests__/workflow/state.test.ts`:

```typescript
describe('getAgentBinding', () => {
  it('throws when workflow not found', async () => {
    const manager = new WorkflowStateManager(tmpDir);
    await expect(manager.getAgentBinding('nonexistent-wf', 'agent-1'))
      .rejects.toThrow('Workflow nonexistent-wf not found');
  });

  it('returns null when agent not bound', async () => {
    const manager = new WorkflowStateManager(tmpDir);
    const state = await manager.create('test.md', 'Task 1');
    const binding = await manager.getAgentBinding(state.id, 'agent-1');
    expect(binding).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="state" -t "getAgentBinding throws"`
Expected: FAIL (currently returns null, doesn't throw)

**Step 3: Update getAgentBinding to throw for missing workflow**

In `src/workflow/state.ts`, update `getAgentBinding`:

```typescript
/**
 * Get agent binding by agent ID
 * @throws Error if workflow not found
 */
async getAgentBinding(id: string, agentId: string): Promise<AgentBinding | null> {
  const state = await this.load(id);
  if (!state) {
    throw new Error(`Workflow ${id} not found`);
  }
  return state.agentBindings?.[agentId] || null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="state" -t "getAgentBinding"`
Expected: PASS

**Step 5: Run full test suite to check for regressions**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/state.ts plugin/hooks/hooks-app/__tests__/workflow/state.test.ts
git commit -m "fix(state): make getAgentBinding throw for missing workflow (consistency)"
```

---

## Task 5: DRY Refactoring - parseConditional Helper

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/helpers.ts:155-210`
- Modify: `plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts`

**Issue:** Agent B3 - Near-identical logic in PASS/FAIL branches of parseConditional.

**Step 1: Extract helper function**

Add above `parseConditional` in `helpers.ts`:

```typescript
/**
 * Parse conditional line starting with given prefix (PASS or FAIL)
 * Returns action and modifier, or null if parsing fails
 */
function parseConditionalPrefix(
  rest: string,
  type: 'pass' | 'fail'
): ParsedConditional | null {
  // Check for aggregation modifier (ALL or ANY)
  let modifier: AggregationModifier = null;
  let remaining = rest;

  // Match modifier: space + (ALL|ANY) + (space or colon or arrow or dash)
  const modifierMatch = remaining.match(/^\s+(ALL|ANY)[\s:→\-]/);
  if (modifierMatch) {
    modifier = modifierMatch[1] as 'ALL' | 'ANY';
    remaining = remaining.slice(modifierMatch[0].length);
  }

  const actionStr = stripSeparator(remaining);
  const action = parseAction(actionStr);
  if (!action) {
    return null;
  }
  return { type, action, modifier };
}
```

**Step 2: Refactor parseConditional to use helper**

Replace the PASS and FAIL blocks:

```typescript
export function parseConditional(text: string): ParsedConditional | null {
  const trimmed = text.trim();

  // Try ALLCAPS first (new syntax)
  if (trimmed.startsWith('PASS')) {
    return parseConditionalPrefix(trimmed.slice(4), 'pass');
  }

  if (trimmed.startsWith('FAIL')) {
    return parseConditionalPrefix(trimmed.slice(4), 'fail');
  }

  // Backward compatibility: old syntax (Pass: / Fail:)
  if (trimmed.startsWith('Pass:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'pass', action, modifier: null };
  }

  if (trimmed.startsWith('Fail:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'fail', action, modifier: null };
  }

  return null;
}
```

**Step 3: Run parser tests**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="helpers"`
Expected: PASS (no functional change)

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/parser/helpers.ts
git commit -m "refactor(parser): extract parseConditionalPrefix helper for DRY"
```

---

## Task 6: Use Conditions Union Type in convertConditionals

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/helpers.ts:257`

**Issue:** Agent B6 - Return type could use `Conditions` union directly instead of inline type.

**Step 1: Extend import to include Conditions type**

At top of `helpers.ts`, extend the existing import (do NOT replace—`createTaskNumber` is a value import):

```typescript
// From:
import { createTaskNumber, type Action, type TaskNumber } from '../types';

// To:
import { createTaskNumber, type Action, type Conditions, type TaskNumber } from '../types';
```

**Step 2: Update return type**

Change function signature:

```typescript
// From:
export function convertConditionals(conditionals: ParsedConditional[]): { all: boolean; pass: Action; fail: Action } | null {

// To:
export function convertConditionals(conditionals: ParsedConditional[]): Conditions | null {
```

**Step 3: Run tests**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="helpers"`
Expected: PASS (types are structurally compatible)

**Step 4: Run build to verify type compatibility**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/parser/helpers.ts
git commit -m "refactor(parser): use Conditions union type in convertConditionals"
```

---

## Task 7: Add Edge Case Test for Multi-Letter Subtask IDs

**Files:**
- Modify: `plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts`

**Issue:** Agent B2 - No test documents that multi-letter subtask IDs like "1.AA" are intentionally rejected.

**Step 1: Add test to document expected behavior**

Add to `helpers.test.ts` in the `extractSubtaskHeader` describe block:

```typescript
describe('edge cases', () => {
  it('rejects multi-letter subtask IDs (by design)', () => {
    // Document that multi-letter IDs like "1.AA" are intentionally not supported
    // Only single letters A-Z are valid subtask identifiers
    expect(extractSubtaskHeader('1.AA First task')).toBeNull();
    expect(extractSubtaskHeader('2.AB Second task')).toBeNull();
  });

  it('accepts single letter subtask IDs', () => {
    const result = extractSubtaskHeader('1.A First task');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('A');
  });

  it('accepts dynamic subtask marker {n}', () => {
    const result = extractSubtaskHeader('1.{n} Dynamic task');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('{n}');
    expect(result?.isDynamic).toBe(true);
  });
});
```

**Step 2: Run test**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="helpers" -t "edge cases"`
Expected: PASS

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts
git commit -m "test(parser): document multi-letter subtask ID rejection behavior"
```

---

## Task 8: Document TaskId Parsing Separation Rationale

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/task-id.ts`
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts`

**Issue:** Agent B5 - Two TaskId parsing functions exist with slightly different regexes. Add documentation explaining the separation.

**Step 1: Add JSDoc to parseTaskId in task-id.ts**

Update the existing JSDoc:

```typescript
/**
 * Parse TaskId from Task tool description (requires separator after ID)
 *
 * This function is used when parsing TaskIds from agent task descriptions where
 * additional text follows the ID. The separator requirement prevents false matches
 * on text that happens to start with a number.
 *
 * Valid formats:
 *   "3 - Review code" -> { task: 3 }
 *   "3.A - First reviewer" -> { task: 3, subtask: 'A' }
 *   "5: Execute" -> { task: 5 }
 *
 * Invalid (no separator):
 *   "3Review" -> null
 *   "3.A" -> null (use parseTaskIdFromArg for raw IDs)
 *
 * @see parseTaskIdFromArg in workflow-cli.ts for CLI argument parsing (no separator)
 */
export function parseTaskId(description: string): TaskId | null {
```

**Step 2: Add JSDoc to parseTaskIdFromArg in workflow-cli.ts**

Update the existing JSDoc:

```typescript
/**
 * Parse TaskId from CLI argument (raw ID, no separator required)
 *
 * This function is used when parsing TaskIds from command-line arguments like
 * `--task 3` or `--task 3.A`. Unlike parseTaskId, it expects the entire string
 * to be the task ID with no trailing description.
 *
 * Valid formats:
 *   "3" -> { task: 3 }
 *   "3.A" -> { task: 3, subtask: 'A' }
 *
 * Invalid:
 *   "3 - description" -> null (separator not expected)
 *   "abc" -> null
 *
 * @see parseTaskId in task-id.ts for parsing IDs from task descriptions
 */
function parseTaskIdFromArg(arg: string): TaskId | null {
```

**Step 3: Run tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/task-id.ts plugin/hooks/hooks-app/src/cli/workflow-cli.ts
git commit -m "docs(task-id): document parseTaskId vs parseTaskIdFromArg separation rationale"
```

---

## Task 9: Final Verification

**Step 1: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: All tests PASS

**Step 2: Run TypeScript compiler**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: No errors

**Step 3: Run linter**

Run: `cd plugin/hooks/hooks-app && npm run lint`
Expected: No new errors

**Step 4: Create summary commit**

```bash
git add -A
git commit -m "chore: complete code quality fixes from verification report"
```
