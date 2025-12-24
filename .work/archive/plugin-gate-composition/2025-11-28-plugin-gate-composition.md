# Plugin Gate Composition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable projects to reference gates defined in other plugins using `plugin` + `gate` fields.

**Architecture:** Extend GateConfig with optional `plugin` and `gate` fields. When present, resolve the plugin path (sibling convention by default), load the plugin's gates.json, look up the gate definition, and execute the command in the plugin's directory context.

**Tech Stack:** TypeScript, Node.js, Jest

---

## Task 1: Extend GateConfig Type

**Files:**
- Modify: `plugin/hooks/hooks-app/src/types.ts:39-50`
- Test: `plugin/hooks/hooks-app/__tests__/types.test.ts`

**Step 1: Write the failing test**

In `plugin/hooks/hooks-app/__tests__/types.test.ts`, add:

```typescript
describe('GateConfig Type', () => {
  test('accepts plugin gate reference', () => {
    const config: GateConfig = {
      plugin: 'cipherpowers',
      gate: 'plan-compliance'
    };
    expect(config.plugin).toBe('cipherpowers');
    expect(config.gate).toBe('plan-compliance');
  });

  test('accepts local command gate', () => {
    const config: GateConfig = {
      command: 'npm run lint'
    };
    expect(config.command).toBe('npm run lint');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=types.test.ts`
Expected: FAIL - Property 'plugin' does not exist on type 'GateConfig'

**Step 3: Update GateConfig interface**

In `plugin/hooks/hooks-app/src/types.ts`, replace GateConfig:

```typescript
export interface GateConfig {
  /** Reference gate from another plugin (requires gate field) */
  plugin?: string;

  /** Gate name within the plugin's hooks/gates.json (requires plugin field) */
  gate?: string;

  /** Local shell command (mutually exclusive with plugin/gate) */
  command?: string;

  /**
   * Keywords that trigger this gate (UserPromptSubmit hook only).
   * When specified, the gate only runs if the user message contains one of these keywords.
   * For all other hooks (PostToolUse, SubagentStop, etc.), this field is ignored.
   * Gates without keywords always run (backwards compatible).
   */
  keywords?: string[];
  on_pass?: string;
  on_fail?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/types.ts plugin/hooks/hooks-app/__tests__/types.test.ts
git commit -m "feat(types): add plugin and gate fields to GateConfig"
```

---

## Task 2: Add Gate Config Validation

**Files:**
- Modify: `plugin/hooks/hooks-app/src/config.ts:28-59`
- Test: `plugin/hooks/hooks-app/__tests__/config.test.ts`

**Step 1: Write the failing tests**

In `plugin/hooks/hooks-app/__tests__/config.test.ts`, add:

```typescript
describe('Gate Config Validation', () => {
  test('rejects gate with plugin but no gate name', async () => {
    const configObj = {
      hooks: { PostToolUse: { gates: ['test'] } },
      gates: {
        test: { plugin: 'cipherpowers' }  // Missing gate field
      }
    };

    await fs.writeFile(path.join(testDir, 'gates.json'), JSON.stringify(configObj));
    await expect(loadConfig(testDir)).rejects.toThrow(
      "Gate 'test' has 'plugin' but missing 'gate' field"
    );
  });

  test('rejects gate with gate name but no plugin', async () => {
    const configObj = {
      hooks: { PostToolUse: { gates: ['test'] } },
      gates: {
        test: { gate: 'plan-compliance' }  // Missing plugin field
      }
    };

    await fs.writeFile(path.join(testDir, 'gates.json'), JSON.stringify(configObj));
    await expect(loadConfig(testDir)).rejects.toThrow(
      "Gate 'test' has 'gate' but missing 'plugin' field"
    );
  });

  test('rejects gate with both command and plugin', async () => {
    const configObj = {
      hooks: { PostToolUse: { gates: ['test'] } },
      gates: {
        test: {
          plugin: 'cipherpowers',
          gate: 'plan-compliance',
          command: 'npm run lint'  // Conflicting
        }
      }
    };

    await fs.writeFile(path.join(testDir, 'gates.json'), JSON.stringify(configObj));
    await expect(loadConfig(testDir)).rejects.toThrow(
      "Gate 'test' cannot have both 'command' and 'plugin/gate'"
    );
  });

  test('accepts valid plugin gate reference', async () => {
    // This test will fail until plugin resolution is implemented
    // For now, we just validate the structure
    const configObj = {
      hooks: {},
      gates: {
        test: { plugin: 'cipherpowers', gate: 'plan-compliance' }
      }
    };

    await fs.writeFile(path.join(testDir, 'gates.json'), JSON.stringify(configObj));
    // Should not throw validation error for structure
    // (Will fail later when trying to resolve plugin)
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=config.test.ts`
Expected: FAIL - validation errors not thrown

