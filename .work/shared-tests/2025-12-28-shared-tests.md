# Shared Package Test Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up Jest test infrastructure for @turboshovel/shared package and add tests for schema validation.

**Architecture:** Mirror plugin/core test setup (Jest + ts-jest with ESM support). Start with schema tests since they're pure functions with clear inputs/outputs and were just modified.

**Tech Stack:** Jest 29, ts-jest, TypeScript, Zod

---

## Task 1: Install Test Dependencies

**Files:**
- Modify: `packages/shared/package.json`

**Step 1: Install Jest and ts-jest**

Run:
```bash
cd packages/shared && npm install -D jest ts-jest @types/jest
```

**Step 2: Verify installation**

Run: `cd packages/shared && cat package.json | grep jest`
Expected: See jest, ts-jest, @types/jest in devDependencies

**Step 3: Commit**

```bash
git add packages/shared/package.json packages/shared/package-lock.json
git commit -m "chore(shared): add jest test dependencies"
```

---

## Task 2: Create Jest Configuration

**Files:**
- Create: `packages/shared/jest.config.cjs`

**Step 1: Create jest.config.cjs**

Create file `packages/shared/jest.config.cjs`:

```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2020',
          lib: ['ES2020'],
          strict: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          isolatedModules: true,
        },
      },
    ],
  },
};
```

**Step 2: Verify file created**

Run: `ls packages/shared/jest.config.cjs`
Expected: File exists

**Step 3: Commit**

```bash
git add packages/shared/jest.config.cjs
git commit -m "chore(shared): add jest configuration for ESM"
```

---

## Task 3: Update package.json Test Script

**Files:**
- Modify: `packages/shared/package.json`

**Step 1: Update test script**

In `packages/shared/package.json`, replace line 13:

From:
```json
    "test": "echo 'No tests yet' && exit 0",
```

To:
```json
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest",
```

**Step 2: Verify the change**

Run: `cd packages/shared && cat package.json | grep '"test"'`
Expected: `"test": "NODE_OPTIONS='--experimental-vm-modules' jest",`

**Step 3: Commit**

```bash
git add packages/shared/package.json
git commit -m "chore(shared): update test script to run jest"
```

---

## Task 4: Create Test Directory and First Test File

**Files:**
- Create: `packages/shared/__tests__/schemas.test.ts`

**Step 1: Create __tests__ directory**

Run: `mkdir -p packages/shared/__tests__`

**Step 2: Create schemas.test.ts with describe block**

Create file `packages/shared/__tests__/schemas.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';

describe('schemas', () => {
  it('placeholder test', () => {
    expect(true).toBe(true);
  });
});
```

**Step 3: Run tests to verify setup works**

Run: `cd packages/shared && npm test`
Expected: 1 passing test

**Step 4: Commit**

```bash
git add packages/shared/__tests__/schemas.test.ts
git commit -m "test(shared): add test infrastructure with placeholder"
```

---

## Task 5: Add parseHookInput Tests

**Files:**
- Modify: `packages/shared/__tests__/schemas.test.ts`

**Step 1: Import parseHookInput**

Add after line 1 imports:

```typescript
import { parseHookInput } from '../src/schemas.js';
```

**Step 2: Replace placeholder test with parseHookInput tests**

Replace the entire `describe('schemas', ...)` block with:

```typescript
describe('parseHookInput', () => {
  it('parses valid PostToolUse input', () => {
    const input = JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd: '/project',
      tool_name: 'Edit',
      file_path: '/project/src/file.ts'
    });

    const result = parseHookInput(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hook_event_name).toBe('PostToolUse');
      expect(result.data.tool_name).toBe('Edit');
    }
  });

  it('parses valid UserPromptSubmit input', () => {
    const input = JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      cwd: '/project',
      user_message: 'fix the bug'
    });

    const result = parseHookInput(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user_message).toBe('fix the bug');
    }
  });

  it('returns error for invalid JSON', () => {
    const result = parseHookInput('not valid json');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('returns error for missing required fields', () => {
    const input = JSON.stringify({
      tool_name: 'Edit'
      // missing hook_event_name and cwd
    });

    const result = parseHookInput(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid input');
    }
  });
});
```

**Step 3: Run tests**

Run: `cd packages/shared && npm test`
Expected: 4 passing tests

**Step 4: Commit**

```bash
git add packages/shared/__tests__/schemas.test.ts
git commit -m "test(shared): add parseHookInput validation tests"
```

---

## Task 6: Add TaskNumberSchema Tests

