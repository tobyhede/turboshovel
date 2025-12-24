# CLI Type Safety Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve type safety across CLI code to prevent invalid states at compile time using branded types, zod validation, and idiomatic TypeScript patterns.

**Architecture:** Centralize type definitions in types.ts and task-id.ts. Add zod schemas for external input validation. Use branded types consistently for TaskNumber and TaskId. Add type guards and helper functions to eliminate type assertions.

**Tech Stack:** TypeScript, Zod, Jest

---

## Task 1: Add TaskNumber Arithmetic Helpers

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/types.ts`
- Modify: `plugin/hooks/hooks-app/__tests__/workflow/types.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/workflow/types.test.ts`. First update the import statement:

```typescript
// Update import at top of file:
import {
  createTaskNumber,
  incrementTaskNumber,
  decrementTaskNumber,
  type TaskNumber,
  type Action,
  type Subtask,
  type Task,
  type WorkflowState,
  type Conditions
} from '../../src/workflow/types';
```

Then add the test cases:

```typescript
describe('incrementTaskNumber', () => {
  it('increments valid TaskNumber', () => {
    const tn = createTaskNumber(3)!;
    const result = incrementTaskNumber(tn);
    expect(result).toBe(4);
    // Verify brand preserved by using where TaskNumber expected
    const next: TaskNumber = result!;
    expect(next).toBe(4);
  });

  it('returns null when increment would overflow reasonable bounds', () => {
    const tn = createTaskNumber(999999)!;
    const result = incrementTaskNumber(tn);
    expect(result).toBeNull();
  });
});