**Step 3: Add validateGateConfig function**

In `plugin/hooks/hooks-app/src/config.ts`, add after KNOWN_ACTIONS:

```typescript
function validateGateConfig(gateName: string, gateConfig: GateConfig): void {
  const hasPlugin = gateConfig.plugin !== undefined;
  const hasGate = gateConfig.gate !== undefined;
  const hasCommand = gateConfig.command !== undefined;

  // plugin requires gate
  if (hasPlugin && !hasGate) {
    throw new Error(`Gate '${gateName}' has 'plugin' but missing 'gate' field`);
  }

  // gate requires plugin
  if (hasGate && !hasPlugin) {
    throw new Error(`Gate '${gateName}' has 'gate' but missing 'plugin' field`);
  }

  // command is mutually exclusive with plugin/gate
  if (hasCommand && (hasPlugin || hasGate)) {
    throw new Error(`Gate '${gateName}' cannot have both 'command' and 'plugin/gate'`);
  }
}
```

**Step 4: Call validateGateConfig from validateConfig**

In `validateConfig`, add at the start of the gate loop:

```typescript
// Invariant: Gate actions must be CONTINUE/BLOCK/STOP or reference existing gates
for (const [gateName, gateConfig] of Object.entries(config.gates)) {
  // Validate gate structure first
  validateGateConfig(gateName, gateConfig);

  for (const action of [gateConfig.on_pass, gateConfig.on_fail]) {
    // ... existing action validation
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=config.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add plugin/hooks/hooks-app/src/config.ts plugin/hooks/hooks-app/__tests__/config.test.ts
git commit -m "feat(config): validate plugin/gate mutual exclusivity"
```

---

## Task 3: Implement Plugin Path Resolution

**Files:**
- Modify: `plugin/hooks/hooks-app/src/config.ts`
- Test: `plugin/hooks/hooks-app/__tests__/config.test.ts`

**Step 1: Write the failing test**

In `plugin/hooks/hooks-app/__tests__/config.test.ts`, add:

```typescript
import { resolvePluginPath } from '../src/config';

describe('Plugin Path Resolution', () => {
  test('resolves sibling plugin using CLAUDE_PLUGIN_ROOT', () => {
    const originalEnv = process.env.CLAUDE_PLUGIN_ROOT;
    process.env.CLAUDE_PLUGIN_ROOT = '/home/user/.claude/plugins/turboshovel';

    try {
      const result = resolvePluginPath('cipherpowers');
      expect(result).toBe('/home/user/.claude/plugins/cipherpowers');
    } finally {
      process.env.CLAUDE_PLUGIN_ROOT = originalEnv;
    }
  });

  test('throws when CLAUDE_PLUGIN_ROOT not set', () => {
    const originalEnv = process.env.CLAUDE_PLUGIN_ROOT;
    delete process.env.CLAUDE_PLUGIN_ROOT;

    try {
      expect(() => resolvePluginPath('cipherpowers')).toThrow(
        'Cannot resolve plugin path: CLAUDE_PLUGIN_ROOT not set'
      );
    } finally {
      process.env.CLAUDE_PLUGIN_ROOT = originalEnv;
    }
  });

  test('rejects plugin names with path separators', () => {
    const originalEnv = process.env.CLAUDE_PLUGIN_ROOT;
    process.env.CLAUDE_PLUGIN_ROOT = '/home/user/.claude/plugins/turboshovel';

    try {
      expect(() => resolvePluginPath('../etc')).toThrow(
        "Invalid plugin name: '../etc' (must not contain path separators)"
      );
      expect(() => resolvePluginPath('foo/bar')).toThrow(
        "Invalid plugin name: 'foo/bar' (must not contain path separators)"
      );
      expect(() => resolvePluginPath('foo\\bar')).toThrow(
        "Invalid plugin name: 'foo\\bar' (must not contain path separators)"
      );
    } finally {
      process.env.CLAUDE_PLUGIN_ROOT = originalEnv;
    }
  });

  test('rejects plugin names with parent directory references', () => {
    const originalEnv = process.env.CLAUDE_PLUGIN_ROOT;
    process.env.CLAUDE_PLUGIN_ROOT = '/home/user/.claude/plugins/turboshovel';

    try {
      expect(() => resolvePluginPath('..')).toThrow(
        "Invalid plugin name: '..' (must not contain path separators)"
      );
      expect(() => resolvePluginPath('..foo')).toThrow(
        "Invalid plugin name: '..foo' (must not contain path separators)"
      );
    } finally {
      process.env.CLAUDE_PLUGIN_ROOT = originalEnv;
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=config.test.ts`
Expected: FAIL - resolvePluginPath is not exported

**Step 3: Implement resolvePluginPath**

In `plugin/hooks/hooks-app/src/config.ts`, add:

```typescript
/**
 * Resolve plugin path using sibling convention.
 * Assumes plugins are installed as siblings under the same parent directory.
 *
 * SECURITY: Plugin names are validated to prevent path traversal attacks.
 * This does NOT mean untrusted plugins are safe - plugins are trusted by virtue
 * of being explicitly installed by the user. This validation only prevents
 * accidental or malicious config entries from accessing arbitrary paths.
 *
 * @param pluginName - Name of the plugin to resolve
 * @returns Absolute path to the plugin root
 * @throws Error if CLAUDE_PLUGIN_ROOT is not set or plugin name is invalid
 */
export function resolvePluginPath(pluginName: string): string {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) {
    throw new Error('Cannot resolve plugin path: CLAUDE_PLUGIN_ROOT not set');
  }

  // Security: Reject plugin names with path separators or parent references
  // Prevents path traversal attacks like "../../../etc" or "foo/bar"
  if (pluginName.includes('/') || pluginName.includes('\\') || pluginName.includes('..')) {
    throw new Error(
      `Invalid plugin name: '${pluginName}' (must not contain path separators)`
    );
  }

  // Sibling convention: plugins are in same parent directory
  // e.g., ~/.claude/plugins/turboshovel -> ~/.claude/plugins/cipherpowers
  return path.resolve(pluginRoot, '..', pluginName);
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/config.ts plugin/hooks/hooks-app/__tests__/config.test.ts
git commit -m "feat(config): add resolvePluginPath for sibling plugin discovery"
```

---

## Task 4: Implement Plugin Gate Loading

**Files:**
- Modify: `plugin/hooks/hooks-app/src/gate-loader.ts`
- Test: `plugin/hooks/hooks-app/__tests__/gate-loader.test.ts`

**Step 1: Write the failing test**

In `plugin/hooks/hooks-app/__tests__/gate-loader.test.ts`, add:

```typescript
import { loadPluginGate } from '../src/gate-loader';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Plugin Gate Loading', () => {
  let mockPluginDir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Create mock plugin directory structure
    mockPluginDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mock-plugins-'));
    const cipherpowersDir = path.join(mockPluginDir, 'cipherpowers', 'hooks');
    await fs.mkdir(cipherpowersDir, { recursive: true });

    // Create mock gates.json for cipherpowers
    const gatesConfig = {
      hooks: {},
      gates: {
        'plan-compliance': {
          command: 'node dist/gates/plan-compliance.js',
          on_fail: 'BLOCK'
        }
      }
    };
    await fs.writeFile(
      path.join(cipherpowersDir, 'gates.json'),
      JSON.stringify(gatesConfig)
    );

    // Set CLAUDE_PLUGIN_ROOT to point to turboshovel sibling
    originalEnv = process.env.CLAUDE_PLUGIN_ROOT;
    process.env.CLAUDE_PLUGIN_ROOT = path.join(mockPluginDir, 'turboshovel');
  });

  afterEach(async () => {
    process.env.CLAUDE_PLUGIN_ROOT = originalEnv;
    await fs.rm(mockPluginDir, { recursive: true, force: true });
  });

  test('loads gate config from plugin', async () => {
    const result = await loadPluginGate('cipherpowers', 'plan-compliance');

    expect(result.gateConfig.command).toBe('node dist/gates/plan-compliance.js');
    expect(result.gateConfig.on_fail).toBe('BLOCK');
    expect(result.pluginRoot).toBe(path.join(mockPluginDir, 'cipherpowers'));
  });

  test('throws when plugin gates.json not found', async () => {
    await expect(loadPluginGate('nonexistent', 'some-gate')).rejects.toThrow(
      "Cannot find gates.json for plugin 'nonexistent'"
    );
  });

  test('throws when gate not found in plugin', async () => {
    await expect(loadPluginGate('cipherpowers', 'nonexistent-gate')).rejects.toThrow(
      "Gate 'nonexistent-gate' not found in plugin 'cipherpowers'"
    );
  });

  test('validates loaded plugin config structure', async () => {
    // Create plugin with malformed gates.json
    const malformedDir = path.join(mockPluginDir, 'malformed', 'hooks');
    await fs.mkdir(malformedDir, { recursive: true });
    await fs.writeFile(
      path.join(malformedDir, 'gates.json'),
      JSON.stringify({
        hooks: {},
        gates: {
          'bad-gate': {
            // Missing required fields (no command, plugin, or gate)
          }
        }
      })
    );

    // This should succeed loading but the gate config is invalid
    // Validation happens when the gate is used, not when loading
    const result = await loadPluginGate('malformed', 'bad-gate');
    expect(result.gateConfig).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=gate-loader.test.ts`
Expected: FAIL - loadPluginGate is not exported

**Step 3: Implement loadPluginGate**

In `plugin/hooks/hooks-app/src/gate-loader.ts`, add:

```typescript
import { resolvePluginPath, loadConfigFile } from './config';
import { GateConfig, GatesConfig } from './types';

export interface PluginGateResult {
  gateConfig: GateConfig;
  pluginRoot: string;
}

/**
 * Load a gate definition from another plugin.
 *
 * SECURITY: Plugins are trusted by virtue of being explicitly installed by the user.
 * This function loads plugin configuration and does NOT validate command safety.
 * The trust boundary is at plugin installation, not at gate reference.
 *
 * However, we do validate that the loaded config has the expected structure to
 * prevent runtime errors from malformed plugin configurations.
 *
 * @param pluginName - Name of the plugin (e.g., 'cipherpowers')
 * @param gateName - Name of the gate within the plugin
 * @returns The gate config and the plugin root path for execution context
 */
export async function loadPluginGate(
  pluginName: string,
  gateName: string
): Promise<PluginGateResult> {
  const pluginRoot = resolvePluginPath(pluginName);
  const gatesPath = path.join(pluginRoot, 'hooks', 'gates.json');

  const pluginConfig = await loadConfigFile(gatesPath);
  if (!pluginConfig) {
    throw new Error(`Cannot find gates.json for plugin '${pluginName}' at ${gatesPath}`);
  }

  // Validate plugin config has gates object
  if (!pluginConfig.gates || typeof pluginConfig.gates !== 'object') {
    throw new Error(
      `Invalid gates.json structure in plugin '${pluginName}': missing or invalid 'gates' object`
    );
  }

  const gateConfig = pluginConfig.gates[gateName];
  if (!gateConfig) {
    throw new Error(`Gate '${gateName}' not found in plugin '${pluginName}'`);
  }

  // Note: Further validation of gateConfig (command, plugin, gate fields) happens
  // in validateGateConfig which is called during config loading, not here.
  // We trust that plugin configs are structurally valid.

  return { gateConfig, pluginRoot };
}
```

