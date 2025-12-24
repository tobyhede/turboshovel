# Plan Review - Agent A
## Date: 2025-12-24 11:45:32
## Plan: CLI Type Safety Refactor

## Status: BLOCKED

## BLOCKING Issues (Must Fix)

### 1. **Circular Import Dependency in Task 7** (CRITICAL)
**Location:** Task 7, Step 3
**Issue:** The plan creates a circular import between `types.ts` and `task-id.ts`:
- Task 7 moves `TaskNumber`, `createTaskNumber`, `incrementTaskNumber`, `decrementTaskNumber` from `types.ts` to `task-id.ts`
- But `task-id.ts` already imports from `types.ts` (line 3 in current code: `import type { TaskId } from './task-id';`)
- Then `types.ts` would re-export from `task-id.ts` (Step 3 shows: `export type { TaskNumber, TaskId } from './task-id';`)

**Current state analysis:**
- `types.ts` line 3: `import type { TaskId } from './task-id';`
- `types.ts` line 24: `export type { TaskId } from './task-id';`
- `task-id.ts` line 6: `readonly task: number;` (not yet using TaskNumber)

**Why this is problematic:**
If `types.ts` imports from `task-id.ts` AND `task-id.ts` imports from `types.ts`, TypeScript may refuse to compile or introduce runtime initialization issues. The plan doesn't address this.

**Required fix:**
The plan must specify the correct import direction. Recommendation:
- Option A: Keep TaskNumber in `types.ts`, import it in `task-id.ts`
- Option B: Move TaskNumber to `task-id.ts`, remove types.ts → task-id.ts imports
- Current plan attempts hybrid (move + re-export) without removing the reverse import

### 2. **Task 1 Implementation Uses Type Assertion** (Type Safety Hole)
**Location:** Task 1, Step 3, lines 80 and 92
**Issue:** The increment/decrement helpers use `as TaskNumber` to cast back to branded type:
```typescript
return next as TaskNumber;  // Line 80
return prev as TaskNumber;  // Line 92
```

**Type safety concern:**
Branded types should prevent unsafe arithmetic, but these helpers allow arbitrary addition/subtraction then re-brand the result. This defeats the purpose of the brand.

**Missing validation:**
The plan adds bounds checking (MAX_TASK_NUMBER, minimum 1) but still uses unsafe casts. The brand should only be created through `createTaskNumber`.

**Better approach:**
```typescript
export function incrementTaskNumber(tn: TaskNumber): TaskNumber | null {
  return createTaskNumber(tn + 1);  // Reuse factory validation
}
```

This eliminates the type assertion and centralizes validation.

### 3. **Task 7 Duplicates TaskNumber Logic** (Code Duplication)
**Location:** Task 7, Step 3
**Issue:** Task 7 re-implements `createTaskNumber` in `task-id.ts`:
```typescript
export function createTaskNumber(n: number): TaskNumber | null {
  if (n <= 0 || !Number.isInteger(n) || n > MAX_TASK_NUMBER) {
    return null;
  }
  return n as TaskNumber;
}
```

**Problems:**
1. Task 1 already implemented `createTaskNumber` in `types.ts` with validation: `n <= 0 || !Number.isInteger(n)`
2. Task 1 implementation doesn't check `MAX_TASK_NUMBER` (inconsistency)
3. Task 7 adds `MAX_TASK_NUMBER` check but creates duplicate implementations
4. Task 7 Step 3 moves the arithmetic helpers but doesn't show them using `createTaskNumber` internally

**Impact on atomicity:**
If Task 1 is completed but Task 7 fails mid-execution, the codebase has inconsistent validation rules in two places.

### 4. **Missing Test Update in Task 7** (Incomplete TDD)
**Location:** Task 7, Step 4
**Issue:** Task 7 changes `TaskId.task` from `number` to `TaskNumber` but only shows minimal test updates:
```typescript
it('parses simple task number', () => {
  const result = parseTaskIdFromString('3');
  expect(result).not.toBeNull();
  expect(result!.task).toBe(3);  // Comment says "TaskNumber compares as number"
});
```

**Missing test coverage:**
1. No test verifying `result.task` has the TaskNumber brand (type-level test)
2. No test showing arithmetic operations fail without helpers (compile-time safety verification)
3. No test verifying integration with `incrementTaskNumber`/`decrementTaskNumber`

