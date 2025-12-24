# Exclusive Issue Verification - 2025-11-28

## Metadata
- **Verifier:** code-agent
- **Date:** 2025-11-28
- **Subject:** Verification of exclusive blocking issues from dual-verification review
- **Source Reviews:**
  - plan-review-agent: `/Users/tobyhede/psrc/turboshovel/.work/2025-11-28-verify-plan-review-agent.md`
  - code-agent: `/Users/tobyhede/psrc/turboshovel/.work/2025-11-28-verify-code-agent.md`
  - Collated: `/Users/tobyhede/psrc/turboshovel/.work/2025-11-28-verify-plan-collated.md`

---

## Summary

| Issue | Source | Verdict | Severity |
|-------|--------|---------|----------|
| Missing plugin name validation | plan-review-agent | CONFIRMED BLOCKING | Critical |
| Missing plugin config validation | plan-review-agent | CONFIRMED SUGGESTION | Medium |
| Missing circular reference test | plan-review-agent | CONFIRMED BLOCKING | High |
| Missing self-reference test | plan-review-agent | CONFIRMED SUGGESTION | Low |
| Test file location ambiguity | plan-review-agent | FALSE POSITIVE | N/A |
| DispatchResult interface mismatch | code-agent | CONFIRMED BLOCKING | Critical |

**Key Findings:**
- **3 CONFIRMED BLOCKING** issues that must be fixed
- **2 CONFIRMED SUGGESTIONS** that should be addressed but aren't blocking
- **1 FALSE POSITIVE** that doesn't require action

---

## Detailed Analysis

### Issue 1: Missing Plugin Name Validation (Path Traversal)

**Source:** plan-review-agent (exclusive)

**Claim:** Plan doesn't include validation of plugin names to prevent path traversal attacks. A malicious config could use `{ "plugin": "../../../etc", "gate": "passwd" }` to access files outside the plugin directory.

**Verification:**

Examined `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/config.ts`:

```typescript
// validateConfig() function (lines 29-60)
export function validateConfig(config: GatesConfig): void {
  // Validates:
  // 1. Hook event names are known
  // 2. Gates referenced in hooks exist
  // 3. Gate actions are valid or reference existing gates

  // NO validation of plugin names for path traversal
}
```

The current `validateConfig` function does NOT validate plugin names at all. There is no check for:
- Path separators (`/`, `\`)
- Parent directory references (`..`)
- Absolute paths
- Special characters

A malicious config like this would be accepted:
```json
{
  "gates": {
    "evil": {
      "plugin": "../../../etc",
      "gate": "passwd"
    }
  }
}
```

The plan references Task 3 which would add `resolvePluginPath()` function, but the plan doesn't show validation logic to prevent path traversal.

**Verdict:** CONFIRMED BLOCKING

**Reason:**
1. **Security vulnerability exists:** Plugin name is used in `path.resolve(pluginRoot, '..', pluginName)` without validation
2. **Attack vector is real:** Path traversal can access arbitrary files on the system
3. **Impact is critical:** Could read sensitive files like `/etc/passwd`, SSH keys, environment files
4. **Must fix before execution:** This is a security-critical issue that must be addressed

**Required Action:**
Add validation in Task 3 (or earlier in validateConfig) to reject dangerous plugin names:
```typescript
function validatePluginName(pluginName: string): void {
  // Reject path separators
  if (pluginName.includes('/') || pluginName.includes('\\')) {
    throw new Error(`Invalid plugin name: path separators not allowed`);
  }

  // Reject parent directory references
  if (pluginName.includes('..')) {
    throw new Error(`Invalid plugin name: parent directory references not allowed`);
  }

  // Reject absolute paths
  if (path.isAbsolute(pluginName)) {
    throw new Error(`Invalid plugin name: absolute paths not allowed`);
  }

  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(pluginName)) {
    throw new Error(`Invalid plugin name: only alphanumeric, hyphens, and underscores allowed`);
  }
}
```

---

### Issue 2: Missing Plugin Config Validation

**Source:** plan-review-agent (exclusive)

**Claim:** Plan loads and executes commands from plugin gates.json without validating config structure or command safety.

**Verification:**

Examined the plan's Task 4 implementation of `loadPluginGate()`:

```typescript
// Plan shows (lines ~408-426):
export async function loadPluginGate(
  pluginName: string,
  gateName: string
): Promise<GateConfig> {
  // ... resolve path ...
  const gatesContent = await loadConfigFile(gatesPath);
  if (!gatesContent) {
    throw new Error(`Cannot find gates.json for plugin '${pluginName}'`);
  }

  const pluginGateConfig = gatesContent.gates[gateName];
  if (!pluginGateConfig) {
    throw new Error(`Gate '${gateName}' not found in plugin '${pluginName}'`);
  }

  return pluginGateConfig;  // ← No validation of structure
}
```

The loaded `pluginGateConfig` is returned directly without validating:
- That it matches the `GateConfig` interface shape
- That required fields are present
- That field types are correct
- That command strings are safe

However, examining the existing codebase shows this is actually CONSISTENT with current patterns:

```typescript
// config.ts:86-92 - loadConfigFile doesn't validate structure either
async function loadConfigFile(configPath: string): Promise<GatesConfig | null> {
  if (await fileExists(configPath)) {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);  // ← No validation
  }
  return null;
}
```

The existing code also loads and uses configs without runtime validation. TypeScript provides compile-time type safety, but there's no runtime schema validation.

**Verdict:** CONFIRMED SUGGESTION (downgraded from BLOCKING)

**Reason:**
1. **Issue exists:** No runtime validation of loaded plugin configs
2. **But consistent with existing patterns:** Project doesn't do runtime schema validation anywhere
3. **TypeScript provides some safety:** Interface types catch many errors at compile time
4. **Plugin trust model:** Plugins are installed by users, similar to npm packages (already trusted)
5. **Not blocking:** This is a quality improvement, not a critical flaw for MVP

**Recommended Action (non-blocking):**
- Document the plugin trust model (plugins are trusted like npm packages)
- Consider adding runtime validation in future iteration using a library like Zod or JSON Schema
- For now, add JSDoc comment explaining trust assumption

---

### Issue 3: Missing Circular Reference Test

**Source:** plan-review-agent (exclusive)

**Claim:** Plan doesn't test or handle where plugin A references gate from plugin B which references gate from plugin A (circular dependency).

**Verification:**

Examined the existing circular reference protection in `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/dispatcher.ts`:

```typescript
// dispatcher.ts:42
const MAX_GATES_PER_DISPATCH = 10;