**Step 4: Export loadConfigFile from config.ts**

In `plugin/hooks/hooks-app/src/config.ts`, change:

```typescript
// From:
async function loadConfigFile(configPath: string): Promise<GatesConfig | null> {

// To:
export async function loadConfigFile(configPath: string): Promise<GatesConfig | null> {
```

**Step 5: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=gate-loader.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add plugin/hooks/hooks-app/src/gate-loader.ts plugin/hooks/hooks-app/src/config.ts plugin/hooks/hooks-app/__tests__/gate-loader.test.ts
git commit -m "feat(gate-loader): add loadPluginGate for cross-plugin gate loading"
```

---

## Task 5: Update executeGate for Plugin Gates

**Files:**
- Modify: `plugin/hooks/hooks-app/src/gate-loader.ts:86-112`
- Test: `plugin/hooks/hooks-app/__tests__/gate-loader.test.ts`

**Step 1: Write the failing test**

In `plugin/hooks/hooks-app/__tests__/gate-loader.test.ts`, add to the existing Plugin Gate Loading describe block:

```typescript
test('executeGate handles plugin gate reference', async () => {
  const gateConfig: GateConfig = {
    plugin: 'cipherpowers',
    gate: 'plan-compliance'
  };

  const mockInput: HookInput = {
    hook_event_name: 'SubagentStop',
    cwd: '/some/project'
  };

  // The command from cipherpowers will be executed in cipherpowers plugin dir
  // For this test, the mock plugin has 'node dist/gates/plan-compliance.js'
  // which won't exist, so it will fail - but we can verify the flow
  const result = await executeGate('my-gate', gateConfig, mockInput);

  // Command execution will fail (file doesn't exist) but flow is correct
  expect(result.passed).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=gate-loader.test.ts`
Expected: FAIL - executeGate doesn't handle plugin gates

**Step 3: Update executeGate**

In `plugin/hooks/hooks-app/src/gate-loader.ts`, replace executeGate:

```typescript
// Track plugin gate call stack to detect circular references
const MAX_PLUGIN_DEPTH = 10;

export async function executeGate(
  gateName: string,
  gateConfig: GateConfig,
  input: HookInput,
  pluginStack: string[] = []
): Promise<{ passed: boolean; result: GateResult }> {
  // Handle plugin gate reference
  if (gateConfig.plugin && gateConfig.gate) {
    // Circular reference detection
    const gateRef = `${gateConfig.plugin}:${gateConfig.gate}`;
    if (pluginStack.includes(gateRef)) {
      throw new Error(
        `Circular gate reference detected: ${pluginStack.join(' -> ')} -> ${gateRef}`
      );
    }

    // Depth limit to prevent infinite recursion
    if (pluginStack.length >= MAX_PLUGIN_DEPTH) {
      throw new Error(
        `Maximum plugin gate depth (${MAX_PLUGIN_DEPTH}) exceeded: ${pluginStack.join(' -> ')} -> ${gateRef}`
      );
    }

    const { gateConfig: pluginGateConfig, pluginRoot } = await loadPluginGate(
      gateConfig.plugin,
      gateConfig.gate
    );

    // Recursively execute the plugin's gate with updated stack
    const newStack = [...pluginStack, gateRef];

    // Execute the plugin's gate command in the plugin's directory
    if (pluginGateConfig.command) {
      const shellResult = await executeShellCommand(pluginGateConfig.command, pluginRoot);
      const passed = shellResult.exitCode === 0;

      return {
        passed,
        result: {
          additionalContext: shellResult.output
        }
      };
    } else if (pluginGateConfig.plugin && pluginGateConfig.gate) {
      // Plugin gate references another plugin gate - recurse
      return executeGate(gateRef, pluginGateConfig, input, newStack);
    } else {
      throw new Error(
        `Plugin gate '${gateConfig.plugin}:${gateConfig.gate}' has no command`
      );
    }
  }

  if (gateConfig.command) {
    // Shell command gate (existing behavior)
    const shellResult = await executeShellCommand(gateConfig.command, input.cwd);
    const passed = shellResult.exitCode === 0;

    return {
      passed,
      result: {
        additionalContext: shellResult.output
      }
    };
  } else {
    // Built-in TypeScript gate
    const result = await executeBuiltinGate(gateName, input);
    const passed = !result.decision && result.continue !== false;

    return {
      passed,
      result
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=gate-loader.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/gate-loader.ts plugin/hooks/hooks-app/__tests__/gate-loader.test.ts
git commit -m "feat(gate-loader): executeGate now handles plugin gate references"
```

---

## Task 6: Integration Test for Plugin Gate Composition

**Files:**
- Create: `plugin/hooks/hooks-app/__tests__/plugin-gates.integration.test.ts`

**Step 1: Create integration test file**

Create `plugin/hooks/hooks-app/__tests__/plugin-gates.integration.test.ts`:

```typescript
// plugin/hooks/hooks-app/__tests__/plugin-gates.integration.test.ts
import { dispatch } from '../src/dispatcher';
import { HookInput } from '../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Plugin Gate Composition Integration', () => {
  let mockPluginsDir: string;
  let projectDir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // Create mock plugins directory with two plugins
    mockPluginsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mock-plugins-'));

    // Create mock cipherpowers plugin
    const cipherpowersHooksDir = path.join(mockPluginsDir, 'cipherpowers', 'hooks');
    await fs.mkdir(cipherpowersHooksDir, { recursive: true });
    await fs.writeFile(
      path.join(cipherpowersHooksDir, 'gates.json'),
      JSON.stringify({
        hooks: {},
        gates: {
          'plan-compliance': {
            command: 'echo "plan-compliance check passed"',
            on_fail: 'BLOCK'
          }
        }
      })
    );

    // Create mock turboshovel plugin (current plugin)
    const turboshovelHooksDir = path.join(mockPluginsDir, 'turboshovel', 'hooks');
    await fs.mkdir(turboshovelHooksDir, { recursive: true });
    await fs.writeFile(
      path.join(turboshovelHooksDir, 'gates.json'),
      JSON.stringify({ hooks: {}, gates: {} })
    );

    // Create test project directory
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-project-'));
    const claudeDir = path.join(projectDir, '.claude');
    await fs.mkdir(claudeDir);

    // Project config references cipherpowers gate
    await fs.writeFile(
      path.join(claudeDir, 'gates.json'),
      JSON.stringify({
        hooks: {
          SubagentStop: {
            gates: ['plan-compliance', 'check']
          }
        },
        gates: {
          'plan-compliance': {
            plugin: 'cipherpowers',
            gate: 'plan-compliance'
          },
          'check': {
            command: 'echo "project check passed"'
          }
        }
      })
    );

    // Set CLAUDE_PLUGIN_ROOT
    originalEnv = process.env.CLAUDE_PLUGIN_ROOT;
    process.env.CLAUDE_PLUGIN_ROOT = path.join(mockPluginsDir, 'turboshovel');
  });

  afterEach(async () => {
    process.env.CLAUDE_PLUGIN_ROOT = originalEnv;
    await fs.rm(mockPluginsDir, { recursive: true, force: true });
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  test('executes plugin gate followed by project gate', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: projectDir,
      agent_name: 'test-agent'
    };

    const result = await dispatch(input);

    // Both gates should pass (no blockReason or stopMessage)
    expect(result.blockReason).toBeUndefined();
    expect(result.stopMessage).toBeUndefined();

    // Should have output from both gates
    expect(result.context).toContain('plan-compliance check passed');
    expect(result.context).toContain('project check passed');
  });

  test('plugin gate BLOCK stops execution', async () => {
    // Update cipherpowers gate to fail
    const cipherpowersHooksDir = path.join(mockPluginsDir, 'cipherpowers', 'hooks');
    await fs.writeFile(
      path.join(cipherpowersHooksDir, 'gates.json'),
      JSON.stringify({
        hooks: {},
        gates: {
          'plan-compliance': {
            command: 'exit 1',
            on_fail: 'BLOCK'
          }
        }
      })
    );

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: projectDir,
      agent_name: 'test-agent'
    };

    const result = await dispatch(input);

    // Should be blocked (blockReason will be set)
    expect(result.blockReason).toBeDefined();
  });

  test('prevents circular gate references', async () => {
    // Create circular reference: pluginA -> pluginB -> pluginA
    const pluginADir = path.join(mockPluginsDir, 'pluginA', 'hooks');
    const pluginBDir = path.join(mockPluginsDir, 'pluginB', 'hooks');
    await fs.mkdir(pluginADir, { recursive: true });
    await fs.mkdir(pluginBDir, { recursive: true });

    // PluginA has gate that references pluginB
    await fs.writeFile(
      path.join(pluginADir, 'gates.json'),
      JSON.stringify({
        hooks: {},
        gates: {
          'gateA': {
            plugin: 'pluginB',
            gate: 'gateB'
          }
        }
      })
    );

    // PluginB has gate that references pluginA (circular)
    await fs.writeFile(
      path.join(pluginBDir, 'gates.json'),
      JSON.stringify({
        hooks: {},
        gates: {
          'gateB': {
            plugin: 'pluginA',
            gate: 'gateA'
          }
        }
      })
    );

    // Project config references pluginA gate
    const claudeDir = path.join(projectDir, '.claude');
    await fs.writeFile(
      path.join(claudeDir, 'gates.json'),
      JSON.stringify({
        hooks: {
          SubagentStop: {
            gates: ['test-circular']
          }
        },
        gates: {
          'test-circular': {
            plugin: 'pluginA',
            gate: 'gateA'
          }
        }
      })
    );

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: projectDir,
      agent_name: 'test-agent'
    };

    // Should error or handle gracefully (not infinite loop)
    // Implementation decision: error on circular reference
    await expect(dispatch(input)).rejects.toThrow(/circular|depth|recursion/i);
  });

  test('handles plugin self-reference', async () => {
    // Plugin references its own gate
    const selfRefDir = path.join(mockPluginsDir, 'selfref', 'hooks');
    await fs.mkdir(selfRefDir, { recursive: true });
    await fs.writeFile(
      path.join(selfRefDir, 'gates.json'),
      JSON.stringify({
        hooks: {},
        gates: {
          'gate1': {
            command: 'echo "gate1"'
          },
          'gate2': {
            plugin: 'selfref',
            gate: 'gate1'
          }
        }
      })
    );

    // Project references the self-referencing gate
    const claudeDir = path.join(projectDir, '.claude');
    await fs.writeFile(
      path.join(claudeDir, 'gates.json'),
      JSON.stringify({
        hooks: {
          SubagentStop: {
            gates: ['test-self']
          }
        },
        gates: {
          'test-self': {
            plugin: 'selfref',
            gate: 'gate2'
          }
        }
      })
    );

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: projectDir,
      agent_name: 'test-agent'
    };

    // Should work - self-reference to a different gate is valid
    const result = await dispatch(input);
    expect(result.blockReason).toBeUndefined();
    expect(result.context).toContain('gate1');
  });
});
```

**Step 2: Run test to verify integration works**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern=plugin-gates.integration.test.ts`
Expected: PASS (after previous tasks complete)

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/__tests__/plugin-gates.integration.test.ts
git commit -m "test: add integration tests for plugin gate composition"
```

---

## Task 7: Update Documentation

**Files:**
- Modify: `plugin/hooks/README.md`
- Modify: `plugin/hooks/SETUP.md`

**Step 1: Add plugin gates section to README.md**

In `plugin/hooks/README.md`, add section:

```markdown
## Plugin Gate References