**Why this matters:**
The plan's stated goal is "prevent invalid states at compile time using branded types" but doesn't verify this property through tests.

### 5. **Task 2 Has Incorrect Line Number Reference** (Execution Risk)
**Location:** Task 2, Step 5
**Issue:** The plan says "Delete the local parseTaskIdFromArg function (lines ~394-408)" but current analysis shows:
- `parseTaskIdFromArg` is at line 466-478 (15 lines, not at line 394)
- Only one usage at line 41

**Risk:**
An agent following this plan might delete the wrong code block or spend time searching for non-existent code at line 394.

**Required fix:**
Update with accurate line numbers or use symbolic references ("the parseTaskIdFromArg function") instead of brittle line numbers.

### 6. **Task 4 Doesn't Verify Schema Compatibility** (Breaking Change Risk)
**Location:** Task 4, Step 1
**Issue:** Task 4 replaces manual JSON.parse with Zod schema validation but doesn't verify backward compatibility:

**Current types.ts HookInput (lines 3-31):**
```typescript
export interface HookInput {
  hook_event_name: string;
  cwd: string;
  tool_name?: string;
  file_path?: string;
  tool_input?: {
    description?: string;
    subagent_type?: string;
    prompt?: string;
  };
  // ... etc
}
```

**Proposed schemas.ts HookInputSchema (Task 3, lines 358-380):**
```typescript
export const HookInputSchema = z.object({
  hook_event_name: z.string(),
  cwd: z.string(),
  tool_name: z.string().optional(),
  file_path: z.string().optional(),
  tool_input: ToolInputSchema,  // << This is .optional() at line 353
  // ... etc
});
```

**The problem:**
`ToolInputSchema` is defined as `.optional()` (line 353), which means:
- Zod schema: `tool_input?: {description?: string, ...} | undefined`
- TypeScript interface: `tool_input?: {description?: string, ...}`

These are equivalent, BUT:
1. Task 4 doesn't include tests verifying existing hook inputs still parse correctly
2. No verification that existing callers handle the exported `HookInput` type correctly
3. Plan says to replace the interface in types.ts with re-export, which could break imports

**Missing step:**
Task 4 should include a test that validates sample real-world hook input from each hook type (PostToolUse, SubagentStop, UserPromptSubmit, etc.).

### 7. **Task 8 Has Logic Error in Boundary Check** (Runtime Bug)
**Location:** Task 8, Step 2, line 845
**Issue:** After incrementing task number, the plan checks:
```typescript
if (nextTaskNumber > tasks.length) {
  console.log(`Workflow complete: ${state.workflow}`);
  await manager.setActive(null);
  return;
}
```

**Type error:**
`nextTaskNumber` is `TaskNumber | null`. You cannot compare `TaskNumber | null > number` without first checking for null.

**Correct logic:**
```typescript
if (!nextTaskNumber) {
  console.error('Error: Invalid task number');
  process.exit(1);
}

if (nextTaskNumber > tasks.length) {
  console.log(`Workflow complete: ${state.workflow}`);
  await manager.setActive(null);
  return;
}
```

Wait, the plan DOES check for null at line 839-842, so `nextTaskNumber` is guaranteed non-null at line 845. BUT TypeScript doesn't narrow the type through the `process.exit()` call.

**Better approach:**
```typescript
if (!nextTaskNumber) {
  console.error('Error: Invalid task number');
  process.exit(1);
}

// Now nextTaskNumber is definitely TaskNumber (not null)
const taskNum = nextTaskNumber;

if (taskNum > tasks.length) {
  console.log(`Workflow complete: ${state.workflow}`);
  await manager.setActive(null);
  return;
}

const nextTask = tasks[taskNum - 1];
```

The plan's code might compile, but relies on control-flow analysis of `process.exit()`, which is fragile.

## NON-BLOCKING Issues (Suggestions)

### 1. **Task 1 Test Naming Inconsistency**
**Location:** Task 1, Step 1
**Observation:** Test describes use `it('...')` while Task 1 Step 1 shows them, but existing tests in `types.test.ts` use `test('...')`. For consistency, should match existing style.

