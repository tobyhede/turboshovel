# Review: Rename gates.json to turboshovel.json

**Plan:** `.work/rename-gates-json/2025-12-28-rename-gates-json.md`
**Status:** Approved with Changes

## Summary
The plan comprehensively covers the renaming of `gates.json` to `turboshovel.json` and the corresponding TypeScript interface change from `GatesConfig` to `TurboshovelConfig`. It correctly identifies the core configuration logic, type definitions, and consumer files (gate loader, dispatcher). It also includes a thorough update of documentation and tests.

## Evaluation

| Criteria | Status | Notes |
|----------|--------|-------|
| **Completeness** | ⚠️ | One file missing from modification list: `plugin/core/src/action-handler.ts`. |
| **Correctness** | ✅ | Code snippets match current codebase. Logic for renaming is sound. |
| **Safety** | ✅ | Verification steps are included. "Clean break" strategy is clearly stated. |
| **Testing** | ✅ | Updates to all relevant test files are included. |
| **Documentation** | ✅ | All major documentation files are targeted for update. |

## Findings

1. **Missing File Update:**
   - `plugin/core/src/action-handler.ts` imports `GatesConfig` from `@turboshovel/shared` but is not listed in any task for source modification.
   - Task 9 covers `plugin/core/__tests__/action-handler.test.ts`, but the source file itself needs the type update.

2. **Verification of Exports:**
   - Task 1 correctly identifies checking `packages/shared/src/index.ts`. I verified that this file exports `* from './types.js'`, so the interface rename will propagate correctly.

## Recommendations

1. **Add Task for Action Handler:**
   - Insert a new task (or update Task 4/9) to update `plugin/core/src/action-handler.ts`.
   - Action: Replace `GatesConfig` import and usage with `TurboshovelConfig`.

   *Suggested Task Addition:*
   ```markdown
   ### Task 4b: Update Action Handler
   
   **Files:**
   - Modify: `plugin/core/src/action-handler.ts`
   
   **Step 1: Update imports and types**
   
   Replace `GatesConfig` with `TurboshovelConfig`.
   
   **Step 2: Commit**
   
   ```bash
   git add plugin/core/src/action-handler.ts
   git commit -m "refactor(action-handler): use TurboshovelConfig type"
   ```
   ```

2. **Proceed with Plan:**
   - With the above addition, the plan is ready for execution.
