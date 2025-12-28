# Follow-up: Consolidate Duplicate condition-handler Implementations

## Context

After fixing the `PASS: DONE` bug, we have two identical implementations of `ConditionResult`, `evaluateFailCondition`, and `evaluatePassCondition`:

1. **Shared package**: `packages/shared/src/workflow/condition-handler.ts`
2. **Plugin copy**: `plugin/core/src/cli/condition-handler.ts`

Both must be kept in sync manually, creating drift risk.

## Task

Consolidate so the plugin reuses the shared implementation:

1. **Remove** `plugin/core/src/cli/condition-handler.ts`
2. **Update imports** in `plugin/core/src/cli/workflow-cli.ts` to use `@turboshovel/shared`:
   ```typescript
   import { evaluateFailCondition, evaluatePassCondition } from '@turboshovel/shared';
   ```
3. **Move tests** from `plugin/core/__tests__/cli/condition-handler.test.ts` to a new test file in `packages/shared` (requires setting up Jest in shared package)
4. **Verify** all builds pass and tests run

## Files to Modify

- Delete: `plugin/core/src/cli/condition-handler.ts`
- Modify: `plugin/core/src/cli/workflow-cli.ts` (update imports)
- Move: `plugin/core/__tests__/cli/condition-handler.test.ts` → `packages/shared`
- Add: Jest config to `packages/shared/package.json`

## Acceptance Criteria

- Single source of truth for condition evaluation logic
- All existing tests pass from new location
- Both CLI implementations work identically