**Recommendation:** Change `it('increments valid TaskNumber')` to `test('increments valid TaskNumber')` to match lines 5, 11, 16, 21 of existing types.test.ts.

### 2. **Task 3 Schema Could Be Stricter**
**Location:** Task 3, Step 4, lines 358-380
**Observation:** HookInputSchema uses `.string()` for all fields without additional validation:
- `cwd` could validate it's an absolute path
- `hook_event_name` could validate it's one of the known hook types
- `agent_id` could validate UUID format

**Recommendation:** Consider adding Zod refinements:
```typescript
hook_event_name: z.enum(['PostToolUse', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'SlashCommand', 'Skill']),
cwd: z.string().refine(p => path.isAbsolute(p), "cwd must be absolute path"),
```

This would catch configuration errors at the system boundary.

### 3. **Missing Integration Test for Full Pipeline**
**Location:** Task 9, Step 1
**Observation:** Task 9 runs the test suite but doesn't verify the end-to-end type safety improvements work together.

**Recommendation:** Add an integration test in Task 9 that:
1. Creates a TaskNumber via factory
2. Increments it with helper
3. Uses it in a TaskId
4. Parses a TaskId from string
5. Verifies all types flow correctly

This would catch any type incompatibilities between modules.

### 4. **Documentation of Branded Type Rationale**
**Location:** Task 1 and Task 7
**Observation:** Plan adds branded types but doesn't add JSDoc explaining WHY TaskNumber is branded.

**Recommendation:** Add a comment in task-id.ts:
```typescript
/**
 * Branded type for task numbers (1-indexed, never zero)
 *
 * Brand prevents:
 * - Using arbitrary numbers as task IDs
 * - Arithmetic operations creating invalid task numbers
 * - Mixing task numbers with other numeric types
 *
 * Always create via createTaskNumber() factory.
 */
export type TaskNumber = number & { readonly __brand: 'TaskNumber' };
```

### 5. **Task 6 Could Use Type-Level Test**
**Location:** Task 6
**Observation:** Task 6 uses `satisfies` to ensure SESSION_STATE_KEYS matches the interface, which is excellent. But there's no runtime test verifying this.

**Recommendation:** Add a test in Task 6:
```typescript
test('SESSION_STATE_KEYS contains all SessionState keys', () => {
  const stateKeys = new Set(SESSION_STATE_KEYS);
  const mockState: SessionState = { /* ... */ };
  const actualKeys = Object.keys(mockState);

  actualKeys.forEach(key => {
    expect(stateKeys.has(key as any)).toBe(true);
  });
});
```

### 6. **Task 2 Deprecation Message Could Be Clearer**
**Location:** Task 2, Step 3, line 217
**Observation:** Deprecation comment says "Use parseTaskIdFromString with { requireSeparator: true }" but doesn't explain WHY to migrate.

**Recommendation:**
```typescript
/**
 * @deprecated Use parseTaskIdFromString({ requireSeparator: true }) instead.
 * This function will be removed in v2.0. The unified parseTaskIdFromString
 * provides consistent parsing behavior across all task ID formats.
 */
```

### 7. **Error Message Could Be More Specific**
**Location:** Task 8, Step 2, line 840
**Observation:** Error message "Error: Invalid task number" doesn't explain why it's invalid.

**Recommendation:**
```typescript
if (!nextTaskNumber) {
  console.error(`Error: Invalid task number: ${options.step || `${state.task} + 1`}`);
  process.exit(1);
}
```

This helps users understand whether the issue is with their --step argument or workflow state.

### 8. **MAX_TASK_NUMBER Value Not Justified**
**Location:** Task 1, Step 3, line 69
**Observation:** `MAX_TASK_NUMBER = 999999` is defined but no comment explains this choice.

**Recommendation:**
```typescript
/**
 * Maximum valid task number (prevent overflow, keep IDs reasonable)
 *
 * Limit of 999,999 tasks prevents:
 * - Accidental infinite loops in workflow generation
 * - Integer overflow in task numbering
 * - Performance issues with excessively large workflows
 */
const MAX_TASK_NUMBER = 999999;
```

## Task-by-Task Assessment