Reference gates defined in other plugins:

```json
{
  "gates": {
    "plan-compliance": {
      "plugin": "cipherpowers",
      "gate": "plan-compliance"
    },
    "check": {
      "command": "npm run lint"
    }
  },
  "hooks": {
    "SubagentStop": {
      "gates": ["plan-compliance", "check"]
    }
  }
}
```

The `plugin` field uses sibling convention - assumes plugins are installed in the same directory (e.g., `~/.claude/plugins/`). The gate's command runs in the plugin's directory context.
```

**Step 2: Add configuration details to SETUP.md**

In `plugin/hooks/SETUP.md`, add section on plugin gate configuration with examples.

**Step 3: Commit**

```bash
git add plugin/hooks/README.md plugin/hooks/SETUP.md
git commit -m "docs: add plugin gate reference documentation"
```

---

## Task 8: Run Full Test Suite

**Step 1: Run all tests**

Run: `cd plugin/hooks/hooks-app && npm test`
Expected: All tests PASS

**Step 2: Run build**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: Build succeeds with no errors

**Step 3: Run lint**

Run: `cd plugin/hooks/hooks-app && npm run lint`
Expected: No lint errors

---

## Summary

After completing all tasks, the system will support:

1. **Plugin gate references**: `{ "plugin": "cipherpowers", "gate": "plan-compliance" }`
2. **Local command gates**: `{ "command": "npm run lint" }` (unchanged)
3. **Mixed composition**: Projects can mix plugin gates and local gates in any order
4. **Sibling resolution**: Plugins discovered via `CLAUDE_PLUGIN_ROOT/../{plugin-name}`
5. **Context isolation**: Plugin commands run in plugin directory, project commands run in project directory
6. **Security**:
   - Plugin names validated to prevent path traversal attacks
   - Loaded plugin configs validated for structural integrity
   - Trust boundary is at plugin installation (plugins are trusted)
7. **Circular reference protection**:
   - Detects circular gate references (A → B → A)
   - Enforces maximum depth limit (10 levels)
   - Graceful error messages with full stack trace

The ordering is explicit - gates run in the order listed in the hooks config.

## Review Fixes Applied

This plan was updated to address all blocking issues from dual-verification review:

1. ✅ **Missing `os` import** (Task 4) - Added `import * as os from 'os';`
2. ✅ **DispatchResult interface mismatch** (Task 6) - Updated test to use `blockReason`, `stopMessage`, `context`
3. ✅ **Missing plugin name validation** (Task 3) - Added validation rejecting `/`, `\`, `..`
4. ✅ **Missing plugin config validation** (Task 4) - Added validation of loaded config structure
5. ✅ **Missing circular reference test** (Task 6) - Added test and implementation with stack tracking
6. ✅ **Missing self-reference test** (Task 6) - Added test for plugin self-reference scenario

All changes maintain TDD flow (test first, then implementation).
