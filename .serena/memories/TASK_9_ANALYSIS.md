# TASK 9: Runtime Handling of NEXT and GOTO {N}.M - Analysis

## Current State of Implementation

### NEXT Action - ALREADY IMPLEMENTED

The NEXT action is already fully implemented in:

1. **Types** (`packages/shared/src/workflow/types.ts`):
   - NEXT is already a valid NonRetryAction type
   - Type definition: `{ readonly type: 'NEXT' }`

2. **Transition Handler** (`packages/shared/src/workflow/transition-handler.ts`):
   - `evaluatePassCondition()` handles NEXT: returns `{ action: 'next' }`
   - `evaluateFailCondition()` handles NEXT: returns `{ action: 'next' }`
   - Tests exist in transition-handler.test.ts for NEXT handling

3. **Compiler** (`packages/shared/src/workflow/compiler.ts`):
   - Current cases: 'CONTINUE', 'DONE', 'STOP', 'GOTO'
   - **MISSING**: 'NEXT' case in nonRetryActionToTransition
   - Must add: When NEXT is encountered, it should transition to step_1 with substep: '1' and mark for instance increment

### GOTO {N}.M - PARTIALLY IMPLEMENTED

1. **Static GOTO** is implemented:
   - Compiler has GOTO case for static step numbers
   - Returns: `target: 'step_X'`

2. **Dynamic GOTO {N}.M** is NOT implemented:
   - Compiler GOTO case needs to detect when target.step === '{N}'
   - For dynamic steps: `{N}` means "current instance"
   - Must return: `target: 'step_1'` (stay in dynamic state) with substep set

3. **Execution** (`packages/cli/src/services/execution.ts`):
   - deriveAction() function detects and prints GOTO transitions
   - **MISSING**: Handling of `{ action: 'next' }` from transition handler
   - Must increment step number in state when NEXT action is detected

## What Needs to be Done

### Step 9.1-9.2: Write and Run Failing Tests
- Create `packages/shared/__tests__/workflow/compiler.test.ts` (doesn't exist yet)
- Add tests for GOTO {N}.1 compilation
- Add tests for NEXT action compilation
- Run to verify they fail

### Step 9.3: Update Compiler for GOTO {N}.M
- Modify nonRetryActionToTransition in compiler.ts
- Handle case where targetStep === '{N}'
- Return step_1 target with substep set (for dynamic step navigation)

### Step 9.4: Update Compiler for NEXT Action
- Add NEXT case in nonRetryActionToTransition
- Return step_1 target with substep: '1' and action mark for instance increment
- Note: XState doesn't have native "nextInstance" field, needs workaround

### Step 9.5: Update Execution for Instance Increment
- Modify packages/cli/src/services/execution.ts
- After XState transition, check if action is 'next'
- Increment step number: `state.step + 1`
- Reset substep to '1'
- Console log instance transition

### Step 9.6-9.9: Run Tests, Integration Test, Commit
- Compile and test full suite
- Verify no regressions
- Commit changes

## Key Insight: Dynamic vs Static Steps

For dynamic workflows with `## {N}`:
- XState machine has only ONE state: `step_1`
- WorkflowState.step tracks the INSTANCE NUMBER (task 1, task 2, task 3...)
- GOTO {N}.M = stay in step_1, change substep
- NEXT = increment instance, stay in step_1, reset to substep 1

The plan specifies a `nextInstance: true` flag in the assign action to signal the executor.
This is correct because XState cannot natively track this state transition.