### Task 1: Add TaskNumber Arithmetic Helpers
**Status:** ⚠️ NEEDS REVISION
**Issues:**
- BLOCKING #2: Uses type assertions instead of factory
- NON-BLOCKING #1: Test naming inconsistency
- NON-BLOCKING #8: MAX_TASK_NUMBER not documented

**Strengths:**
- Good TDD approach
- Tests cover edge cases (overflow, underflow)
- Clear separation of concerns

**Recommendation:** Fix type assertions to use `createTaskNumber` internally before execution.

### Task 2: Unify TaskId Parsing Functions
**Status:** ⚠️ NEEDS REVISION
**Issues:**
- BLOCKING #5: Incorrect line numbers
- NON-BLOCKING #6: Deprecation message could be clearer

**Strengths:**
- Good refactoring strategy (unified function with options)
- Maintains backward compatibility via deprecated wrapper
- Comprehensive test coverage for both modes

**Recommendation:** Update line numbers or use symbolic references.

### Task 3: Add HookInput Zod Schema
**Status:** ✅ APPROVED
**Issues:**
- NON-BLOCKING #2: Schema could be stricter

**Strengths:**
- Excellent TDD approach
- Good error handling with ParseResult type
- Tests cover success and failure cases
- Proper separation between JSON parsing and schema validation

**Recommendation:** Consider stricter validation in follow-up task.

### Task 4: Integrate HookInput Schema into CLI
**Status:** ⚠️ NEEDS REVISION
**Issues:**
- BLOCKING #6: Doesn't verify schema compatibility with existing inputs

**Strengths:**
- Clean integration strategy
- Single source of truth (re-export from schemas)
- Maintains test suite

**Recommendation:** Add integration test with real-world hook input samples.

### Task 5: Add Error Type Guards
**Status:** ✅ APPROVED
**Issues:** None

**Strengths:**
- Excellent type safety improvement
- Comprehensive test coverage
- Replaces unsafe type assertions with proper guards
- Follows TypeScript best practices

**Recommendation:** None - ready for execution.

### Task 6: Derive Session State Keys from Type
**Status:** ✅ APPROVED WITH SUGGESTION
**Issues:**
- NON-BLOCKING #5: Could add runtime verification test

**Strengths:**
- Clever use of `satisfies` for compile-time validation
- Eliminates manual maintenance of key list
- No breaking changes

**Recommendation:** Consider adding suggested test for completeness.

### Task 7: Use TaskNumber in TaskId
**Status:** 🚫 BLOCKED
**Issues:**
- BLOCKING #1: Circular import dependency (CRITICAL)
- BLOCKING #3: Duplicates TaskNumber logic
- BLOCKING #4: Missing comprehensive test updates

**Strengths:**
- Correct goal (stronger typing for TaskId)
- Attempts to consolidate types

**Critical problems:**
This task requires complete redesign. The circular import issue makes it unexecutable as written. The duplication of `createTaskNumber` also violates DRY and creates maintenance burden.

**Recommendation:** BLOCK execution until redesigned. Consider keeping TaskNumber in types.ts and importing it in task-id.ts, OR moving everything to task-id.ts and eliminating the reverse import.

### Task 8: Update workflow-cli.ts to Use incrementTaskNumber
**Status:** ⚠️ NEEDS REVISION
**Issues:**
- BLOCKING #7: Logic error in null handling (minor - TypeScript might catch this)
- NON-BLOCKING #7: Error message could be more specific
- Depends on Task 7 which is BLOCKED

**Strengths:**
- Correct usage of branded type helpers
- Removes manual arithmetic
- Good validation of task number

**Recommendation:** Fix null handling pattern and defer until Task 7 is redesigned.

### Task 9: Final Verification
**Status:** ✅ APPROVED
**Issues:**
- NON-BLOCKING #3: Missing integration test

**Strengths:**
- Comprehensive verification (tests, build, lint)
- Proper final commit

**Recommendation:** Consider adding suggested integration test.

## Overall Assessment

### Summary
This implementation plan has a **solid foundation** with excellent TDD practices, proper use of Zod for runtime validation, and good error handling improvements. However, it contains **critical architectural issues** that prevent execution:

1. **Task 7's circular import** is a fundamental design flaw that makes the plan unexecutable
2. **Code duplication** between Task 1 and Task 7 creates inconsistent validation
3. **Type assertions** in Task 1 undermine the type safety goals
4. **Missing compatibility tests** in Task 4 risk breaking existing code

### Strengths
- ✅ Consistent TDD approach across all tasks
- ✅ Good test coverage with edge cases
- ✅ Proper use of TypeScript branded types concept
- ✅ Zod integration for runtime validation
- ✅ Error handling improvements
- ✅ Backward compatibility via deprecation

### Weaknesses
- 🚫 Circular import dependency (Task 7) - CRITICAL
- 🚫 Code duplication creating inconsistent validation
- ⚠️ Type assertions undermining branded type safety
- ⚠️ Missing integration tests for schema compatibility
- ⚠️ Brittle line number references

### Recommendation
**BLOCKED** - Do not execute until the following are addressed:

1. **MUST FIX (Task 7):** Redesign module structure to eliminate circular imports
   - Option A: Keep TaskNumber in types.ts, import in task-id.ts
   - Option B: Move all to task-id.ts, eliminate reverse imports
   - Option C: Create separate task-number.ts module

2. **MUST FIX (Task 1):** Replace type assertions with factory calls
   ```typescript
   export function incrementTaskNumber(tn: TaskNumber): TaskNumber | null {
     return createTaskNumber(tn + 1);
   }
   ```

3. **MUST FIX (Task 3/7):** Consolidate TaskNumber validation logic
   - Single implementation of createTaskNumber with all validations
   - Include MAX_TASK_NUMBER check in one place only

4. **SHOULD FIX (Task 4):** Add integration tests
   - Test parsing real hook inputs from each hook type
   - Verify schema accepts all current valid inputs

5. **SHOULD FIX (Task 2):** Update line number references
   - Use symbolic references or verify line numbers before execution

### Estimated Impact of Fixes
- Task 7 redesign: **2-4 hours** (requires architectural decision + implementation)
- Task 1 type assertion fix: **30 minutes**
- Validation consolidation: **1 hour**
- Integration tests: **1-2 hours**
- Line number updates: **15 minutes**

**Total rework estimate:** 5-8 hours

### Final Verdict
This plan demonstrates strong engineering practices but needs architectural revision before execution. The circular import issue in Task 7 is a **show-stopper** that must be resolved. Once fixed, the plan will achieve its type safety goals effectively.

---

## Appendix: Suggested Task 7 Redesign (Option A)

**Revised Task 7: Use TaskNumber in TaskId**

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/task-id.ts`
- Modify: `plugin/hooks/hooks-app/__tests__/workflow/task-id.test.ts`

**Step 1: Update TaskId interface to use TaskNumber**

```typescript
import { createTaskNumber, type TaskNumber } from './types';

export interface TaskId {
  readonly task: TaskNumber;  // Changed from number
  readonly subtask?: string;
}
```

**Step 2: Update parseTaskIdFromString to create TaskNumber**

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

  const task = createTaskNumber(parseInt(match[1], 10));
  if (!task) return null;

  return {
    task,
    subtask: match[2]?.toUpperCase(),
  };
}
```

**Step 3: Update tests**

Add to `__tests__/workflow/task-id.test.ts`:

```typescript
import { createTaskNumber } from '../../src/workflow/types';

describe('parseTaskIdFromString with TaskNumber', () => {
  it('returns TaskId with TaskNumber brand', () => {
    const result = parseTaskIdFromString('3');
    expect(result).not.toBeNull();

    // Verify it's a TaskNumber by using it where TaskNumber is required
    const incrementTest = (tn: TaskNumber) => tn + 1;
    expect(incrementTest(result!.task)).toBe(4);
  });

  it('rejects zero via TaskNumber validation', () => {
    const result = parseTaskIdFromString('0');
    expect(result).toBeNull();
  });
});
```

**Step 4: Run tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/task-id.ts plugin/hooks/hooks-app/__tests__/workflow/task-id.test.ts
git commit -m "refactor(task-id): use TaskNumber branded type in TaskId interface"
```

**Key changes:**
- Import TaskNumber from types.ts (no circular dependency)
- Use createTaskNumber for validation (no duplication)
- No re-exports needed (types.ts already exports TaskNumber)
- Simpler, clearer implementation