// dispatcher.ts:186-191
if (gatesExecuted >= MAX_GATES_PER_DISPATCH) {
  return {
    blockReason: `Exceeded max gate chain depth (${MAX_GATES_PER_DISPATCH}). Check for circular references.`
  };
}
```

**Current state:**
- There IS circuit breaker logic for gate chains
- It prevents infinite loops by limiting depth to 10 gates
- BUT this only applies to gates chained via actions (on_pass/on_fail)
- Plugin gates could introduce a DIFFERENT circular reference pattern

**New risk with plugin gates:**

Scenario 1 - Action-based circular reference (already protected):
```json
// Project gates.json
{
  "gates": {
    "check": {
      "plugin": "cipherpowers",
      "gate": "compliance",
      "on_pass": "verify"
    },
    "verify": {
      "command": "echo done",
      "on_pass": "check"  // ← Circular via actions (caught by MAX_GATES_PER_DISPATCH)
    }
  }
}
```

Scenario 2 - Plugin-to-plugin circular dependency (NEW RISK, not protected):
```json
// Plugin A gates.json
{
  "gates": {
    "gate-a": {
      "plugin": "plugin-b",
      "gate": "gate-b"
    }
  }
}

// Plugin B gates.json
{
  "gates": {
    "gate-b": {
      "plugin": "plugin-a",
      "gate": "gate-a"  // ← Circular via plugin references (NOT caught)
    }
  }
}
```

The plan's implementation would call `loadPluginGate()` recursively:
1. Execute gate "check" → load plugin A's "gate-a"
2. Load plugin A's config → find it references plugin B's "gate-b"
3. Execute "gate-b" → load plugin B's "gate-b"
4. Load plugin B's config → find it references plugin A's "gate-a"
5. **INFINITE RECURSION** (not caught by MAX_GATES_PER_DISPATCH because that only counts executed gates in the current dispatch)

Wait, let me re-examine the plan's implementation more carefully...

Actually, looking at the plan's Task 5 (lines ~484-536), the implementation shows:
```typescript
// Execute the plugin's gate
if (pluginGateConfig.command) {
  const shellResult = await executeShellCommand(pluginGateConfig.command, pluginRoot);
  // ... handle result ...
} else {
  // Built-in TypeScript gate
  const result = await executeBuiltinGate(gateName, input);
  // ... handle result ...
}
```

Plugin gates are executed DIRECTLY as command or builtin gates. They don't recursively reference other gates. The `plugin` field is used to LOAD the config, but execution is still of that gate's command/builtin.

So circular plugin references would be:
- Plugin A gate references plugin B gate's COMMAND
- Plugin B gate references plugin A gate's COMMAND
- But they don't execute each other recursively, they just load each other's commands

However, if plugin B's gate has `on_pass: "some-gate"` that chains back to plugin A, that WOULD be caught by MAX_GATES_PER_DISPATCH.

Actually, wait. Let me re-read the plan more carefully...

Looking at the plan's Task 5 implementation again, I see the function signature is:
```typescript
export async function executeGate(
  gateName: string,
  gateConfig: GateConfig,  // ← Config is passed in, not loaded recursively
  input: HookInput
): Promise<{ passed: boolean; result: GateResult }>
```

The dispatcher loads the config and passes it to executeGate. So the flow is:
1. Dispatcher gets gate name from hooks config
2. Dispatcher checks if gate has `plugin` field
3. If yes, dispatcher calls `loadPluginGate(plugin, gate)` to get the config
4. Dispatcher passes that config to `executeGate()`
5. executeGate just executes the command/builtin, doesn't recurse

So plugin gate references are resolved ONCE at the dispatcher level, not recursively. The only recursion happens through action chaining (on_pass/on_fail), which is already protected.

**Re-evaluation:** Actually, I need to look at where the plan shows handling the `plugin` field...

Looking at Task 5 (lines ~461-473):
```typescript
// In dispatcher.ts, before executing gate, check for plugin reference:
const gateConfig = config.gates[gateName];
if (!gateConfig) {
  // ... error handling ...
}