describe('decrementTaskNumber', () => {
  it('decrements valid TaskNumber', () => {
    const tn = createTaskNumber(3)!;
    const result = decrementTaskNumber(tn);
    expect(result).toBe(2);
  });

  it('returns null when decrement would go below 1', () => {
    const tn = createTaskNumber(1)!;
    const result = decrementTaskNumber(tn);
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" -t "incrementTaskNumber|decrementTaskNumber"`
Expected: FAIL with "incrementTaskNumber is not defined"

**Step 3: Write minimal implementation**

First, update `createTaskNumber` in `src/workflow/types.ts` to add MAX_TASK_NUMBER validation:

```typescript
/**
 * Maximum valid task number (prevent overflow, keep IDs reasonable)
 */
const MAX_TASK_NUMBER = 999999;

/**
 * Factory function to create a valid TaskNumber
 * Returns null if the number is invalid (zero, negative, non-integer, or too large)
 */
export function createTaskNumber(n: number): TaskNumber | null {
  if (n <= 0 || !Number.isInteger(n) || n > MAX_TASK_NUMBER) {
    return null;
  }
  return n as TaskNumber;
}
```

Then add the arithmetic helpers that delegate to the factory:

```typescript
/**
 * Increment a TaskNumber, preserving the brand
 * Returns null if result would exceed maximum
 */
export function incrementTaskNumber(tn: TaskNumber): TaskNumber | null {
  return createTaskNumber(tn + 1);
}

/**
 * Decrement a TaskNumber, preserving the brand
 * Returns null if result would be less than 1
 */
export function decrementTaskNumber(tn: TaskNumber): TaskNumber | null {
  return createTaskNumber(tn - 1);
}
```

**Note:** By using `createTaskNumber` internally, we:
- Centralize all validation logic in one place (DRY)
- Avoid type assertions that could bypass validation
- Ensure MAX_TASK_NUMBER is checked consistently

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" -t "incrementTaskNumber|decrementTaskNumber"`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/types.ts plugin/hooks/hooks-app/__tests__/workflow/types.test.ts
git commit -m "feat(types): add TaskNumber arithmetic helpers with brand preservation"
```

---

## Task 2: Unify TaskId Parsing Functions

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/task-id.ts`
- Modify: `plugin/hooks/hooks-app/__tests__/workflow/task-id.test.ts`
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts`

**Step 1: Write the failing test**

Add to `__tests__/workflow/task-id.test.ts`:

```typescript
describe('parseTaskIdFromString', () => {
  describe('without separator requirement', () => {
    it('parses simple task number', () => {
      const result = parseTaskIdFromString('3');
      expect(result).toEqual({ task: 3 });
    });

    it('parses task with subtask', () => {
      const result = parseTaskIdFromString('3.A');
      expect(result).toEqual({ task: 3, subtask: 'A' });
    });

    it('normalizes lowercase subtask', () => {
      const result = parseTaskIdFromString('2.b');
      expect(result).toEqual({ task: 2, subtask: 'B' });
    });

    it('returns null for invalid format', () => {
      expect(parseTaskIdFromString('abc')).toBeNull();
      expect(parseTaskIdFromString('')).toBeNull();
      expect(parseTaskIdFromString('0')).toBeNull();
      expect(parseTaskIdFromString('-1')).toBeNull();
    });
  });

  describe('with separator requirement', () => {
    it('parses when separator present', () => {
      const result = parseTaskIdFromString('3 - Review', { requireSeparator: true });
      expect(result).toEqual({ task: 3 });
    });

    it('returns null when separator missing', () => {
      const result = parseTaskIdFromString('3', { requireSeparator: true });
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="task-id" -t "parseTaskIdFromString"`
Expected: FAIL with "parseTaskIdFromString is not defined"

**Step 3: Write minimal implementation**

Replace `parseTaskId` in `src/workflow/task-id.ts` with unified function:

```typescript
export interface ParseTaskIdOptions {
  /** Require a separator after the task ID (space, dash, colon) */
  readonly requireSeparator?: boolean;
}

/**
 * Parse TaskId from string with configurable behavior
 *
 * Without requireSeparator:
 *   "3" -> { task: 3 }
 *   "3.A" -> { task: 3, subtask: 'A' }
 *
 * With requireSeparator:
 *   "3 - Review" -> { task: 3 }
 *   "3.A: Task" -> { task: 3, subtask: 'A' }
 *   "3" -> null (no separator)
 */
export function parseTaskIdFromString(
  input: string,
  options?: ParseTaskIdOptions
): TaskId | null {
  if (!input) return null;

  const requireSeparator = options?.requireSeparator ?? false;

  // Build regex based on options
  const pattern = requireSeparator
    ? /^(\d+)(?:\.([A-Za-z]))?[\s\-:]/  // Must have separator
    : /^(\d+)(?:\.([A-Za-z]))?$/;        // Must match entire string

  const match = input.match(pattern);
  if (!match) return null;

  const task = parseInt(match[1], 10);
  if (task <= 0) return null;

  return {
    task,
    subtask: match[2]?.toUpperCase(),
  };
}

/**
 * Parse TaskId from Task tool description (requires separator)
 * @deprecated Use parseTaskIdFromString with { requireSeparator: true }
 */
export function parseTaskId(description: string): TaskId | null {
  return parseTaskIdFromString(description, { requireSeparator: true });
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="task-id"`
Expected: PASS (all existing tests + new tests)

**Step 5: Update workflow-cli.ts to use unified function**

Replace `parseTaskIdFromArg` in `src/cli/workflow-cli.ts`:

```typescript
// At top of file, update import:
import { taskIdToString, parseTaskIdFromString, type TaskId } from '../workflow/task-id';
```

Then:
1. **Delete the `parseTaskIdFromArg` function** (search for `function parseTaskIdFromArg` - it's near the end of the file)
2. **Replace all usages** of `parseTaskIdFromArg` with `parseTaskIdFromString` (there's one call in the `start` command action)

**Step 6: Run all tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/task-id.ts plugin/hooks/hooks-app/__tests__/workflow/task-id.test.ts plugin/hooks/hooks-app/src/cli/workflow-cli.ts
git commit -m "refactor(task-id): unify parsing with parseTaskIdFromString"
```

---

## Task 3: Add HookInput Zod Schema

**Files:**
- Create: `plugin/hooks/hooks-app/src/schemas.ts`
- Create: `plugin/hooks/hooks-app/__tests__/schemas.test.ts`
- Modify: `plugin/hooks/hooks-app/src/cli.ts`
- Modify: `plugin/hooks/hooks-app/package.json` (add zod dependency)

**Step 1: Add zod dependency**

Run: `cd plugin/hooks/hooks-app && npm install zod`

**Step 2: Write the failing test**

Create `__tests__/schemas.test.ts`:

```typescript
import { HookInputSchema, parseHookInput } from '../src/schemas';

describe('HookInputSchema', () => {
  it('parses valid minimal input', () => {
    const input = {
      hook_event_name: 'PostToolUse',
      cwd: '/Users/test/project',
    };
    const result = HookInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('parses input with optional fields', () => {
    const input = {
      hook_event_name: 'PostToolUse',
      cwd: '/Users/test/project',
      tool_name: 'Edit',
      file_path: '/Users/test/project/src/index.ts',
    };
    const result = HookInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tool_name).toBe('Edit');
    }
  });

  it('rejects input missing required fields', () => {
    const input = { hook_event_name: 'PostToolUse' };
    const result = HookInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects null', () => {
    const result = HookInputSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});

describe('parseHookInput', () => {
  it('returns parsed input on success', () => {
    const json = '{"hook_event_name":"PostToolUse","cwd":"/test"}';
    const result = parseHookInput(json);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hook_event_name).toBe('PostToolUse');
    }
  });

  it('returns error for invalid JSON', () => {
    const result = parseHookInput('not json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('returns error for invalid schema', () => {
    const result = parseHookInput('{"foo":"bar"}');
    expect(result.success).toBe(false);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="schemas"`
Expected: FAIL with "Cannot find module '../src/schemas'"

**Step 4: Write minimal implementation**

Create `src/schemas.ts`:

```typescript
import { z } from 'zod';

/**
 * Zod schema for tool_input in Task tool calls
 */
const ToolInputSchema = z.object({
  description: z.string().optional(),
  subagent_type: z.string().optional(),
  prompt: z.string().optional(),
}).optional();

/**
 * Zod schema for HookInput - validates external input at system boundary
 */
export const HookInputSchema = z.object({
  hook_event_name: z.string(),
  cwd: z.string(),

  // PostToolUse
  tool_name: z.string().optional(),
  file_path: z.string().optional(),
  tool_input: ToolInputSchema,

  // SubagentStart/SubagentStop
  agent_id: z.string().optional(),
  agent_name: z.string().optional(),
  subagent_name: z.string().optional(),
  output: z.string().optional(),
  agent_transcript_path: z.string().optional(),

  // UserPromptSubmit
  user_message: z.string().optional(),

  // SlashCommand/Skill
  command: z.string().optional(),
  skill: z.string().optional(),
});

export type HookInput = z.infer<typeof HookInputSchema>;

/**
 * Result type for parseHookInput
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Parse and validate HookInput from JSON string
 */
export function parseHookInput(json: string): ParseResult<HookInput> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return {
      success: false,
      error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const result = HookInputSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: `Invalid input: ${result.error.issues.map(i => i.message).join(', ')}`,
    };
  }

  return { success: true, data: result.data };
}
```

**Step 5: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="schemas"`
Expected: PASS

**Step 6: Commit schemas module**

```bash
git add plugin/hooks/hooks-app/src/schemas.ts plugin/hooks/hooks-app/__tests__/schemas.test.ts plugin/hooks/hooks-app/package.json plugin/hooks/hooks-app/package-lock.json
git commit -m "feat(schemas): add zod schema for HookInput validation"
```

---

## Task 4: Integrate HookInput Schema into CLI

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli.ts`
- Modify: `plugin/hooks/hooks-app/src/types.ts`

**Step 1: Update cli.ts to use schema validation**

In `src/cli.ts`, replace the JSON.parse block in `handleHookDispatch`:

```typescript
// At top, add import:
import { parseHookInput, type HookInput } from './schemas';

// In handleHookDispatch, replace lines ~188-212 with:
    // Parse and validate input
    const parseResult = parseHookInput(inputStr);
    if (!parseResult.success) {
      await logger.error('CLI input validation failed', {
        input_length: inputStr.length,
        input_preview: inputStr.substring(0, 200),
        error: parseResult.error,
      });
      console.error(
        JSON.stringify({
          continue: false,
          message: parseResult.error,
        })
      );
      process.exit(1);
    }

    const input = parseResult.data;
```

**Step 2: Update types.ts to use schema as source of truth**

In `src/types.ts`:

1. Delete the `HookInput` interface definition (lines ~3-28)
2. Add import and re-export at top of file:

```typescript
// Import HookInput from schemas (single source of truth for validation)
import type { HookInput as SchemaHookInput } from './schemas';

// Re-export for consumers
export type HookInput = SchemaHookInput;
```

This approach:
- Imports the type with an alias to avoid name collision during transition
- Creates a local `HookInput` type that other types in this file can reference (GateExecute, etc.)
- Re-exports for consumers of types.ts

**Step 3: Run all tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/src/cli.ts plugin/hooks/hooks-app/src/types.ts
git commit -m "refactor(cli): use zod schema for HookInput validation"
```

---

## Task 5: Add Error Type Guards

**Files:**
- Create: `plugin/hooks/hooks-app/src/errors.ts`
- Create: `plugin/hooks/hooks-app/__tests__/errors.test.ts`
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts`

**Step 1: Write the failing test**

Create `__tests__/errors.test.ts`:

```typescript
import { isNodeError, isError, getErrorMessage } from '../src/errors';

describe('isNodeError', () => {
  it('returns true for NodeJS.ErrnoException', () => {
    const err = new Error('test') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    expect(isNodeError(err)).toBe(true);
  });

  it('returns false for regular Error', () => {
    expect(isNodeError(new Error('test'))).toBe(false);
  });

  it('returns false for non-Error', () => {
    expect(isNodeError('string')).toBe(false);
    expect(isNodeError(null)).toBe(false);
    expect(isNodeError(undefined)).toBe(false);
  });
});

describe('isError', () => {
  it('returns true for Error instance', () => {
    expect(isError(new Error('test'))).toBe(true);
  });

  it('returns false for non-Error', () => {
    expect(isError('string')).toBe(false);
    expect(isError({ message: 'fake' })).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('extracts message from Error', () => {
    expect(getErrorMessage(new Error('test message'))).toBe('test message');
  });

  it('converts non-Error to string', () => {
    expect(getErrorMessage('string error')).toBe('string error');
    expect(getErrorMessage(123)).toBe('123');
    expect(getErrorMessage(null)).toBe('null');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="errors"`
Expected: FAIL with "Cannot find module '../src/errors'"

**Step 3: Write minimal implementation**

Create `src/errors.ts`:

```typescript
/**
 * Type guard for NodeJS.ErrnoException
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Type guard for Error instances
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="errors"`
Expected: PASS

**Step 5: Update workflow-cli.ts to use type guards**

In `src/cli/workflow-cli.ts`, replace error handling blocks:

```typescript
// Add import at top:
import { isNodeError, getErrorMessage } from '../errors';

// Replace catch blocks like:
// } catch (error) {
//   if ((error as NodeJS.ErrnoException).code === 'ENOENT') { ...

// With:
} catch (error) {
  if (isNodeError(error) && error.code === 'ENOENT') {
    console.error(`Error: Workflow file not found: ${file}`);
  } else if (error instanceof WorkflowSyntaxError) {
    console.error(`Syntax error: ${error.message}`);
  } else {
    console.error(`Error: ${getErrorMessage(error)}`);
  }
  process.exit(1);
}
```

**Step 6: Run all tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add plugin/hooks/hooks-app/src/errors.ts plugin/hooks/hooks-app/__tests__/errors.test.ts plugin/hooks/hooks-app/src/cli/workflow-cli.ts
git commit -m "feat(errors): add type guards for safe error handling"
```

---

## Task 6: Derive Session State Keys from Type

**Files:**
- Modify: `plugin/hooks/hooks-app/src/types.ts`
- Modify: `plugin/hooks/hooks-app/src/cli.ts`

**Step 1: Update types.ts with derived key constant**

In `src/types.ts`, add after `SessionState` interface:

```typescript
/**
 * All keys of SessionState as a const array
 * Using satisfies ensures compile-time validation against interface
 */
export const SESSION_STATE_KEYS = [
  'session_id',
  'started_at',
  'active_command',
  'active_skill',
  'edited_files',
  'file_extensions',
  'metadata',
  'stashedWorkflowId',
] as const satisfies readonly (keyof SessionState)[];
```

**Step 2: Update cli.ts to use derived keys**

In `src/cli.ts`, replace `isSessionStateKey` function:

```typescript
// Add import:
import { SESSION_STATE_KEYS } from './types';

// Replace isSessionStateKey:
function isSessionStateKey(key: string): key is keyof SessionState {
  return (SESSION_STATE_KEYS as readonly string[]).includes(key);
}
```

**Step 3: Run all tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/src/types.ts plugin/hooks/hooks-app/src/cli.ts
git commit -m "refactor(types): derive SESSION_STATE_KEYS from interface with satisfies"
```

---

## Task 7: Use TaskNumber in TaskId

**DESIGN DECISION:** Keep TaskNumber in types.ts (no move). task-id.ts imports from types.ts.

This avoids circular imports and code duplication. types.ts remains the single source of truth for TaskNumber, while task-id.ts imports what it needs.

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/task-id.ts`

**Step 1: Add import from types.ts**

At the TOP of `src/workflow/task-id.ts`, add:

```typescript
import { createTaskNumber, type TaskNumber } from './types';
```

**Note on circular imports:** This is safe because:
- types.ts has `export type { TaskId } from './task-id'` (TYPE-only export, no runtime dependency)
- task-id.ts has `import { createTaskNumber }` (VALUE import from types.ts)
- Result: task-id.ts depends on types.ts at runtime, types.ts only depends on task-id.ts at compile time

**Step 2: Update TaskId interface to use TaskNumber**

In `src/workflow/task-id.ts`, update the TaskId interface:

```typescript
/**
 * Task identifier with optional subtask
 * Format: "3" or "3.A" (task with optional subtask letter)
 */
export interface TaskId {
  readonly task: TaskNumber;  // Changed from number to TaskNumber
  readonly subtask?: string;
}
```

**Step 3: Update parseTaskIdFromString to use createTaskNumber**

In `src/workflow/task-id.ts`, update the function to validate via createTaskNumber:

```typescript
export function parseTaskIdFromString(
  input: string,
  options?: ParseTaskIdOptions
): TaskId | null {
  if (!input) return null;

  const requireSeparator = options?.requireSeparator ?? false;
  const pattern = requireSeparator
    ? /^(\d+)(?:\.([A-Za-z]))?[\s\-:]/
    : /^(\d+)(?:\.([A-Za-z]))?$/;

  const match = input.match(pattern);
  if (!match) return null;

  const taskNum = parseInt(match[1], 10);
  const task = createTaskNumber(taskNum);
  if (!task) return null;  // Invalid task number (0, negative, or too large)

  return {
    task,
    subtask: match[2]?.toUpperCase(),
  };
}
```

**Step 4: Verify tests still pass**

In `__tests__/workflow/task-id.test.ts`, tests should still work since TaskNumber is structurally a number. Existing assertions like `expect(result).toEqual({ task: 3 })` will pass because TaskNumber compares as a number at runtime.

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/task-id.ts
git commit -m "refactor(task-id): use TaskNumber branded type in TaskId interface"
```

---

## Task 8: Update workflow-cli.ts to Use incrementTaskNumber

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts`

**Step 1: Update imports**

```typescript
import {
  createTaskNumber,
  incrementTaskNumber,
  type TaskNumber,
  type Action,
  type Task
} from '../workflow/types';
```

**Step 2: Replace arithmetic with helper**

In the `next` command action, replace:

```typescript
// Old:
let nextTaskNum: number;
if (options.step) {
  nextTaskNum = parseInt(options.step, 10);
} else {
  nextTaskNum = state.task + 1;
}

// New:
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
  console.log(`Workflow complete: ${state.workflow}`);
  await manager.setActive(null);
  return;
}

const nextTask = tasks[nextTaskNumber - 1];

// Update state (taskNumber already validated)
await manager.update(state.id, {
  task: nextTaskNumber,
  taskName: nextTask.description,
  retryCount: 0,
});
```

**Step 3: Run tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/src/cli/workflow-cli.ts
git commit -m "refactor(cli): use incrementTaskNumber to preserve TaskNumber brand"
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
Expected: No errors (or only pre-existing issues)

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup after type safety refactor"
```
