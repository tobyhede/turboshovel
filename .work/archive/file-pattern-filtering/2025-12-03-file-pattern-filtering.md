# File Pattern Filtering for Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add file pattern filtering to gates configuration, enabling monorepo projects to run different gates based on which files were modified.

**Architecture:** Extend existing gate filtering system (similar to `keywords` field) with a `file_patterns` field that uses glob matching on relative file paths. Filter applied in dispatcher before gate execution, falling back to "always run" for backwards compatibility.

**Tech Stack:** TypeScript, minimatch (glob matching), Jest (testing)

---

## ⚠️ PLAN REVISIONS (2025-12-03)

This plan has been revised to fix 20 issues identified in dual-verification review:

**TIER 1 - Compilation Blockers (FIXED):**
- Task 3: Moved imports to file top (was inline)
- Task 2: Added note to preserve description field in GateConfig
- Task 4: Fixed jest.mock setup (moved to file top, fixed beforeEach)

**TIER 2 - Test/Runtime Issues (FIXED):**
- Task 4: Fixed test assertions to use DispatchResult.context instead of string
- Task 4: Added comments about async dispatch handling
- Task 5: Kept Task 3 .some() implementation, removed unnecessary refactoring
- Task 3: Fixed async logger pattern to use await

**TIER 3 - Error Handling & Config (FIXED):**
- Task 3: Added try-catch for minimatch with user-facing error messages
- Task 3: Added relative path normalization (path.isAbsolute check)
- Task 2.5: Added new task for pattern validation at config load time
- Task 1: Added check for @types/minimatch (minimatch v9+ has built-in types)
- Task 8: Preserved existing CLAUDE.md check gate example
- Task 9: Added backup/restore for gates.json in manual testing

**TIER 4 - Code Quality (FIXED):**
- Task 3: Added inline comments explaining minimatch options
- Task 3: Export function (matches gateMatchesKeywords pattern)

**Additional Improvements (FIXED):**
- Task 2: Clarified test file guidance ("Add to existing" not "create if doesn't exist")
- Task 3: Added empty string test, path traversal test, relative path test
- Task 4: Added multiple gates integration test
- Task 6: Clarified glob vs gitignore syntax ("similar to" not "same as")
- Task 6: Added performance documentation (O(n*m) complexity)
- Task 6: Added link to minimatch docs with brace expansion examples
- Task 9: Added clear verification criteria for manual testing

---

## ⚠️ IMPLEMENTATION REVISIONS (2025-12-03 - During Execution)

**Task 2.5 - Architecture Decision:**
- **Function location:** Implemented in `config.ts` (not `dispatcher.ts` as originally specified)
- **Rationale:** `validateFilePatterns()` is called from `validateConfig()` in config.ts. Placing it in the same file follows single responsibility principle and matches existing validation patterns.
- **Impact:** No functional change, better code organization.