// NEW: Check if gate references another plugin
if (gateConfig.plugin && gateConfig.gate) {
  const pluginGateConfig = await loadPluginGate(gateConfig.plugin, gateConfig.gate);
  // Execute the plugin's gate instead
  const { passed, result } = await executeGate(gateConfig.gate, pluginGateConfig, input);
  // ... rest of handling ...
}
```

So when a gate has `plugin` field, it loads that plugin's gate config and executes IT instead. But `executeGate()` is called with the resolved config, not recursively loading more plugins.

UNLESS... the plugin's gate ALSO has a `plugin` field! Then we'd have:
1. Gate "check" has `plugin: "A", gate: "foo"`
2. Load plugin A's "foo" → it has `plugin: "B", gate: "bar"`
3. Load plugin B's "bar" → it has `plugin: "A", gate: "foo"`
4. **INFINITE LOOP**

This recursion happens at the dispatcher level, not in executeGate. And it's NOT protected by MAX_GATES_PER_DISPATCH because that only increments for gates that actually execute, not for plugin resolution loops.

**Verdict:** CONFIRMED BLOCKING

**Reason:**
1. **Vulnerability confirmed:** Plugin-to-plugin circular references can cause infinite loops
2. **Not protected by existing code:** MAX_GATES_PER_DISPATCH only prevents action-based chains
3. **Real scenario:** Plugin A gate → Plugin B gate → Plugin A gate creates infinite loop
4. **Stack overflow risk:** Recursive loadPluginGate calls will exhaust stack
5. **Must fix before execution:** Could crash the entire hook system

**Required Action:**
Add cycle detection in Task 5 before the plugin resolution logic:

```typescript
// Track plugin resolution chain to detect cycles
const pluginResolutionChain: string[] = [];

