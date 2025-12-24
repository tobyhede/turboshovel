# Plan Review - Agent B (Implementation Perspective)
## Date: 2025-12-24
## Plan: CLI Type Safety Refactor

## Status: APPROVED WITH SUGGESTIONS

## BLOCKING Issues (Must Fix)

### 1. Task 1: MAX_TASK_NUMBER Duplication Risk
- **Issue:** Plan adds `MAX_TASK_NUMBER` constant in Task 1, then Task 7 moves TaskNumber to task-id.ts and re-adds the same constant
- **Problem:** This creates duplicate code that will exist temporarily, risking merge conflicts
- **Fix:** Either:
  - Option A: Task 1 should add MAX_TASK_NUMBER directly to task-id.ts (not types.ts)
  - Option B: Task 7 should explicitly remove MAX_TASK_NUMBER from types.ts when moving code
- **Impact:** Without fix, tests may fail or code may have duplicate constants

### 2. Task 2: Missing Import Update
- **Issue:** Plan says "Delete the local parseTaskIdFromArg function (lines ~394-408)" but actual location is lines 466-478
- **Problem:** Line numbers are incorrect, execution agent may fail to find the code
- **Fix:** Update plan to reference the function by name/search pattern, not line numbers
- **Impact:** Execution agent will waste time searching or skip this step

### 3. Task 7: Circular Import Not Fully Resolved
- **Issue:** Plan moves TaskNumber from types.ts to task-id.ts to fix circular import, but types.ts currently imports from task-id.ts (line 3: `import type { TaskId } from './task-id'`)
- **Problem:** Moving TaskNumber to task-id.ts creates the same circular dependency pattern since task-id.ts will need to import from types.ts
- **Current State:** types.ts already imports TaskId from task-id.ts, so adding TaskNumber there is fine
- **Fix:** Plan should verify that task-id.ts does NOT currently import from types.ts before the move
- **Impact:** May cause TypeScript compilation errors due to circular imports

## NON-BLOCKING Issues (Suggestions)

### 1. Task 1: Test Coverage for Edge Cases
- **Observation:** Tests check 999999 overflow but don't test negative increment results
- **Suggestion:** Add test for `incrementTaskNumber(createTaskNumber(999999)!)` to verify null return
- **Impact:** Low - implementation is correct, just missing explicit test case

### 2. Task 2: parseTaskIdFromString Regex Anchoring
- **Observation:** When `requireSeparator: false`, regex is `/^(\d+)(?:\.([A-Za-z]))?$/` (anchored at end)
- **Note:** This prevents parsing "3.A extra text" even without separator requirement
- **Suggestion:** Consider if this is intended behavior or if regex should be `/^(\d+)(?:\.([A-Za-z]))?/` (no end anchor)
- **Impact:** Medium - affects API behavior, should be intentional design choice

### 3. Task 3: Zod Schema Optional Field Validation
- **Observation:** All fields except hook_event_name and cwd are optional
- **Suggestion:** Consider adding `.refine()` validators for event-specific requirements (e.g., PostToolUse should have tool_name)
- **Impact:** Low - basic validation works, but could catch more errors at boundary

### 4. Task 6: SESSION_STATE_KEYS Missing Field
- **Issue:** Plan defines `SESSION_STATE_KEYS` array but omits `stashedWorkflowId` field
- **Verification:** types.ts line 118 has `stashedWorkflowId?: string;` in SessionState interface
- **Fix:** Add `'stashedWorkflowId'` to the SESSION_STATE_KEYS array
- **Impact:** Medium - runtime session key validation will fail for stashedWorkflowId

### 5. Task 7: TaskId.task Type Change Impact
- **Observation:** Changing `task: number` to `task: TaskNumber` affects WorkflowState.pendingTasks array
- **Current Code:** Line 67-72 of types.test.ts shows `pendingTasks: [{ task: 1 }, { task: 2, subtask: 'A' }]` with plain numbers
- **Suggestion:** Verify all TaskId creation sites use createTaskNumber after this change
- **Impact:** Medium - may cause type errors in test files and runtime code

### 6. Task 8: Variable Naming Inconsistency
- **Observation:** Plan renames `nextTaskNum` to `nextTaskNumber` but uses type `TaskNumber | null`
- **Current Code:** Lines 185-213 use `nextTaskNum: number` then validate with createTaskNumber
- **Suggestion:** Keep `nextTaskNumber` name but clarify it's the validated branded type
- **Impact:** Low - naming clarity for maintainability