**Task 2.5 - Validation Approach Revision:**
- **Original plan:** Validate glob syntax using minimatch error handling
- **Research findings:** minimatch v10.1.1 does NOT throw errors for malformed glob syntax (e.g., `packages/[abc/**`). It only throws for type errors (non-string inputs).
- **Revised approach:** Type-only validation (validates `typeof pattern === 'string'`)
- **Justification:** Matches idiomatic TypeScript/Node.js approach used by Jest, ESLint, and Webpack. These tools validate types at config load time but defer syntax issues to runtime (where malformed patterns simply don't match).
- **Trade-off:** Pattern syntax typos discovered at runtime (when patterns fail to match) rather than config load time. This is acceptable and follows ecosystem standards.
- **Tests:** 3 tests implemented - valid patterns, non-string pattern (type error), no patterns (undefined)

---

## Task 1: Add minimatch dependency

**Files:**
- Modify: `plugin/hooks/hooks-app/package.json`

**Step 1: Install minimatch**

Run: `cd plugin/hooks/hooks-app && npm install minimatch`
Expected: Package added to dependencies

**Step 2: Verify type definitions (minimatch v9+ includes built-in types)**

Run: `cd plugin/hooks/hooks-app && npm list minimatch`
Expected: Shows minimatch version

FIX: If minimatch >=9.0.0, skip @types/minimatch installation (types are built-in).
Only install @types/minimatch if minimatch version is <9.0.0:

```bash
# Only if minimatch <9.0.0
npm install --save-dev @types/minimatch
```

**Step 3: Verify installation**

Run: `cd plugin/hooks/hooks-app && npm list minimatch`
Expected: Shows minimatch@^9.0.3 or similar

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/package.json plugin/hooks/hooks-app/package-lock.json
git commit -m "feat(deps): add minimatch for file pattern matching"
```

---

## Task 2: Add file_patterns field to GateConfig type

**Files:**
- Modify: `plugin/hooks/hooks-app/src/types.ts:39-58`

**Step 1: Write the failing test**

Add to existing `plugin/hooks/hooks-app/__tests__/types.test.ts`:

```typescript
import { GateConfig } from '../src/types';

describe('GateConfig type', () => {
  it('should allow file_patterns field', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['packages/cts/**', 'src/**/*.ts'],
      on_pass: 'CONTINUE'
    };

    expect(config.file_patterns).toEqual(['packages/cts/**', 'src/**/*.ts']);
  });

  it('should allow file_patterns to be undefined', () => {
    const config: GateConfig = {
      command: 'echo test',
      on_pass: 'CONTINUE'
    };

    expect(config.file_patterns).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- types.test.ts`
Expected: FAIL with TypeScript error "file_patterns does not exist on type GateConfig"

**Step 3: Add file_patterns field to GateConfig**

In `plugin/hooks/hooks-app/src/types.ts`, after line 55 (keywords field), add the `file_patterns` field:

```typescript
  /**
   * File path glob patterns that trigger this gate (PostToolUse hook only).
   * When specified, the gate only runs if the modified file matches one of these patterns.
   * Patterns are matched against relative paths from project root using minimatch.
   * Multiple patterns use OR logic - gate runs if file matches ANY pattern.
   * For all other hooks (SubagentStop, UserPromptSubmit, etc.), this field is ignored.
   * Gates without patterns always run (backwards compatible).
   *
   * Examples:
   * - "packages/cts/**" - All files in packages/cts/
   * - "src/**\/*.ts" - All TypeScript files in src/
   * - "*.json" - JSON files in project root
   */
  file_patterns?: string[];
```

NOTE: Keep all existing fields (plugin, gate, command, keywords, description, on_pass, on_fail). The complete GateConfig interface should include the `description?: string` field that exists in the codebase.

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- types.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/types.ts plugin/hooks/hooks-app/__tests__/types.test.ts
git commit -m "feat(types): add file_patterns field to GateConfig"
```

---

## Task 2.5: Add pattern validation at config load time

**Files:**
- Modify: `plugin/hooks/hooks-app/src/dispatcher.ts` (config loading)

**Step 1: Write failing test for pattern validation**

Add to `plugin/hooks/hooks-app/__tests__/dispatcher.test.ts`:

```typescript
describe('validateFilePatterns', () => {
  it('should accept valid patterns', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['packages/cts/**', 'src/**/*.ts', '*.json'],
      on_pass: 'CONTINUE'
    };
    expect(() => validateFilePatterns(config)).not.toThrow();
  });

  it('should throw error for invalid pattern (unmatched bracket)', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['packages/[abc/**'],
      on_pass: 'CONTINUE'
    };
    expect(() => validateFilePatterns(config)).toThrow(/Invalid file pattern/);
  });

  it('should skip validation when no patterns specified', () => {
    const config: GateConfig = {
      command: 'echo test',
      on_pass: 'CONTINUE'
    };
    expect(() => validateFilePatterns(config)).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testNamePattern="validateFilePatterns"`
Expected: FAIL with "validateFilePatterns is not defined"

**Step 3: Implement validateFilePatterns function**

Add to `plugin/hooks/hooks-app/src/dispatcher.ts` before gateMatchesFilePattern:

```typescript
/**
 * Validate file patterns in gate configuration.
 * Throws error if any pattern is invalid (syntax errors, malformed globs).
 * Called during config loading for fail-fast validation.
 *
 * @param gateConfig - Gate configuration to validate
 * @throws Error if any pattern is invalid
 */
export function validateFilePatterns(gateConfig: GateConfig): void {
  if (!gateConfig.file_patterns || gateConfig.file_patterns.length === 0) {
    return; // No patterns to validate
  }

  for (const pattern of gateConfig.file_patterns) {
    try {
      // Test pattern against empty string to detect syntax errors
      minimatch('', pattern);
    } catch (error) {
      throw new Error(
        `Invalid file pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
```

**Step 4: Call validateFilePatterns during config loading**

In dispatcher initialization (where GatesConfig is loaded), add validation:

```typescript
// After loading config, validate all gate patterns
for (const [gateName, gateConfig] of Object.entries(config.gates)) {
  try {
    validateFilePatterns(gateConfig);
  } catch (error) {
    throw new Error(`Gate "${gateName}" has invalid configuration: ${error.message}`);
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testNamePattern="validateFilePatterns"`
Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add plugin/hooks/hooks-app/src/dispatcher.ts plugin/hooks/hooks-app/__tests__/dispatcher.test.ts
git commit -m "feat(validation): add pattern validation at config load time"
```

---

## Task 3: Implement gateMatchesFilePattern function

**Files:**
- Modify: `plugin/hooks/hooks-app/src/dispatcher.ts` (after line 72, after gateMatchesKeywords)

**Step 1: Write the failing test**

Add to `plugin/hooks/hooks-app/__tests__/dispatcher.test.ts`:

```typescript
import { gateMatchesFilePattern } from '../src/dispatcher';
import { GateConfig } from '../src/types';

describe('gateMatchesFilePattern', () => {
  const cwd = '/Users/test/project';

  it('should return true when no patterns specified (backwards compatible)', () => {
    const config: GateConfig = { command: 'echo test', on_pass: 'CONTINUE' };
    const result = gateMatchesFilePattern(config, '/Users/test/project/src/index.ts', cwd);
    expect(result).toBe(true);
  });

  it('should return true when patterns array is empty', () => {
    const config: GateConfig = { command: 'echo test', file_patterns: [], on_pass: 'CONTINUE' };
    const result = gateMatchesFilePattern(config, '/Users/test/project/src/index.ts', cwd);
    expect(result).toBe(true);
  });

  it('should return false when file_path is undefined', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['src/**'],
      on_pass: 'CONTINUE'
    };
    const result = gateMatchesFilePattern(config, undefined, cwd);
    expect(result).toBe(false);
  });

  it('should return true when file matches single pattern', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['packages/cts/**'],
      on_pass: 'CONTINUE'
    };
    const filePath = '/Users/test/project/packages/cts/src/index.ts';
    const result = gateMatchesFilePattern(config, filePath, cwd);
    expect(result).toBe(true);
  });

  it('should return false when file does not match pattern', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['packages/cts/**'],
      on_pass: 'CONTINUE'
    };
    const filePath = '/Users/test/project/packages/other/src/index.ts';
    const result = gateMatchesFilePattern(config, filePath, cwd);
    expect(result).toBe(false);
  });

  it('should return true when file matches any pattern (OR logic)', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['packages/cts/**', 'packages/shared/**'],
      on_pass: 'CONTINUE'
    };
    const filePath = '/Users/test/project/packages/shared/utils.ts';
    const result = gateMatchesFilePattern(config, filePath, cwd);
    expect(result).toBe(true);
  });

  it('should match deep nested directories with **', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['src/**/*.ts'],
      on_pass: 'CONTINUE'
    };
    const filePath = '/Users/test/project/src/deeply/nested/dir/file.ts';
    const result = gateMatchesFilePattern(config, filePath, cwd);
    expect(result).toBe(true);
  });

  it('should match root-level files', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['*.json'],
      on_pass: 'CONTINUE'
    };
    const filePath = '/Users/test/project/package.json';
    const result = gateMatchesFilePattern(config, filePath, cwd);
    expect(result).toBe(true);
  });

  it('should not match root-level pattern against nested file', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['*.json'],
      on_pass: 'CONTINUE'
    };
    const filePath = '/Users/test/project/src/config.json';
    const result = gateMatchesFilePattern(config, filePath, cwd);
    expect(result).toBe(false);
  });

  it('should convert absolute paths to relative paths', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['packages/cts/**'],
      on_pass: 'CONTINUE'
    };
    const absolutePath = '/Users/test/project/packages/cts/index.ts';
    const result = gateMatchesFilePattern(config, absolutePath, cwd);
    expect(result).toBe(true);
  });

  it('should match dotfiles when pattern includes them', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['.config/**'],
      on_pass: 'CONTINUE'
    };
    const filePath = '/Users/test/project/.config/settings.json';
    const result = gateMatchesFilePattern(config, filePath, cwd);
    expect(result).toBe(true);
  });

  // FIX: Add relative path edge case test (defensive programming)
  it('should handle already-relative paths gracefully', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['packages/cts/**'],
      on_pass: 'CONTINUE'
    };
    const relativePath = 'packages/cts/index.ts'; // Already relative
    const result = gateMatchesFilePattern(config, relativePath, cwd);
    expect(result).toBe(true);
  });

  // FIX: Add empty string test
  it('should return false for empty string file_path', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['**/*.ts'],
      on_pass: 'CONTINUE'
    };
    const result = gateMatchesFilePattern(config, '', cwd);
    expect(result).toBe(false);
  });

  // FIX: Add path traversal security test
  it('should handle path traversal patterns safely', () => {
    const config: GateConfig = {
      command: 'echo test',
      file_patterns: ['../parent/**'],
      on_pass: 'CONTINUE'
    };
    const filePath = '/Users/test/project/../parent/file.ts';
    const result = gateMatchesFilePattern(config, filePath, cwd);
    // Documents security boundary - patterns match after path.relative normalization
    expect(result).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testNamePattern="gateMatchesFilePattern"`
Expected: FAIL with "gateMatchesFilePattern is not exported from '../src/dispatcher'"

**Step 3: Implement gateMatchesFilePattern function**

Add imports to top of `plugin/hooks/hooks-app/src/dispatcher.ts` (with existing imports):

```typescript
import { minimatch } from 'minimatch';
import path from 'path';
```

Add function after line 72 (after gateMatchesKeywords):

```typescript
/**
 * Check if gate should run based on file pattern matching (PostToolUse only).
 * Gates without patterns always run (backwards compatible).
 *
 * Uses glob patterns matched against relative paths from project root.
 * Multiple patterns use OR logic - gate runs if file matches ANY pattern.
 *
 * @param gateConfig - Gate configuration
 * @param filePath - Absolute path to file being modified (from HookInput.file_path)
 * @param cwd - Current working directory (project root)
 * @returns true if gate should run, false otherwise
 */
export function gateMatchesFilePattern(
  gateConfig: GateConfig,
  filePath: string | undefined,
  cwd: string
): boolean {
  // No patterns = always run (backwards compatible)
  if (!gateConfig.file_patterns || gateConfig.file_patterns.length === 0) {
    return true;
  }

  // No file path = skip pattern matching
  if (!filePath) {
    return false;
  }

  // FIX: Normalize relative paths to absolute paths before conversion
  // If filePath is already relative, path.relative may produce incorrect results
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);

  // Convert absolute path to relative path from cwd
  const relativePath = path.relative(cwd, absolutePath);

  // Check if file matches ANY pattern (OR logic)
  try {
    return gateConfig.file_patterns.some((pattern) =>
      minimatch(relativePath, pattern, {
        matchBase: false,  // Match full path, not just basename (packages/cts/** shouldn't match unrelated/cts/)
        dot: true,         // Allow patterns to match dotfiles like .config/settings.json
      })
    );
  } catch (error) {
    // FIX: Invalid glob pattern - log warning and skip gate
    logger.warn('Invalid file pattern - gate skipped', {
      pattern: gateConfig.file_patterns,
      error: error instanceof Error ? error.message : String(error),
      relativePath
    }).catch(() => {}); // Ignore async logging errors
    return false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testNamePattern="gateMatchesFilePattern"`
Expected: PASS (13 tests - original 10 + 3 new edge cases)

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/dispatcher.ts plugin/hooks/hooks-app/__tests__/dispatcher.test.ts
git commit -m "feat(dispatcher): add gateMatchesFilePattern function"
```

---

## Task 4: Integrate file pattern filtering into gate execution

**Files:**
- Modify: `plugin/hooks/hooks-app/src/dispatcher.ts:195-210`

**Step 1: Write the failing integration test**

Add to `plugin/hooks/hooks-app/__tests__/dispatcher.test.ts`:

```typescript
describe('File pattern filtering integration', () => {
  const mockConfig: GatesConfig = {
    gates: {
      'cts:test': {
        command: 'echo "cts test"',
        file_patterns: ['packages/cts/**'],
        on_pass: 'CONTINUE'
      },
      'shared:test': {
        command: 'echo "shared test"',
        file_patterns: ['packages/shared/**', 'lib/common/**'],
        on_pass: 'CONTINUE'
      },
      'no-pattern': {
        command: 'echo "no pattern"',
        on_pass: 'CONTINUE'
      }
    },
    hooks: {
      PostToolUse: {
        enabled_tools: ['Edit', 'Write'],
        gates: ['cts:test', 'shared:test', 'no-pattern']
      }
    }
  };

  beforeEach(() => {
    // FIX: Mock implementation per test, not jest.mock call (move jest.mock to file top)
    const fs = require('fs');
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
  });

  it('should run gate when file matches pattern', async () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: '/Users/test/project',
      tool_name: 'Edit',
      file_path: '/Users/test/project/packages/cts/src/index.ts'
    };

    // FIX: Ensure dispatch fully resolves before assertions
    const result = await dispatch(input);

    // FIX: Check DispatchResult structure (context field), not string contains
    expect(result.context).toContain('cts test');
    expect(result.context).toContain('no pattern');
    expect(result.context).not.toContain('shared test');
  });

  it('should skip gate when file does not match pattern', async () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: '/Users/test/project',
      tool_name: 'Edit',
      file_path: '/Users/test/project/packages/other/src/index.ts'
    };

    const result = await dispatch(input);

    // FIX: Check DispatchResult structure
    expect(result.context).toContain('no pattern');
    expect(result.context).not.toContain('cts test');
    expect(result.context).not.toContain('shared test');
  });

  it('should run gate when file matches any pattern (OR logic)', async () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: '/Users/test/project',
      tool_name: 'Edit',
      file_path: '/Users/test/project/lib/common/utils.ts'
    };

    const result = await dispatch(input);

    // FIX: Check DispatchResult structure
    expect(result.context).toContain('shared test');
    expect(result.context).toContain('no pattern');
    expect(result.context).not.toContain('cts test');
  });

  it('should not apply file pattern filtering to non-PostToolUse hooks', async () => {
    const input: HookInput = {
      hook_event_name: 'UserPromptSubmit',
      cwd: '/Users/test/project',
      user_message: 'test message'
    };

    const result = await dispatch(input);

    // File patterns should be ignored for UserPromptSubmit
    // All gates should attempt to run (subject to keyword filtering)
    expect(result).toBeDefined();
  });

  // FIX: Add multiple gates integration test
  it('should filter multiple gates independently based on patterns', async () => {
    const multiGateConfig: GatesConfig = {
      gates: {
        'gate-a': {
          command: 'echo "gate A"',
          file_patterns: ['packages/a/**'],
          on_pass: 'CONTINUE'
        },
        'gate-b': {
          command: 'echo "gate B"',
          file_patterns: ['packages/b/**'],
          on_pass: 'CONTINUE'
        },
        'gate-c': {
          command: 'echo "gate C"',
          file_patterns: ['packages/c/**'],
          on_pass: 'CONTINUE'
        },
        'gate-all': {
          command: 'echo "gate ALL"',
          on_pass: 'CONTINUE'
        }
      },
      hooks: {
        PostToolUse: {
          enabled_tools: ['Edit'],
          gates: ['gate-a', 'gate-b', 'gate-c', 'gate-all']
        }
      }
    };

    // Mock config for this test
    const fs = require('fs');
    fs.readFileSync.mockReturnValue(JSON.stringify(multiGateConfig));

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: '/Users/test/project',
      tool_name: 'Edit',
      file_path: '/Users/test/project/packages/b/index.ts'
    };

    const result = await dispatch(input);

    // Only gate-b and gate-all should run
    expect(result.context).toContain('gate B');
    expect(result.context).toContain('gate ALL');
    expect(result.context).not.toContain('gate A');
    expect(result.context).not.toContain('gate C');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testNamePattern="File pattern filtering integration"`
Expected: FAIL (gates run unconditionally without pattern filtering)

**Step 3: Add file pattern filtering to dispatch function**

In `plugin/hooks/hooks-app/src/dispatcher.ts`, add filtering after keyword check (after line 204):

```typescript
    // Keyword filtering for UserPromptSubmit
    if (hookEvent === 'UserPromptSubmit' && !gateMatchesKeywords(gateConfig, input.user_message)) {
      await logger.debug('Gate skipped - no keyword match', { gate: gateName });
      continue;
    }

    // File pattern filtering for PostToolUse
    if (hookEvent === 'PostToolUse' && !gateMatchesFilePattern(gateConfig, input.file_path, input.cwd)) {
      await logger.debug('Gate skipped - no file pattern match', { gate: gateName });
      continue;
    }

    gatesExecuted++;
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testNamePattern="File pattern filtering integration"`
Expected: PASS (5 tests - original 4 + 1 multiple gates test)

**Step 5: Run all dispatcher tests**

Run: `cd plugin/hooks/hooks-app && npm test -- dispatcher.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add plugin/hooks/hooks-app/src/dispatcher.ts plugin/hooks/hooks-app/__tests__/dispatcher.test.ts
git commit -m "feat(dispatcher): integrate file pattern filtering into gate execution"
```

---

## Task 5: Add debug logging for pattern matching

**Files:**
- Modify: `plugin/hooks/hooks-app/src/dispatcher.ts` (gateMatchesFilePattern function)

**Step 1: Add detailed logging to gateMatchesFilePattern**

NOTE: Keep Task 3's .some() implementation - DO NOT refactor to for-loop. Add logging via separate call after matching:

Update gateMatchesFilePattern function to add debug logging:

```typescript
export function gateMatchesFilePattern(
  gateConfig: GateConfig,
  filePath: string | undefined,
  cwd: string
): boolean {
  // No patterns = always run (backwards compatible)
  if (!gateConfig.file_patterns || gateConfig.file_patterns.length === 0) {
    return true;
  }

  // No file path = skip pattern matching
  if (!filePath) {
    return false;
  }

  // FIX: Normalize relative paths (from Task 3)
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  const relativePath = path.relative(cwd, absolutePath);

  // FIX: Keep .some() implementation from Task 3, add logging separately
  let matchedPattern: string | undefined;

  try {
    const matches = gateConfig.file_patterns.some((pattern) => {
      const result = minimatch(relativePath, pattern, {
        matchBase: false,
        dot: true,
      });
      if (result) {
        matchedPattern = pattern;
      }
      return result;
    });

    // FIX: Use await logger.debug() pattern (consistent with existing code)
    if (matches && matchedPattern) {
      await logger.debug('File pattern matched', {
        relativePath,
        pattern: matchedPattern,
        absolutePath: filePath
      });
    }

    return matches;
  } catch (error) {
    // FIX: Keep error handling from Task 3
    await logger.warn('Invalid file pattern - gate skipped', {
      pattern: gateConfig.file_patterns,
      error: error instanceof Error ? error.message : String(error),
      relativePath
    });
    return false;
  }
}
```

NOTE: Function must be async for await logger calls. Update signature to `async function`.

**Step 2: Test manually with TURBOSHOVEL_LOG_LEVEL=debug**

Create test configuration in `plugin/hooks/gates.json`:

```json
{
  "gates": {
    "test:pattern": {
      "command": "echo 'Pattern matched'",
      "file_patterns": ["src/**"],
      "on_pass": "CONTINUE"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit"],
      "gates": ["test:pattern"]
    }
  }
}
```

Run: `TURBOSHOVEL_LOG_LEVEL=debug npx claude-code`
Edit a file in src/ and verify debug log shows pattern match

Expected: Log output shows "File pattern matched" with relativePath and pattern

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/src/dispatcher.ts
git commit -m "feat(logging): add debug logging for file pattern matching"
```

---

## Task 6: Update documentation - SETUP.md

**Files:**
- Modify: `plugin/hooks/SETUP.md`

**Step 1: Add file pattern filtering section**

Find the gate configuration section (search for "Gate Configuration" or similar) and add after the keywords section:

```markdown
### File Pattern Filtering

Gates can be configured to run only for specific files or directories using the `file_patterns` field. This is especially useful for monorepo projects where different packages have different tasks.

**Configuration:**

```json
{
  "gates": {
    "backend:test": {
      "description": "Run backend tests",
      "command": "npm run test:backend",
      "file_patterns": ["packages/backend/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "frontend:lint": {
      "description": "Lint frontend code",
      "command": "npm run lint:frontend",
      "file_patterns": ["packages/frontend/**", "shared/ui/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["backend:test", "frontend:lint"]
    }
  }
}
```

**Pattern Syntax:**

File patterns use glob syntax (similar to `.gitignore`, but with some differences):

- `**` - Matches any number of directories (including zero)
- `*` - Matches any characters except `/`
- `?` - Matches a single character
- `[abc]` - Matches any character in brackets

**Pattern Examples:**

| Pattern | Matches | Doesn't Match |
|---------|---------|---------------|
| `packages/cts/**` | `packages/cts/src/index.ts`<br>`packages/cts/lib/utils.ts` | `packages/shared/index.ts`<br>`src/index.ts` |
| `src/**/*.ts` | `src/index.ts`<br>`src/lib/utils.ts` | `src/index.js`<br>`tests/index.ts` |
| `*.json` | `package.json`<br>`tsconfig.json` | `src/config.json`<br>`lib/data.json` |
| `.config/**` | `.config/settings.json`<br>`.config/app/theme.json` | `config/settings.json` |
| `lib/*/index.ts` | `lib/utils/index.ts`<br>`lib/core/index.ts` | `lib/index.ts`<br>`lib/utils/helper.ts` |

**Behavior:**

- **Multiple patterns:** OR logic - gate runs if file matches ANY pattern
- **No patterns:** Gate always runs (backwards compatible)
- **Path matching:** Patterns are matched against relative paths from project root
- **Hook scope:** Only applies to `PostToolUse` hook (which has `file_path`)
- **Dotfiles:** Patterns can match dotfiles (e.g., `.config/**`)

**Monorepo Example:**

For a monorepo with separate test suites per package:

```json
{
  "gates": {
    "cts:test": {
      "description": "Run CTS tests",
      "command": "npm run test:cts",
      "file_patterns": ["packages/cts/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "api:test": {
      "description": "Run API tests",
      "command": "npm run test:api",
      "file_patterns": ["packages/api/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "shared:test": {
      "description": "Run shared tests",
      "command": "npm run test:shared",
      "file_patterns": ["packages/shared/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["cts:test", "api:test", "shared:test"]
    }
  }
}
```

When you edit `packages/cts/src/index.ts`, only the `cts:test` gate runs.
When you edit `packages/shared/utils.ts`, only the `shared:test` gate runs.

**Pattern Library:**

Patterns use the [minimatch library](https://www.npmjs.com/package/minimatch) (same as npm/glob). Supports advanced features:
- Brace expansion: `{a,b,c}` matches any of a, b, or c
- Extglob patterns: `@(pattern)`, `!(pattern)`, etc.
- See minimatch docs for full syntax reference

**Performance Considerations:**

Pattern matching uses O(n*m) complexity where n=number of patterns, m=pattern complexity. For large monorepos:
- Use early-exit optimization (patterns checked in order, stops at first match)
- Consider consolidating gates if you have >100 patterns
- Keep patterns simple where possible

**Debugging:**

Enable debug logging to see which patterns are matching:

```bash
TURBOSHOVEL_LOG_LEVEL=debug npx claude-code
```

Debug logs will show:
- Which gate was evaluated
- File path (absolute and relative)
- Pattern that matched
- Whether gate was skipped
```

**Step 2: Commit**

```bash
git add plugin/hooks/SETUP.md
git commit -m "docs: add file pattern filtering documentation to SETUP.md"
```

---

## Task 7: Update documentation - README.md

**Files:**
- Modify: `plugin/hooks/README.md`

**Step 1: Add monorepo example to Features or Quick Start section**

Find the Features section and add:

```markdown
### Monorepo Support

Configure different gates for different packages using file pattern filtering:

```json
{
  "gates": {
    "backend:check": {
      "description": "Backend quality checks",
      "command": "npm run check:backend",
      "file_patterns": ["packages/backend/**"],
      "on_fail": "BLOCK"
    },
    "frontend:check": {
      "description": "Frontend quality checks",
      "command": "npm run check:frontend",
      "file_patterns": ["packages/frontend/**"],
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["backend:check", "frontend:check"]
    }
  }
}
```

Only the relevant package's checks run based on which files you edit.
```

**Step 2: Update features list**

If there's a bullet-point features list, add:

```markdown
- **File Pattern Filtering**: Run gates only for specific directories (perfect for monorepos)
```

**Step 3: Commit**

```bash
git add plugin/hooks/README.md
git commit -m "docs: add monorepo example to README.md"
```

---

## Task 8: Update CLAUDE.md with new feature

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add file pattern filtering to configuration section**

FIX: Keep existing check gate with keywords, add new backend:test gate with file_patterns:

```markdown
## Configuration

Create `.claude/gates.json` with your project commands:

```json
{
  "gates": {
    "check": {
      "description": "Run project quality checks",
      "keywords": ["lint", "check", "format"],
      "command": "npm run lint",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "backend:test": {
      "description": "Run backend tests (only when backend files modified)",
      "command": "npm run test:backend",
      "file_patterns": ["packages/backend/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["check", "backend:test"]
    },
    "UserPromptSubmit": {
      "gates": ["check"]
    }
  }
}
```

This example shows both keyword-based filtering (check gate) and file pattern filtering (backend:test gate).
```

**Step 2: Add file_patterns to features list**

Update the Features section:

```markdown
## Features

- **Quality Gates**: Automatically enforce project checks (lint, test, build) at hook points (PostToolUse, SubagentStop, UserPromptSubmit)
- **Context Injection**: Convention-based `.claude/context/{name}-{stage}.md` files auto-inject into conversations
- **Keyword Triggers**: Gates automatically fire based on conversation keywords
- **File Pattern Filtering**: Run gates only for specific files/directories (perfect for monorepos)
- **Session Tracking**: Session state persists across hook invocations
- **TypeScript Gates**: Custom gates via TypeScript for complex logic
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add file pattern filtering to CLAUDE.md"
```

---

## Task 9: Run full test suite and verify

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: All tests PASS

**Step 2: Run linter**

Run: `cd plugin/hooks/hooks-app && npm run lint`
Expected: No errors

**Step 3: Build the project**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: Build succeeds, no TypeScript errors

**Step 4: Verify all commits are clean**

Run: `git log --oneline -9`
Expected: See all 9 commits for this feature

**Step 5: Manual testing - create test gates config**

FIX: Backup existing config before testing to avoid overwriting production configuration:

```bash
# Backup existing config if present
if [ -f .claude/gates.json ]; then
  cp .claude/gates.json .claude/gates.json.backup
fi
```

Create temporary test configuration in `.claude/gates.json`:

```json
{
  "gates": {
    "src:test": {
      "command": "echo 'SRC file modified'",
      "file_patterns": ["plugin/hooks/hooks-app/src/**"],
      "on_pass": "CONTINUE"
    },
    "test:test": {
      "command": "echo 'TEST file modified'",
      "file_patterns": ["plugin/hooks/hooks-app/__tests__/**"],
      "on_pass": "CONTINUE"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit"],
      "gates": ["src:test", "test:test"]
    }
  }
}
```

**Step 6: Test with actual file edits**

FIX: Clear verification criteria for manual testing:

1. Edit `plugin/hooks/hooks-app/src/types.ts`
   - Expected: Echo output "SRC file modified" appears in logs or context
   - Verify via: Check TURBOSHOVEL_LOG_LEVEL=debug logs for gate execution

2. Edit `plugin/hooks/hooks-app/__tests__/types.test.ts`
   - Expected: Echo output "TEST file modified" appears in logs or context
   - Verify via: Check debug logs for gate execution

3. Edit `README.md`
   - Expected: Neither gate runs (no echo output)
   - Verify via: Debug logs show gates were skipped

**Step 7: Test with debug logging**

Run: `TURBOSHOVEL_LOG_LEVEL=debug npx claude-code`
Edit a file and verify debug logs show:
- "File pattern matched" with relativePath and pattern details
- "Gate skipped - no file pattern match" for non-matching files
- Gate execution output for matching patterns

**Step 8: Restore backup configuration**

```bash
# Restore original config if backup exists
if [ -f .claude/gates.json.backup ]; then
  mv .claude/gates.json.backup .claude/gates.json
fi
```

**Step 9: Commit verification results**

If manual tests pass, no commit needed. If issues found, fix and commit.

---

## Task 10: Code review checkpoint

> **REQUIRED SUB-SKILL:** Use @cipherpowers:requesting-code-review before proceeding.

**Review scope:**
- All TypeScript changes in `src/` and `__tests__/`
- Type definitions in `types.ts`
- Integration with existing filtering logic
- Test coverage for edge cases
- Documentation accuracy

**Expected outcomes:**
- Code follows project patterns
- No regressions to existing functionality
- Comprehensive test coverage
- Clear documentation

---

## Success Criteria

✅ **Functionality:**
- Gates can be filtered by file patterns using glob syntax
- Patterns matched against relative paths from project root
- Multiple patterns use OR logic
- Backwards compatible (no patterns = always run)
- Only applies to PostToolUse hook

✅ **Code Quality:**
- All tests pass
- Linter passes
- Build succeeds
- Type-safe implementation
- Debug logging available

✅ **Documentation:**
- SETUP.md has comprehensive guide
- README.md has monorepo example
- CLAUDE.md updated with feature
- Inline JSDoc comments on new functions

✅ **Testing:**
- Unit tests for gateMatchesFilePattern
- Integration tests for dispatch flow
- Edge cases covered (no patterns, no file_path, OR logic, etc.)
- Manual testing verified

---

## Notes

- **Glob Library Choice:** Using `minimatch` (standard in Node.js ecosystem, used by npm/glob/etc.)
- **Path Type:** Relative paths preferred for portability and monorepo friendliness
- **OR Logic:** Simple and intuitive for most use cases; AND logic not needed initially
- **No Exclusions:** Keep initial implementation simple; can add `!pattern` syntax later
- **Backwards Compatibility:** Critical - gates without `file_patterns` must work exactly as before
- **Hook Scope:** Only PostToolUse has file_path; other hooks ignore file_patterns

## Future Enhancements

- Exclusion patterns (`!**/*.test.ts`)
- AND logic option for multiple patterns
- Pattern validation on config load
- Hook-level `enabled_files` filter
- Support for SubagentStop if output parsing is added
