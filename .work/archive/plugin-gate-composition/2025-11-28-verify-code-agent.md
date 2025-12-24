# Technical Feasibility Review - 2025-11-28

## Metadata
- **Reviewer:** code-agent
- **Date:** 2025-11-28
- **Subject:** Plugin Gate Composition Implementation Plan
- **Ground Truth:** Actual codebase implementation
- **Context:** Independent review #2 for dual-verification
- **Mode:** Review

## Summary
- **Subject:** Technical feasibility of implementation plan
- **Scope:** Verification of file paths, line numbers, existing code, integration points

---

## Status: BLOCKED

## BLOCKING (Must Address)

### BLOCKING-1: DispatchResult Interface Mismatch in Integration Test

**Description:** The plan's Task 6 integration test expects fields that don't exist in `DispatchResult`.

**Location:** Task 6, lines 652-667 of plan

**Evidence from codebase:**
```typescript
// Actual DispatchResult interface (dispatcher.ts:32-36):
export interface DispatchResult {
  context?: string;
  blockReason?: string;
  stopMessage?: string;
}

// Plan's test expectations (lines 662-664):
expect(result.continue).not.toBe(false);
expect(result.decision).toBeUndefined();
expect(result.additionalContext).toContain('plan-compliance check passed');
```

**What's wrong:**
1. `DispatchResult` has NO `continue` field
2. `DispatchResult` has NO `decision` field
3. `DispatchResult` uses `context` not `additionalContext`

**Impact:** Integration test will fail to compile due to TypeScript errors. Tests cannot run.

**Correct assertions should be:**
```typescript
// Check for success (no block or stop)
expect(result.blockReason).toBeUndefined();
expect(result.stopMessage).toBeUndefined();

// Check output
expect(result.context).toContain('plan-compliance check passed');
expect(result.context).toContain('project check passed');
```

**Action Required:**
- Update Task 6 test expectations to match actual `DispatchResult` interface
- Change `result.continue` checks to `result.blockReason === undefined`
- Change `result.decision` checks to `result.blockReason` presence checks
- Change `result.additionalContext` to `result.context`
- Apply same fixes to the BLOCK test (lines 670-696)

### BLOCKING-2: Missing `os` Import in Task 4 Test

**Description:** Task 4 test uses `os.tmpdir()` but doesn't import `os` module.

**Location:** Task 4, line 332 of plan

**Evidence:**
```typescript
// Plan's test (line 332):
mockPluginDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mock-plugins-'));

// But import section (lines 322-324) is missing:
import * as os from 'os';
```

**Existing pattern from codebase:**
```typescript
// config.test.ts:2-5
import { loadConfig } from '../src/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';  // ✓ Correct pattern
```

**Impact:** Test will fail with "ReferenceError: os is not defined"

**Action Required:** Add `import * as os from 'os';` to imports in Task 4 test (after line 324)

### BLOCKING-3: Missing `path` Import in gate-loader.ts Implementation

**Description:** Task 4 implementation uses `path.resolve()` and `path.join()` but doesn't import `path` module in new code.

**Location:** Task 4, Step 3, lines 276-294 of plan

**Evidence:**
```typescript
// Plan's implementation (line 293):
return path.resolve(pluginRoot, '..', pluginName);

// But existing gate-loader.ts (line 4) only has:
import * as path from 'path';
```

**Current issue:** The existing file DOES import path (line 4), so this would work. However, the new `loadPluginGate` function (lines 408-426) also needs path for `path.join()` calls, which is already imported.

**Re-evaluation:** Actually NOT blocking - `path` is already imported at line 4 of gate-loader.ts. The plan's new code will work.

**Status:** FALSE ALARM - path is already imported. Removing from blocking.

---

## SUGGESTIONS (Would Improve Quality)

### SUGGESTION-1: Line Number References May Be Inaccurate

**Description:** Plan references specific line numbers but actual code may differ.

**Locations:**
- Task 1: "types.ts:39-50" for GateConfig
- Task 2: "config.ts:28-59" for validation
- Task 5: "gate-loader.ts:86-112" for executeGate

**Current reality:**
- `types.ts` - GateConfig is at lines 39-50 ✓ Accurate
- `config.ts` - validateConfig starts at line 29 (not 28), ends at line 60 (not 59) - Close enough
- `gate-loader.ts` - executeGate is at lines 87-113 (not 86-112) - Off by 1

**Benefit:** Line number precision helps implementers locate code quickly, but being off by 1-2 lines is minor.

**Action:** Acceptable as-is. Implementers can search by function name if needed.

### SUGGESTION-2: Test File Creation Should Follow Existing Pattern

**Description:** Task 4 and Task 6 create new test files. Should verify they match existing Jest patterns.

