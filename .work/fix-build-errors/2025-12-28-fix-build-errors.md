# Fix Build Errors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 TypeScript build errors in the workflow system (6 in parser.ts, 1 in schemas.ts/state.ts).

**Architecture:** Add type guards for mdast node narrowing; use Zod `.transform()` for branded type inference.

**Tech Stack:** TypeScript, Zod, mdast/unist types

---

## Task 1: Add Type Guard for Heading Nodes

**Files:**
- Modify: `packages/shared/src/workflow/parser/parser.ts:1-25`

**Step 1: Add isHeading type guard after imports**

Add this function after line 24 (after the imports, before `extractText`):

```typescript
/**
 * Type guard to narrow Node to Heading
 * Required because unist-util-visit types callback node as base Node
 */
function isHeading(node: Node): node is Heading {
  return node.type === 'heading';
}
```

**Step 2: Verify it compiles**

Run: `cd packages/shared && npx tsc --noEmit 2>&1 | head -20`
Expected: Same 6 errors (type guard not used yet)

**Step 3: Commit**

```bash
git add packages/shared/src/workflow/parser/parser.ts
git commit -m "refactor(parser): add isHeading type guard for mdast nodes"
```

---

## Task 2: Fix H1 Heading Type Check (Line 102)

**Files:**
- Modify: `packages/shared/src/workflow/parser/parser.ts:102`

**Step 1: Update H1 heading check to use type guard**

Replace:
```typescript
    if (node.type === 'heading' && node.depth === 1) {
      const headingText = extractText(node);
```

With:
```typescript
    if (isHeading(node) && node.depth === 1) {
      const headingText = extractText(node);
```

**Step 2: Verify errors reduced**

Run: `cd packages/shared && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 4 errors (reduced from 6)

**Step 3: Commit**

```bash
git add packages/shared/src/workflow/parser/parser.ts
git commit -m "fix(parser): use type guard for H1 heading check"
```

---

## Task 3: Fix H2 Heading Type Check (Line 113)

**Files:**
- Modify: `packages/shared/src/workflow/parser/parser.ts:113`

**Step 1: Update H2 heading check to use type guard**

Replace:
```typescript
    if (node.type === 'heading' && node.depth === 2) {
```

With:
```typescript
    if (isHeading(node) && node.depth === 2) {
```

**Step 2: Verify errors reduced**

Run: `cd packages/shared && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 2 errors (reduced from 4)

**Step 3: Commit**

```bash
git add packages/shared/src/workflow/parser/parser.ts
git commit -m "fix(parser): use type guard for H2 heading check"
```

---

## Task 4: Fix H3 Heading Type Check (Line 135)

**Files:**
- Modify: `packages/shared/src/workflow/parser/parser.ts:135`

**Step 1: Update H3 heading check to use type guard**

Replace:
```typescript
    if (node.type === 'heading' && node.depth === 3 && currentTask) {
```

With:
```typescript
    if (isHeading(node) && node.depth === 3 && currentTask) {
```

**Step 2: Verify parser errors fixed**

Run: `cd packages/shared && npx tsc --noEmit 2>&1 | grep parser`
Expected: No parser.ts errors

**Step 3: Commit**

```bash
git add packages/shared/src/workflow/parser/parser.ts
git commit -m "fix(parser): use type guard for H3 heading check"
```

---

## Task 5: Add TaskNumber Schema with Zod Transform

**Files:**
- Modify: `packages/shared/src/workflow/types.ts:13` (export constant)
- Modify: `packages/shared/src/schemas.ts:1-10` (imports)
- Modify: `packages/shared/src/schemas.ts:107` (task field)

**Step 1: Export MAX_TASK_NUMBER from types.ts**

In `packages/shared/src/workflow/types.ts`, change line 13 from:

```typescript
const MAX_TASK_NUMBER = 999999;
```

To:

```typescript
export const MAX_TASK_NUMBER = 999999;
```

**Step 2: Add imports at top of schemas.ts**

After line 1 (`import { z } from 'zod';`), add:

```typescript
import { MAX_TASK_NUMBER, type TaskNumber } from './workflow/types.js';
```

**Step 3: Add TaskNumberSchema before WorkflowStateSchema**

Before the `WorkflowStateSchema` definition (around line 98), add:

```typescript
/**
 * Zod schema for TaskNumber branded type
 * Validates and transforms plain number to branded TaskNumber
 */
const TaskNumberSchema = z
  .number()
  .int('Task number must be an integer')
  .positive('Task number must be positive')
  .max(MAX_TASK_NUMBER, 'Task number exceeds maximum')
  .transform((n): TaskNumber => n as TaskNumber);
```

**Step 4: Update WorkflowStateSchema task field**

Replace:
```typescript
  task: z.number().positive().int(),
```

With:
```typescript
  task: TaskNumberSchema,
```

**Step 5: Verify schema compiles**

Run: `cd packages/shared && npx tsc --noEmit 2>&1 | grep schemas`
Expected: No schemas.ts errors

**Step 6: Commit**

```bash
git add packages/shared/src/workflow/types.ts packages/shared/src/schemas.ts
git commit -m "fix(schemas): add TaskNumberSchema with transform for branded type

- Export MAX_TASK_NUMBER from types.ts (avoid duplication)
- Import and use in schemas.ts for TaskNumberSchema"
```

---

## Task 6: Remove Unsafe Cast from state.ts

**Files:**
- Modify: `packages/shared/src/workflow/state.ts:109`

**Step 1: Remove the 'as WorkflowState' cast**

Replace:
```typescript
      return result.data as WorkflowState;
```

With:
```typescript
      return result.data;
```

**Step 2: Verify all build errors fixed**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: No errors (exit code 0)

**Step 3: Commit**

```bash
git add packages/shared/src/workflow/state.ts
git commit -m "fix(state): remove unsafe cast now that Zod infers TaskNumber"
```

---

## Task 7: Run Full Build

**Files:** None (verification only)

**Step 1: Run full package build**

Run: `cd packages/shared && npm run build`
Expected: Build succeeds with no errors

**Step 2: Commit build artifacts if any**

No commit needed if build output is gitignored.

---

## Task 8: Run Tests and Report Status

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `cd packages/shared && npm test 2>&1 | tail -30`
Expected: Note any remaining failures (these are pre-existing workflow system issues)

**Step 2: Document results**

If tests pass: Done!
If tests fail: Note the failures - these are separate from the build fix work.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add isHeading type guard | parser.ts |
| 2 | Fix H1 check | parser.ts |
| 3 | Fix H2 check | parser.ts |
| 4 | Fix H3 check | parser.ts |
| 5 | Add TaskNumberSchema | schemas.ts |
| 6 | Remove unsafe cast | state.ts |
| 7 | Full build | (verify) |
| 8 | Run tests | (verify) |
