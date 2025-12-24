# Fix Hook Input Validation - Error Message Format

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix error message format for invalid JSON and update test to expect correct behavior for missing required fields.

**Architecture:** The current strict validation is correct - missing required fields IS an error. Only the error message format and one test expectation need fixing.

**Tech Stack:** TypeScript, Jest

---

## Task 1: Fix Invalid JSON Error Message Format

**Files:**
- Modify: `plugin/hooks/hooks-app/src/schemas.ts:55-59`
- Test: `plugin/hooks/hooks-app/__tests__/cli.integration.test.ts:218`

**Step 1: Update error message in parseHookInput**

In `src/schemas.ts`, change line 58:

```typescript
// From:
error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,

// To:
error: `Invalid JSON input: ${e instanceof Error ? e.message : String(e)}`,
```

**Step 2: Run the integration test**

Run: `cd plugin/hooks/hooks-app && npm run build && npm test -- --testPathPattern="cli.integration" -t "invalid JSON"`
Expected: PASS - test expects "Invalid JSON input" which we now output

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/src/schemas.ts
git commit -m "fix(schemas): use 'Invalid JSON input' message format for parse errors"
```

---

## Task 2: Update Missing Fields Test to Expect Error

**Files:**
- Modify: `plugin/hooks/hooks-app/__tests__/cli.integration.test.ts:187-204`

**Step 1: Update test expectation**

Change the test from expecting graceful exit to expecting error:

```typescript
// From:
test('should handle graceful exit on missing required fields', (done) => {
  const proc = spawn('node', ['dist/cli.js'], {
    cwd: path.resolve(__dirname, '..')
  });

  const input = JSON.stringify({
    // Missing hook_event_name and cwd
    tool_name: 'Edit'
  });

  proc.on('close', (code) => {
    expect(code).toBe(0); // Graceful exit
    done();
  });

  proc.stdin.write(input);
  proc.stdin.end();
});

// To:
test('should reject input missing required fields', (done) => {
  const proc = spawn('node', ['dist/cli.js'], {
    cwd: path.resolve(__dirname, '..')
  });

  let stderr = '';
  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  const input = JSON.stringify({
    // Missing hook_event_name and cwd - this is a schema violation
    tool_name: 'Edit'
  });

  proc.on('close', (code) => {
    expect(code).toBe(1); // Schema violation is an error
    expect(stderr).toContain('Invalid input');
    done();
  });

  proc.stdin.write(input);
  proc.stdin.end();
});
```

**Step 2: Run the updated test**

Run: `cd plugin/hooks/hooks-app && npm run build && npm test -- --testPathPattern="cli.integration" -t "missing required"`
Expected: PASS

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/__tests__/cli.integration.test.ts
git commit -m "fix(test): expect error on missing required fields (schema violation)"
```

---

## Task 3: Remove Redundant Required Field Check in CLI

**Files:**
- Modify: `plugin/hooks/hooks-app/src/cli.ts:220-227`

**Step 1: Remove the dead code**

The check at lines 220-227 is now unreachable because `parseHookInput` validates required fields via Zod schema. Remove:

```typescript
// DELETE these lines (220-227):
    // Validate required fields
    if (!input.hook_event_name || !input.cwd) {
      await logger.warn('CLI missing required fields, exiting', {
        has_event: !!input.hook_event_name,
        has_cwd: !!input.cwd
      });
      return;
    }
```

**Step 2: Run build**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: PASS

**Step 3: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/src/cli.ts
git commit -m "refactor(cli): remove redundant required field check (handled by schema)"
```

---

## Task 4: Final Verification

**Step 1: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: All tests PASS

**Step 2: Run TypeScript compiler**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: No errors

**Step 3: Run linter**

Run: `cd plugin/hooks/hooks-app && npm run lint`
Expected: No new errors

---