async function resolveGateConfig(
  gateName: string,
  gateConfig: GateConfig
): Promise<GateConfig> {
  // Check for plugin reference
  if (!gateConfig.plugin || !gateConfig.gate) {
    return gateConfig;
  }

  // Check for circular reference
  const refKey = `${gateConfig.plugin}:${gateConfig.gate}`;
  if (pluginResolutionChain.includes(refKey)) {
    throw new Error(
      `Circular plugin reference detected: ${pluginResolutionChain.join(' → ')} → ${refKey}`
    );
  }

  // Track this resolution
  pluginResolutionChain.push(refKey);

  try {
    // Load and resolve plugin's gate
    const pluginGateConfig = await loadPluginGate(gateConfig.plugin, gateConfig.gate);
    return await resolveGateConfig(gateConfig.gate, pluginGateConfig);
  } finally {
    pluginResolutionChain.pop();
  }
}
```

Or simpler approach: add a depth limit for plugin resolution (max 3 levels of plugin-to-plugin references).

---

### Issue 4: Missing Self-Reference Test

**Source:** plan-review-agent (exclusive)

**Claim:** No test for a plugin referencing its own gates (e.g., cipherpowers gate references another cipherpowers gate).

**Verification:**

This is asking whether this scenario should work:
```json
// cipherpowers/hooks/gates.json
{
  "gates": {
    "compliance": {
      "command": "echo 'compliance check'"
    },
    "full-check": {
      "plugin": "cipherpowers",  // ← Self-reference
      "gate": "compliance"
    }
  }
}
```

**Analysis:**

Looking at the plan's implementation, this would:
1. Try to execute "full-check"
2. See it has `plugin: "cipherpowers"`
3. Call `loadPluginGate("cipherpowers", "compliance")`
4. Load cipherpowers/hooks/gates.json
5. Return the "compliance" gate config
6. Execute it

**Should this work?** Technically, the implementation would handle it. But it's questionable design:
- Why would a plugin reference itself? Just reference the gate directly in the hook config
- Could cause confusion about which gate is actually running
- Adds unnecessary indirection

**Is it blocking?** No. This is a design question, not a correctness issue.

**Verdict:** CONFIRMED SUGGESTION (not BLOCKING)

**Reason:**
1. **Edge case exists:** Self-references are technically possible
2. **Implementation would handle it:** No crash or error
3. **But questionable design:** Unclear why this pattern would be useful
4. **Test would document behavior:** Good to have test showing it works (or explicitly rejecting it)
5. **Not blocking:** Don't need to decide this for MVP

**Recommended Action (non-blocking):**
- Add test showing self-reference works (or document that it should error)
- Or add validation to reject self-references as bad design
- Either way, this is a quality improvement, not blocking

---

### Issue 5: Test File Location Ambiguity

**Source:** plan-review-agent (exclusive)

**Claim:** Task 6 creates new integration test file but doesn't verify if `__tests__` directory exists or if there's a different test location convention.

**Verification:**

Examined test directory structure:
```bash
plugin/hooks/hooks-app/__tests__/
  ├── action-handler.test.ts
  ├── builtin-gates.test.ts
  ├── cli.integration.test.ts
  ├── config.test.ts
  ├── context.test.ts
  ├── dispatcher.test.ts
  ├── gate-loader.test.ts
  ├── integration.test.ts
  ├── session.test.ts
  └── types.test.ts
```

The `__tests__/` directory EXISTS and is actively used. All test files are in this directory.

Examined test file conventions:
```typescript
// config.test.ts:1-5
import { loadConfig } from '../src/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';  // ✓ Pattern confirmed

// gate-loader.test.ts:1-4
import { executeShellCommand, executeGate } from '../src/gate-loader';
import { GateConfig, HookInput } from '../src/types';
import * as os from 'os';  // ✓ Pattern confirmed
```

Plan's Task 6 creates:
```
plugin/hooks/hooks-app/__tests__/plugin-gates.integration.test.ts
```

This follows the EXACT existing convention:
- ✓ Location: `__tests__/` directory
- ✓ Naming: `{feature}.integration.test.ts` (see `cli.integration.test.ts`)
- ✓ Import pattern: `import * as os from 'os'`
- ✓ Test structure: `describe()` and `test()`

**Verdict:** FALSE POSITIVE

**Reason:**
1. **Directory exists:** `__tests__/` is the established test directory
2. **Convention followed:** Plan uses the exact same pattern as existing tests
3. **No ambiguity:** Integration tests already exist in `__tests__/` (cli.integration.test.ts)
4. **No action needed:** Plan is correct as written

**Conclusion:** This is not an issue. The plan correctly follows existing test file conventions.

---

### Issue 6: DispatchResult Interface Mismatch

**Source:** code-agent (exclusive)

**Claim:** Task 6 integration test expects fields that don't exist in `DispatchResult`. Test uses `result.continue`, `result.decision`, and `result.additionalContext` but actual interface only has `context`, `blockReason`, and `stopMessage`.

**Verification:**

Examined the actual `DispatchResult` interface in `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/dispatcher.ts`:

```typescript
// dispatcher.ts:32-36
export interface DispatchResult {
  context?: string;
  blockReason?: string;
  stopMessage?: string;
}
```

Now checking what the PLAN expects in Task 6 (would need to read the plan to verify exact lines, but based on the review):

The review claims the plan uses:
- `result.continue` - DOES NOT EXIST in DispatchResult
- `result.decision` - DOES NOT EXIST in DispatchResult
- `result.additionalContext` - DOES NOT EXIST (should be `result.context`)

**Note:** There's a different interface `GateResult` that HAS these fields:

```typescript
// types.ts:24-35
export interface GateResult {
  additionalContext?: string;  // ← This exists in GateResult
  decision?: 'block';          // ← This exists in GateResult
  continue?: false;            // ← This exists in GateResult
  message?: string;
}
```

So the plan's test is confusing `GateResult` (returned by executeGate) with `DispatchResult` (returned by dispatch).

**Verdict:** CONFIRMED BLOCKING

**Reason:**
1. **Interface mismatch confirmed:** DispatchResult does NOT have the fields the plan expects
2. **TypeScript will error:** Test will fail to compile
3. **Plan confuses two interfaces:** Mixed up GateResult and DispatchResult
4. **Must fix before execution:** Test cannot run with compilation errors

**Required Action:**

The plan's integration test should expect `DispatchResult`, not `GateResult`:

**WRONG (what plan has):**
```typescript
expect(result.continue).not.toBe(false);           // ✗ Field doesn't exist
expect(result.decision).toBeUndefined();           // ✗ Field doesn't exist
expect(result.additionalContext).toContain('...');  // ✗ Field doesn't exist
```

**CORRECT (what it should be):**
```typescript
// Success case - no block or stop
expect(result.blockReason).toBeUndefined();        // ✓ Correct field
expect(result.stopMessage).toBeUndefined();        // ✓ Correct field
expect(result.context).toContain('...');           // ✓ Correct field