### 7. General: Missing Test File Updates
- **Observation:** Plan creates new test files but doesn't update existing tests that may break
- **Example:** Task 7 changes TaskId.task to TaskNumber but doesn't list updating task-id.test.ts expectations
- **Suggestion:** Add explicit test update steps for breaking type changes
- **Impact:** Medium - tests may fail after type changes

### 8. General: No Rollback Strategy
- **Observation:** Plan has 9 sequential tasks with commits, but if Task 7 fails, previous commits are already made
- **Suggestion:** Document whether atomic commits are required or if partial completion is acceptable
- **Impact:** Low - good practice for plan execution

## File Verification

### Existing Files (✓ Confirmed)
- ✓ `plugin/hooks/hooks-app/src/workflow/types.ts` (exists)
- ✓ `plugin/hooks/hooks-app/__tests__/workflow/types.test.ts` (exists)
- ✓ `plugin/hooks/hooks-app/src/workflow/task-id.ts` (exists)
- ✓ `plugin/hooks/hooks-app/__tests__/workflow/task-id.test.ts` (exists)
- ✓ `plugin/hooks/hooks-app/src/cli/workflow-cli.ts` (exists)
- ✓ `plugin/hooks/hooks-app/src/cli.ts` (exists)
- ✓ `plugin/hooks/hooks-app/src/types.ts` (exists)
- ✓ `plugin/hooks/hooks-app/package.json` (exists)

### Files to Create (⚠ Must Not Exist Yet)
- ✓ `plugin/hooks/hooks-app/src/schemas.ts` (does not exist - good)
- ✓ `plugin/hooks/hooks-app/__tests__/schemas.test.ts` (does not exist - good)
- ✓ `plugin/hooks/hooks-app/src/errors.ts` (does not exist - good)
- ✓ `plugin/hooks/hooks-app/__tests__/errors.test.ts` (does not exist - good)

### Package Dependencies
- ⚠ `zod` - NOT currently installed (verified via npm list)
- ✓ Plan correctly includes `npm install zod` in Task 3

## Task Feasibility Assessment

