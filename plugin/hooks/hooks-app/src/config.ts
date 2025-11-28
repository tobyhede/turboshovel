// plugin/hooks/hooks-app/src/config.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { GatesConfig, HookConfig, GateConfig } from './types';
import { fileExists } from './utils';
import { logger } from './logger';

const KNOWN_HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'SubagentStop',
  'UserPromptSubmit',
  'SlashCommandStart',
  'SlashCommandEnd',
  'SkillStart',
  'SkillEnd',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'Notification'
];

const KNOWN_ACTIONS = ['CONTINUE', 'BLOCK', 'STOP'];

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

/**
 * Validate config invariants to catch configuration errors early.
 * Throws descriptive errors when invariants are violated.
 */
export function validateConfig(config: GatesConfig): void {
  // Invariant: Hook event names must be known types
  for (const hookName of Object.keys(config.hooks)) {
    if (!KNOWN_HOOK_EVENTS.includes(hookName)) {
      throw new Error(
        `Unknown hook event: ${hookName}. Must be one of: ${KNOWN_HOOK_EVENTS.join(', ')}`
      );
    }
  }

  // Invariant: Gates referenced in hooks must exist in gates config
  for (const [hookName, hookConfig] of Object.entries(config.hooks)) {
    if (hookConfig.gates) {
      for (const gateName of hookConfig.gates) {
        if (!config.gates[gateName]) {
          throw new Error(`Hook '${hookName}' references undefined gate '${gateName}'`);
        }
      }
    }
  }

  // Invariant: Gate actions must be CONTINUE/BLOCK/STOP or reference existing gates
  for (const [gateName, gateConfig] of Object.entries(config.gates)) {
    // Validate gate structure first
    validateGateConfig(gateName, gateConfig);

    for (const action of [gateConfig.on_pass, gateConfig.on_fail]) {
      if (action && !KNOWN_ACTIONS.includes(action) && !config.gates[action]) {
        throw new Error(
          `Gate '${gateName}' action '${action}' is not CONTINUE/BLOCK/STOP or valid gate name`
        );
      }
    }
  }
}

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

/**
 * Get the plugin root directory from CLAUDE_PLUGIN_ROOT env var.
 * Falls back to computing relative to this file's location.
 */
function getPluginRoot(): string | null {
  const envRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (envRoot) {
    return envRoot;
  }

  // Fallback: compute from this file's location
  // This file is at: plugin/hooks/hooks-app/src/config.ts (dev)
  // Or at: plugin/hooks/hooks-app/dist/config.js (built)
  // Plugin root is: plugin/
  try {
    return path.resolve(__dirname, '..', '..', '..');
  } catch {
    return null;
  }
}

/**
 * Load a single config file
 */
export async function loadConfigFile(configPath: string): Promise<GatesConfig | null> {
  if (await fileExists(configPath)) {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  }
  return null;
}

/**
 * Merge two configs. Project config takes precedence over plugin config.
 * - hooks: project hooks override plugin hooks for same event
 * - gates: project gates override plugin gates for same name
 */
function mergeConfigs(pluginConfig: GatesConfig, projectConfig: GatesConfig): GatesConfig {
  return {
    hooks: {
      ...pluginConfig.hooks,
      ...projectConfig.hooks
    },
    gates: {
      ...pluginConfig.gates,
      ...projectConfig.gates
    }
  };
}

/**
 * Load and merge project and plugin configs.
 *
 * Priority:
 * 1. Project: .claude/gates.json (highest)
 * 2. Project: gates.json
 * 3. Plugin: ${CLAUDE_PLUGIN_ROOT}/hooks/gates.json (fallback/defaults)
 *
 * Configs are MERGED - project overrides plugin for same keys.
 */
export async function loadConfig(cwd: string): Promise<GatesConfig | null> {
  const pluginRoot = getPluginRoot();

  // Load plugin config first (defaults)
  let mergedConfig: GatesConfig | null = null;

  if (pluginRoot) {
    const pluginConfigPath = path.join(pluginRoot, 'hooks', 'gates.json');
    const pluginConfig = await loadConfigFile(pluginConfigPath);
    if (pluginConfig) {
      await logger.debug('Loaded plugin gates.json', { path: pluginConfigPath });
      mergedConfig = pluginConfig;
    }
  }

  // Load project config (overrides)
  const projectPaths = [
    path.join(cwd, '.claude', 'gates.json'),
    path.join(cwd, 'gates.json')
  ];

  for (const configPath of projectPaths) {
    const projectConfig = await loadConfigFile(configPath);
    if (projectConfig) {
      await logger.debug('Loaded project gates.json', { path: configPath });
      if (mergedConfig) {
        mergedConfig = mergeConfigs(mergedConfig, projectConfig);
        await logger.debug('Merged project config with plugin config');
      } else {
        mergedConfig = projectConfig;
      }
      break; // Only load first project config found
    }
  }

  // Validate merged config
  if (mergedConfig) {
    validateConfig(mergedConfig);
  }

  return mergedConfig;
}