**Location:** Task 4 (gate-loader.test.ts additions), Task 6 (new integration test file)

**Existing pattern verification:**
- ✓ Imports use `import * as` syntax (matches existing)
- ✓ Uses `describe()` and `test()` (matches existing)
- ✓ Uses `beforeEach/afterEach` for setup/teardown (matches existing)
- ✓ Uses async/await throughout (matches existing)

**Benefit:** Consistency with existing test patterns

**Action:** Patterns look correct. No changes needed.

### SUGGESTION-3: loadConfigFile Export Requires Verification

**Description:** Task 4 Step 4 changes `loadConfigFile` from private to exported function.

**Location:** Task 4, Step 4, lines 429-439

**Current code (config.ts:86):**
```typescript
async function loadConfigFile(configPath: string): Promise<GatesConfig | null> {
```

**Plan's change:**
```typescript
export async function loadConfigFile(configPath: string): Promise<GatesConfig | null> {
```

**Potential issue:** This function is internal implementation detail. Exporting it creates public API surface that may not be intended.

**Benefit of fixing:**
- Option 1: Keep export minimal, inline the loading logic in `loadPluginGate`
- Option 2: Accept the export but document it's for plugin gate loading only

**Action:** Either approach is technically feasible. Current plan (export) works but creates more public API. Consider inline loading instead:

```typescript
// Alternative: Don't export loadConfigFile
const gatesContent = await fs.readFile(gatesPath, 'utf-8');
const pluginConfig = JSON.parse(gatesContent);
```

This avoids exposing internal function. However, plan's approach (export) also works fine.

### SUGGESTION-4: Integration Test Timeout Considerations

**Description:** Integration tests may need longer timeouts for shell command execution.

**Location:** Task 6, entire integration test

**Consideration:** Tests execute shell commands (`echo "plan-compliance check passed"`). Jest default timeout is 5 seconds, which should be sufficient for echo commands.

**Existing pattern:** gate-loader.test.ts (line 36) uses 100ms timeout for sleep test, showing timeout awareness.

**Benefit:** Prevents flaky tests on slow CI systems

**Action:** Current test should work with defaults, but if it times out, add:
```typescript
test('executes plugin gate followed by project gate', async () => {
  // test body
}, 10000); // 10 second timeout
```

### SUGGESTION-5: Missing Error Case Test for Plugin Without gates.json

**Description:** Task 4 tests error cases but could be more comprehensive.

**Location:** Task 4, test suite (lines 369-379)

**Current tests:**
- ✓ Plugin gates.json not found
- ✓ Gate not found in plugin

**Missing test case:**
- Plugin exists but `hooks/` directory doesn't exist
- Plugin exists but gates.json is invalid JSON

**Benefit:** More robust error handling verification

**Action:** Consider adding (non-blocking):
```typescript
test('throws when plugin gates.json is invalid JSON', async () => {
  const cipherpowersHooksDir = path.join(mockPluginDir, 'cipherpowers', 'hooks');
  await fs.mkdir(cipherpowersHooksDir, { recursive: true });
  await fs.writeFile(path.join(cipherpowersHooksDir, 'gates.json'), '{invalid}');

  await expect(loadPluginGate('cipherpowers', 'any-gate')).rejects.toThrow();
});
```

### SUGGESTION-6: Plugin Gate Command Working Directory Needs Clarity

**Description:** Task 5 implementation shows plugin commands run in plugin directory, but this behavior should be explicitly tested.

**Location:** Task 5, Step 3, lines 509-511

**Plan states:**
```typescript
// Execute the plugin's gate command in the plugin's directory
if (pluginGateConfig.command) {
  const shellResult = await executeShellCommand(pluginGateConfig.command, pluginRoot);
```

**Issue:** The integration test (Task 6) uses `echo` commands which don't verify working directory. A more thorough test would verify the command actually runs in plugin directory:

**Suggested additional test:**
```typescript
test('plugin gate command executes in plugin directory', async () => {
  // Update cipherpowers gate to print working directory
  const cipherpowersHooksDir = path.join(mockPluginsDir, 'cipherpowers', 'hooks');
  await fs.writeFile(
    path.join(cipherpowersHooksDir, 'gates.json'),
    JSON.stringify({
      hooks: {},
      gates: {
        'pwd-check': {
          command: 'pwd',
          on_fail: 'CONTINUE'
        }
      }
    })
  );

  const gateConfig: GateConfig = {
    plugin: 'cipherpowers',
    gate: 'pwd-check'
  };

  const result = await executeGate('test', gateConfig, mockInput);

  // Verify command ran in plugin directory, not project directory
  expect(result.result.additionalContext).toContain('cipherpowers');
});
```