**Files:**
- Modify: `packages/shared/__tests__/schemas.test.ts`

**Step 1: Add WorkflowStateSchema import**

Update imports at top of file:

```typescript
import { describe, it, expect } from '@jest/globals';
import { parseHookInput, WorkflowStateSchema } from '../src/schemas.js';
```

**Step 2: Add TaskNumberSchema tests**

Add after the `parseHookInput` describe block:

```typescript
describe('WorkflowStateSchema - TaskNumber validation', () => {
  const validState = {
    id: 'test-id',
    workflow: 'test.md',
    task: 1,
    taskName: 'Test Task',
    retryCount: 0,
    retryMax: 3,
    variables: {},
    tasks: [],
    pendingTasks: [],
    agentBindings: {},
    startedAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  };

  it('accepts valid positive integer task number', () => {
    const result = WorkflowStateSchema.safeParse(validState);
    expect(result.success).toBe(true);
  });

  it('rejects zero task number', () => {
    const result = WorkflowStateSchema.safeParse({
      ...validState,
      task: 0
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative task number', () => {
    const result = WorkflowStateSchema.safeParse({
      ...validState,
      task: -1
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer task number', () => {
    const result = WorkflowStateSchema.safeParse({
      ...validState,
      task: 1.5
    });
    expect(result.success).toBe(false);
  });

  it('rejects task number exceeding maximum', () => {
    const result = WorkflowStateSchema.safeParse({
      ...validState,
      task: 1000000 // MAX_TASK_NUMBER is 999999
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 3: Run tests**

Run: `cd packages/shared && npm test`
Expected: 9 passing tests

**Step 4: Commit**

```bash
git add packages/shared/__tests__/schemas.test.ts
git commit -m "test(shared): add TaskNumber validation tests"
```

---

## Task 7: Add TaskIdSchema Tests

**Files:**
- Modify: `packages/shared/__tests__/schemas.test.ts`

**Step 1: Add TaskIdSchema tests**

Add after the TaskNumber describe block:

```typescript
describe('WorkflowStateSchema - TaskId validation', () => {
  const createStateWithPendingTasks = (pendingTasks: unknown[]) => ({
    id: 'test-id',
    workflow: 'test.md',
    task: 1,
    taskName: 'Test Task',
    retryCount: 0,
    retryMax: 3,
    variables: {},
    tasks: [],
    pendingTasks,
    agentBindings: {},
    startedAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  });

  it('accepts valid TaskId object', () => {
    const result = WorkflowStateSchema.safeParse(
      createStateWithPendingTasks([{ task: 1 }])
    );
    expect(result.success).toBe(true);
  });

  it('accepts TaskId with subtask', () => {
    const result = WorkflowStateSchema.safeParse(
      createStateWithPendingTasks([{ task: 1, subtask: 'a' }])
    );
    expect(result.success).toBe(true);
  });

  it('rejects TaskId as plain string', () => {
    const result = WorkflowStateSchema.safeParse(
      createStateWithPendingTasks(['1'])
    );
    expect(result.success).toBe(false);
  });

  it('rejects TaskId without task field', () => {
    const result = WorkflowStateSchema.safeParse(
      createStateWithPendingTasks([{ subtask: 'a' }])
    );
    expect(result.success).toBe(false);
  });

  it('rejects TaskId with invalid task number', () => {
    const result = WorkflowStateSchema.safeParse(
      createStateWithPendingTasks([{ task: 0 }])
    );
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run tests**

Run: `cd packages/shared && npm test`
Expected: 14 passing tests

**Step 3: Commit**

```bash
git add packages/shared/__tests__/schemas.test.ts
git commit -m "test(shared): add TaskId validation tests"
```

---

## Task 8: Run Full Test Suite and Verify

**Files:** None (verification only)

**Step 1: Run all tests with coverage**

Run: `cd packages/shared && npm test -- --coverage`
Expected: All 14 tests pass

**Step 2: Run from project root**

Run: `npm test`
Expected: Shared package tests run

**Step 3: Verify build still works**

Run: `npm run build`
Expected: Build succeeds

---

## Summary

| Task | Description | Tests Added |
|------|-------------|-------------|
| 1 | Install dependencies | - |
| 2 | Create jest.config.cjs | - |
| 3 | Update test script | - |
| 4 | Create test file | 1 (placeholder) |
| 5 | parseHookInput tests | 4 |
| 6 | TaskNumber tests | 5 |
| 7 | TaskId tests | 5 |
| 8 | Verify full suite | - |

**Total: 14 tests covering core schema validation**
