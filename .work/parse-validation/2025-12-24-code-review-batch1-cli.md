# Code Review - 2025-12-24

## Status: BLOCKED

## BLOCKING (Must Fix Before Merge)

**Unused import causing lint failure:**
- Description: The `parseTaskId` function is imported from `../workflow/task-id` but never used. The implementation uses a local `parseTaskIdFromArg` function instead. This causes an eslint error that will fail CI.
- Location: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli/workflow-cli.ts:9`
- Action: Remove unused import `parseTaskId` from line 9. The import should be:
  ```typescript
  import { taskIdToString, type TaskId } from '../workflow/task-id';
  ```

## NON-BLOCKING (May Be Deferred)

**Test uses explicit `any` type:**
- Description: The `runCli` catch block uses `error: any` which triggers a linter warning. While functional, this reduces type safety.
- Location: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts:42`
- Action: Consider using a more specific type or a type guard. Example:
  ```typescript
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || '',
      exitCode: execError.status || 1,
    };
  }
  ```

**Duplicate TaskId parsing logic:**
- Description: `parseTaskIdFromArg` in workflow-cli.ts duplicates logic that exists in `parseTaskId` from task-id.ts. The main difference is that `parseTaskIdFromArg` matches against raw arguments (e.g., "3.A") while `parseTaskId` expects a trailing separator.
- Location: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli/workflow-cli.ts:391-403`
- Action: Consider extending `task-id.ts` to export a `parseTaskIdRaw` function that handles both formats, or document why the duplication is intentional. This prevents future drift between the two parsing implementations.

**Missing test for --task and --agent combined:**
- Description: The plan specifies `workflow start --task 2.A` followed by `workflow start --agent xyz` as separate calls. However, there is no test for when both `--task` and `--agent` are provided together. The current implementation would silently ignore `--task` when `--agent` is present (since `--agent` check comes after `--task && !options.agent`).
- Location: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`
- Action: Add a test case or document expected behavior when both options are provided. If simultaneous use is invalid, add explicit error handling with a helpful message.

**Comment says "Mode 2" but logic is mode-branching:**
- Description: Comments reference "Mode 1", "Mode 3", "Mode 2" but they appear out of order (1, 3, 2), which could confuse future maintainers.
- Location: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli/workflow-cli.ts:33,53,77`
- Action: Either renumber modes logically (1, 2, 3) or remove mode numbering and describe each case descriptively (e.g., "Task queue mode", "Agent binding mode", "File start mode").

## Checklist

**Security & Correctness:**
- [x] No security vulnerabilities (SQL injection, XSS, CSRF, exposed secrets)
- [x] No insecure dependencies or deprecated cryptographic functions
- [x] No critical logic bugs (meets acceptance criteria)
- [x] No race conditions, deadlocks, or data races
- [x] No unhandled errors, rejected promises, or panics
- [x] No breaking API or schema changes without migration plan

**Testing:**
- [x] All tests passing (unit, integration, property-based where applicable)
- [x] New logic has corresponding tests
- [x] Tests cover edge cases and error conditions
- [x] Tests verify behavior (not implementation details)
- [ ] Property-based tests for mathematical/algorithmic code with invariants - N/A for CLI commands
- [x] Tests are isolated (independent, don't rely on other tests)
- [x] Test names are clear and use structured arrange-act-assert patterns

**Architecture:**
- [x] Single Responsibility Principle (functions/files have one clear purpose)
- [ ] No non-trivial duplication - see parseTaskIdFromArg note above
- [x] Clean separation of concerns (business logic separate from data marshalling)
- [x] No leaky abstractions (internal details not exposed)
- [x] No over-engineering (YAGNI - implement only current requirements)
- [x] No tight coupling (excessive dependencies between modules)
- [x] Proper encapsulation (internal details not exposed across boundaries)
- [x] Modules can be understood and tested in isolation

**Error Handling:**
- [x] No swallowed exceptions or silent failures
- [x] Error messages provide sufficient context for debugging
- [x] Fail-fast on invariants where appropriate

**Code Quality:**
- [x] Simple, not clever (straightforward solutions over complex ones)
- [x] Clear, descriptive naming (variables, functions, classes)
- [x] Type safety maintained
- [x] Follows language idioms and project patterns consistently
- [x] No magic numbers or hardcoded strings (use named constants)
- [x] Consistent approaches when similar functionality exists elsewhere
- [x] Comments explain "why" not "what" (code should be self-documenting)
- [x] Rationale provided for non-obvious design decisions
- [ ] Doc comments for public APIs - N/A for CLI, help text serves this purpose

**Process:**
- [x] No obvious performance issues (N+1 queries, inefficient algorithms on hot paths)
- [ ] ALL linter warnings addressed by fixing root cause - see BLOCKING issue
- [x] Requirements met exactly (no scope creep)
- [x] No unnecessary reinvention (appropriate use of existing libraries/patterns)

## Next Steps

1. Address BLOCKING issues (remove unused `parseTaskId` import)
2. Consider NON-BLOCKING suggestions
3. Ready to merge when status is APPROVED or APPROVED WITH SUGGESTIONS

---

## Additional Context

**Commits reviewed:**
- `39358a2` feat(cli): add --pass/--fail/--agent to workflow next
- `36fb212` feat(cli): add --agent option to workflow start
- `6921b50` feat(cli): add --task option to workflow start

**Files changed:**
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli/workflow-cli.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Verification commands run:**
```bash
npm test -- --testPathPattern="workflow-cli" --no-coverage  # PASS
npm run build  # PASS
npm run lint  # FAIL (1 error, 1 warning)
```

**Implementation vs Plan comparison:**
- Task 1 (--task option): Implemented as specified
- Task 2 (--agent option): Implemented as specified
- Task 3 (--pass/--fail options): Implemented as specified
- Tests match plan specifications with minor additions for setup