**Benefit:** Explicitly verifies the working directory isolation behavior

**Action:** Optional enhancement, not blocking

---

## File Existence Verification

### Files to be Modified (All Exist ✓)

1. ✓ `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/types.ts` - EXISTS
2. ✓ `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/config.ts` - EXISTS
3. ✓ `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/gate-loader.ts` - EXISTS
4. ✓ `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/types.test.ts` - EXISTS
5. ✓ `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/config.test.ts` - EXISTS
6. ✓ `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/gate-loader.test.ts` - EXISTS

### Files to be Created (Paths Valid ✓)

1. ✓ `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/plugin-gates.integration.test.ts` - Parent directory exists

### Documentation Files (All Exist ✓)

1. ✓ `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` - EXISTS
2. ✓ `/Users/tobyhede/psrc/turboshovel/plugin/hooks/SETUP.md` - EXISTS

---

## Code Integration Verification

### Type Compatibility ✓

**GateConfig extension:**
- Current interface (lines 39-50) supports optional fields
- Adding `plugin?` and `gate?` is backward compatible
- Existing code using `command?` continues to work

**Import/Export Analysis:**
- `executeGate` is already exported (line 87 of gate-loader.ts)
- `loadConfig` is already exported (line 122 of config.ts)
- `dispatch` is already exported (line 132 of dispatcher.ts)
- All necessary functions are accessible ✓

### Test Infrastructure ✓

**Jest configuration:**
- `package.json` has Jest setup (line 9: `"test": "jest"`)
- Existing tests use same patterns as proposed tests
- TypeScript compilation works (`npm run build` succeeds)

### Build Commands ✓

**Verified working:**
- `cd plugin/hooks/hooks-app && npm test` - Valid command
- `cd plugin/hooks/hooks-app && npm run build` - Valid command
- `cd plugin/hooks/hooks-app && npm run lint` - Valid command

All commands specified in plan exist in package.json.

---

## Architecture Fit Analysis

### Plugin Gate Composition Design ✓

**Matches existing patterns:**
1. Gate execution via `executeGate()` - ✓ Follows existing pattern
2. Config loading via `loadConfig()` - ✓ Consistent with merge pattern
3. Shell command execution via `executeShellCommand()` - ✓ Reuses existing infrastructure
4. Action handling via `handleAction()` - ✓ Integrates with existing action system

**Plugin discovery via CLAUDE_PLUGIN_ROOT:**
- Existing code already uses `CLAUDE_PLUGIN_ROOT` (config.ts:67)
- Sibling plugin convention is reasonable
- `path.resolve(pluginRoot, '..', pluginName)` is idiomatic Node.js

### Validation Approach ✓

**validateGateConfig function:**
- Follows existing pattern in `validateConfig` (config.ts:29-60)
- Consistent error message format
- Throws descriptive errors early (good practice)

**Integration with existing validation:**
- Plan correctly inserts call into existing loop (line 203-204)
- Validates structure before action validation (correct order)

---

## Assessment

### Conclusion

**The implementation plan is BLOCKED** due to critical interface mismatches in the integration test (BLOCKING-1) and a missing import (BLOCKING-2).

**Once these blocking issues are fixed, the plan is technically sound:**

1. ✓ All referenced files exist at correct paths
2. ✓ Function signatures are compatible
3. ✓ Type system integrations work correctly
4. ✓ Existing infrastructure supports the new features
5. ✓ Test patterns match existing codebase conventions
6. ✓ Build and test commands are accurate
7. ⚠️ Integration test has wrong interface expectations (BLOCKING-1)
8. ⚠️ Missing import in Task 4 test (BLOCKING-2)

**Technical feasibility: HIGH** - The design is sound and fits the architecture well. The blocking issues are purely about test code correctness, not fundamental design flaws.

### Confidence in Findings

**High confidence** in blocking issues:
- BLOCKING-1: Verified by direct inspection of DispatchResult interface (dispatcher.ts:32-36)
- BLOCKING-2: Verified by checking imports in plan vs. existing test patterns

**Medium confidence** in suggestions:
- Line numbers may drift with minor edits (acceptable)
- Test coverage suggestions are enhancements, not blockers
- Working directory test is nice-to-have, not required

**Areas not fully verified:**
- Runtime behavior of plugin loading (would need to execute code)
- CLAUDE_PLUGIN_ROOT environment variable handling in Claude Code (assumes documentation is accurate)
- Cross-platform path handling (plan assumes Unix-like paths, but Node.js `path` module handles this)

**Overall assessment confidence: 90%** - The blocking issues are definitive. Suggestions are lower confidence because they're subjective quality improvements.