### Task 1: Add TaskNumber Arithmetic Helpers ✅ FEASIBLE
- File exists, structure is correct
- Implementation is straightforward
- Tests follow TDD pattern correctly
- **Risk:** Duplication with Task 7 (see BLOCKING #1)

### Task 2: Unify TaskId Parsing Functions ✅ FEASIBLE
- parseTaskIdFromArg exists at line 466-478 (not 394-408)
- Unification logic is sound
- **Risk:** Incorrect line numbers in plan (see BLOCKING #2)

### Task 3: Add HookInput Zod Schema ✅ FEASIBLE
- Zod needs to be installed (correctly specified)
- Schema matches current HookInput interface in types.ts
- No conflicts detected

### Task 4: Integrate HookInput Schema into CLI ✅ FEASIBLE
- Current cli.ts parses JSON manually (lines 188-212 area)
- Integration point is clear
- Backward compatible change

### Task 5: Add Error Type Guards ✅ FEASIBLE
- Current code uses `(error as NodeJS.ErrnoException).code` pattern (line 108)
- Type guards eliminate this anti-pattern
- Implementation is standard TypeScript

### Task 6: Derive Session State Keys from Type ⚠ NEEDS FIX
- Current isSessionStateKey manually lists keys (lines 44-53 of cli.ts)
- **Risk:** Plan omits `stashedWorkflowId` from SESSION_STATE_KEYS (see NON-BLOCKING #4)
- Otherwise implementation is sound

### Task 7: Use TaskNumber in TaskId ⚠ HIGH RISK
- **Risk:** Circular import issue (see BLOCKING #3)
- **Risk:** Breaks existing code that creates TaskId with plain numbers
- **Impact:** WorkflowState.pendingTasks, all parseTaskId call sites
- **Suggestion:** Verify no circular dependency before execution

### Task 8: Update workflow-cli.ts to Use incrementTaskNumber ✅ FEASIBLE
- Current code at lines 185-213 uses plain arithmetic
- Replacement with helper is straightforward
- Type safety improvement is clear

### Task 9: Final Verification ✅ FEASIBLE
- Standard verification steps
- Project currently builds without errors (verified)
- All 328 tests currently pass (verified)

## Dependency Graph Analysis

### Import Dependencies (Current State)
```
types.ts → task-id.ts (imports TaskId)
workflow-cli.ts → task-id.ts (imports functions)
workflow-cli.ts → types.ts (imports TaskNumber, Action, Task)
cli.ts → types.ts (imports HookInput, SessionState)
```

### After Task 7 Changes
```
task-id.ts: defines TaskNumber, TaskId
types.ts → task-id.ts (re-exports TaskNumber, TaskId)
workflow-cli.ts → task-id.ts (imports TaskNumber functions)
workflow-cli.ts → types.ts (imports Action, Task)
```

### Circular Import Risk
- ⚠ task-id.ts will define TaskId with `task: TaskNumber`
- ⚠ If task-id.ts needs to import anything from types.ts, circular dependency occurs
- ✓ Current task-id.ts has NO imports from types.ts
- ✓ Move is safe IF task-id.ts remains independent

## Code Quality Assessment

### Type Safety Improvements ✅ EXCELLENT
- Branded types prevent invalid task numbers
- Zod validation at system boundary
- Type guards eliminate type assertions
- Discriminated unions prevent invalid states

### Idiomatic TypeScript ✅ GOOD
- `satisfies` operator for SESSION_STATE_KEYS (Task 6)
- Branded types with factory functions
- Readonly properties
- Type guards with type predicates

### Error Handling ✅ GOOD
- Type guards replace unsafe casts
- Null returns for invalid inputs (fail fast)
- Clear error messages

### Test Coverage ✅ GOOD
- TDD approach for all new code
- Edge cases covered
- Integration tests exist (328 tests currently pass)

### Potential Code Smells
- ⚠ Deprecated function pattern in Task 2 (parseTaskId wrapper)
  - Better: Remove entirely or mark with JSDoc @deprecated
- ⚠ Type assertion in arithmetic helpers: `return n as TaskNumber`
  - Acceptable: Factory pattern validates before cast

## Implementation Risks

### High Risk
1. **Task 7 Circular Import:** Moving TaskNumber may cause compilation errors
2. **Task 7 Breaking Changes:** TaskId.task type change affects many call sites

### Medium Risk
1. **Task 6 Missing Field:** SESSION_STATE_KEYS incomplete
2. **Task 2 Line Number Mismatch:** May confuse executor

### Low Risk
1. **Task 1 Duplication:** Temporary duplicate code
2. **Test Updates:** May need more test file changes than listed

## Overall Assessment

### Strengths
- ✅ Clear TDD approach for all tasks
- ✅ Proper TypeScript patterns (branded types, type guards, satisfies)
- ✅ Incremental commits allow rollback
- ✅ All files verified to exist
- ✅ Baseline tests pass (328/328)
- ✅ Baseline build succeeds

### Weaknesses
- ⚠ Circular import risk in Task 7 needs verification
- ⚠ Missing stashedWorkflowId in SESSION_STATE_KEYS array
- ⚠ Incorrect line numbers in Task 2
- ⚠ Potential breaking changes not fully assessed

### Recommendation
**APPROVED WITH SUGGESTIONS**

The plan is fundamentally sound and implements proper TypeScript type safety patterns. However, the following MUST be addressed before execution:

1. **CRITICAL:** Verify Task 7 circular import issue - ensure task-id.ts can define TaskNumber without importing from types.ts
2. **CRITICAL:** Fix Task 6 to include `stashedWorkflowId` in SESSION_STATE_KEYS array
3. **IMPORTANT:** Update Task 2 to use function name search instead of line numbers
4. **IMPORTANT:** Resolve MAX_TASK_NUMBER duplication between Task 1 and Task 7

With these fixes, the plan is ready for execution using `cipherpowers:executing-plans`.

### Estimated Execution Time
- **Best Case:** 90-120 minutes (all tasks execute cleanly)
- **Realistic:** 2-3 hours (minor test adjustments needed)
- **Worst Case:** 4-5 hours (circular import requires refactoring)

### Confidence Level
**75%** - Plan is well-structured but has 1-2 blocking issues that need resolution before execution.