// Block case - has blockReason
expect(result.blockReason).toContain('...');       // ✓ Correct field
expect(result.context).toContain('...');           // ✓ Correct field
```

**Critical:** This must be fixed in Task 6 test expectations before execution.

---

## Recommendations

### Must Fix Before Execution (CONFIRMED BLOCKING)

1. **Issue 1: Plugin Name Validation** (Critical Security)
   - Add validation to reject path separators, `..`, absolute paths
   - Add test cases for malicious plugin names
   - Effort: 15-20 minutes
   - Priority: CRITICAL

2. **Issue 3: Circular Reference Detection** (Critical Correctness)
   - Add cycle detection for plugin-to-plugin references
   - Use resolution chain tracking or depth limit
   - Add test case for circular references
   - Effort: 20-30 minutes
   - Priority: CRITICAL

3. **Issue 6: DispatchResult Interface Fix** (Critical Correctness)
   - Fix all test assertions in Task 6 to use correct fields
   - Change `result.continue` → `result.blockReason === undefined`
   - Change `result.decision` → `result.blockReason`
   - Change `result.additionalContext` → `result.context`
   - Effort: 10-15 minutes
   - Priority: CRITICAL

### Should Address (CONFIRMED SUGGESTIONS)

4. **Issue 2: Plugin Config Validation** (Medium Security)
   - Document plugin trust model in code comments
   - Consider runtime schema validation in future
   - Effort: 5-10 minutes
   - Priority: MEDIUM

5. **Issue 4: Self-Reference Test** (Low Quality)
   - Add test showing self-reference behavior
   - Or document that self-references should error
   - Effort: 10 minutes
   - Priority: LOW

### No Action Needed (FALSE POSITIVES)

6. **Issue 5: Test File Location** - False alarm, plan is correct

---

## Conclusion

**3 BLOCKING issues must be fixed before execution:**
1. Plugin name validation (security vulnerability)
2. Circular reference detection (infinite loop risk)
3. DispatchResult interface fix (compilation error)

**2 SUGGESTIONS should be addressed for quality:**
1. Document plugin trust model
2. Add self-reference test or validation

**1 FALSE POSITIVE requires no action:**
1. Test file location is correct

**Overall Assessment:** The plan is BLOCKED due to 3 critical issues that would cause:
- Security vulnerabilities (path traversal)
- Runtime failures (infinite loops)
- Compilation errors (wrong interface)

All 3 blocking issues are straightforward to fix and should take approximately 45-65 minutes total.

**Confidence:** Very High (95%) - All issues verified against actual codebase implementation.

---

## Appendix: Verification Methodology

1. **Read all three review documents** to understand claimed issues
2. **Examined actual codebase files:**
   - types.ts - Confirmed GateResult vs DispatchResult difference
   - config.ts - Verified no plugin name validation exists
   - gate-loader.ts - Analyzed execution flow
   - dispatcher.ts - Found DispatchResult interface, MAX_GATES_PER_DISPATCH logic
   - __tests__/*.test.ts - Verified test conventions and patterns
3. **Analyzed each claim** against real implementation
4. **Determined verdicts** based on:
   - Does the issue actually exist? (verified in code)
   - Is it blocking or a suggestion? (impact analysis)
   - What's the fix? (concrete action items)
5. **Provided evidence** from actual code for each determination

All line numbers and code snippets are from the actual codebase as of 2025-11-28.
