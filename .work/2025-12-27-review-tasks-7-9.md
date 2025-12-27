---
name: Code Review Template
description: Structured format for saving code review feedback.
when_to_use: when conducting code reviews and saving structured feedback to work directories
version: 1.0.0
---

# Code Review - 2025-12-27

## Status: BLOCKED

<!--
Status guidance:
- BLOCKED: Has BLOCKING issues that must be fixed before merge
- APPROVED WITH (NON-BLOCKING) SUGGESTIONS: Ready to merge, but consider addressing suggestions
- APPROVED: Clean, ready to merge with no issues

Note: Tests and checks are assumed to pass. This review focuses on code quality.
-->

## BLOCKING (Must Fix Before Merge)

**Missing __dirname Polyfill for ESM:**
- Description: Three files use `__dirname` which is a CommonJS global not available in ESM modules. With "type": "module" in package.json, these files will fail at runtime with "ReferenceError: __dirname is not defined"
- Location:
  - plugin/core/src/gates/plugin-path.ts:48
  - plugin/core/src/context.ts:26
  - plugin/core/src/config.ts:165
- Action: Before Tasks 10-12 (import migration), add ESM-compatible path resolution. Replace `__dirname` with:
  ```typescript
  import { fileURLToPath } from 'url';
  import { dirname } from 'path';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  ```
  This must be done before converting imports to ESM, as the code will break immediately upon first execution.

**Jest Config File Not Properly Renamed:**
- Description: Task 9 commit message says "rename jest.config.js to .cjs" but git shows this as ADD (A) not RENAME (R). The old jest.config.js still exists in git history but wasn't explicitly deleted in the commit, creating ambiguity about whether this was a rename or copy.
- Location: plugin/core/jest.config.cjs (git diff shows "A" status, not "R")
- Action: Verify git history with `git log --follow plugin/core/jest.config.cjs` to confirm this was properly tracked as a rename. If not, the next commit should explicitly remove the old file to prevent confusion. While the file is functionally deleted (verified with `test -f`), proper git rename tracking is important for history and future migrations.

**Missing "exports" Field in package.json:**
- Description: ESM packages should define explicit entry points via "exports" field for proper module resolution. Without this, Node.js falls back to "main" field which may not work correctly with ESM + TypeScript dual-mode scenarios.
- Location: plugin/core/package.json:5-6
- Action: Add exports field after "main":
  ```json
  "main": "dist/cli.js",
  "exports": {
    ".": "./dist/cli.js"
  },
  ```
  This ensures consumers of @turboshovel/core can import it correctly in both ESM and TypeScript contexts.


## NON-BLOCKING (May Be Deferred)

**Jest Config Has Hardcoded CommonJS Mode:**
- Description: jest.config.cjs has `useESM: false` and `module: 'commonjs'` hardcoded in tsconfig overrides. This is correct for now (tests run in CommonJS mode via .cjs extension), but creates maintenance debt if tests need to move to ESM later.
- Location: plugin/core/jest.config.cjs:11, 19
- Action: Consider adding a comment explaining this is intentional for test isolation:
  ```javascript
  // Tests run in CommonJS mode for compatibility with ts-jest
  // Source code compiles to ESM (tsconfig.json), tests transpile to CJS
  useESM: false,
  ```

**Missing File Extensions in Import Paths:**
- Description: The current .ts source files use extensionless imports (e.g., `import { foo } from './bar'`). While TypeScript allows this, ESM requires explicit extensions (`.js` for compiled output). This will become a BLOCKING issue in Tasks 10-12 when imports are migrated.
- Location: All import statements in plugin/core/src/
- Action: During Tasks 10-12, ensure all relative imports use `.js` extensions (not `.ts`) since imports reference the compiled output. This is a known TypeScript+ESM gotcha.

**package.json Missing bin Field:**
- Description: The package.json has "main": "dist/cli.js" but no "bin" field. If @turboshovel/core is meant to be executable via CLI, it needs a bin entry point.
- Location: plugin/core/package.json:6
- Action: If cli.js is intended as a CLI tool, add:
  ```json
  "bin": {
    "turboshovel-core": "./dist/cli.js"
  }
  ```
  If it's library-only, consider renaming dist/cli.js to dist/index.js for clarity.


## Checklist

**Security & Correctness:**
- [x] No security vulnerabilities (SQL injection, XSS, CSRF, exposed secrets)
- [x] No insecure dependencies or deprecated cryptographic functions
- [ ] No critical logic bugs (meets acceptance criteria) - BLOCKED by __dirname issue
- [x] No race conditions, deadlocks, or data races
- [x] No unhandled errors, rejected promises, or panics
- [x] No breaking API or schema changes without migration plan

**Testing:**
- [x] All tests passing (unit, integration, property-based where applicable) - Assumed per standards
- [x] New logic has corresponding tests - No new logic, only config changes
- [x] Tests cover edge cases and error conditions
- [x] Tests verify behavior (not implementation details)
- [x] Property-based tests for mathematical/algorithmic code with invariants - N/A
- [x] Tests are isolated (independent, don't rely on other tests)
- [x] Test names are clear and use structured arrange-act-assert patterns

**Architecture:**
- [x] Single Responsibility Principle (functions/files have one clear purpose)
- [x] No non-trivial duplication (logic that if changed in one place would need changing elsewhere)
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
- [x] Doc comments for public APIs

**Process:**
- [x] No obvious performance issues (N+1 queries, inefficient algorithms on hot paths)
- [x] ALL linter warnings addressed by fixing root cause (disable/allow/ignore ONLY when unavoidable)
- [x] Requirements met exactly (no scope creep)
- [x] No unnecessary reinvention (appropriate use of existing libraries/patterns)


## Next Steps

1. Address BLOCKING issues before proceeding to Tasks 10-12
2. Consider NON-BLOCKING suggestions
3. Ready to merge when status is APPROVED or APPROVED WITH SUGGESTIONS


---

## Review Context

**Commits Reviewed:**
```
2b524b7 chore(core): rename jest.config.js to .cjs for ESM compatibility
0659ae7 chore(core): update tsconfig for ESM
c6be25c chore(core): convert to ESM module type
```

**Files Changed:**
- plugin/core/package.json - Added "type": "module" and @turboshovel/shared dependency
- plugin/core/tsconfig.json - Changed to "module": "NodeNext", "moduleResolution": "NodeNext"
- plugin/core/jest.config.cjs - New file (status: A - Added, not R - Renamed)

**Verification Commands Run:**
```bash
git log --oneline -5
git log -3 --stat
git diff HEAD~3..HEAD
git diff HEAD~3..HEAD --name-status | grep jest
test -f plugin/core/jest.config.js  # Result: DELETED
grep -r "__dirname" src/ --include="*.ts"
```

**Critical Finding:**
The __dirname usage in three source files will cause immediate runtime failures once ESM imports are added in Tasks 10-12. This must be addressed before proceeding with import migration.

**Plan Adherence:**
Tasks 7-9 were completed as specified in the plan, but the plan did not account for the CommonJS global (__dirname) usage in existing source code. This is a gap in the plan that must be addressed before continuing.
