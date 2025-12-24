# Turboshovel Plugin Architecture Analysis

## Overview

Turboshovel is a self-referential TypeScript plugin for Claude Code that provides a generic hook framework for quality enforcement and context injection. The system is "self-referential" because it uses its own gates.json configuration format to define its default behaviors.

## 1. Gate Loading Mechanism

### Current Configuration Loading

**Location**: `plugin/hooks/hooks-app/src/config.ts`

The system implements a **two-source configuration merge pattern**:

1. **Plugin defaults** (fallback):
   - `${CLAUDE_PLUGIN_ROOT}/hooks/gates.json`

2. **Project overrides** (highest priority):
   - `.claude/gates.json` (checked first)
   - `gates.json` (fallback if .claude/gates.json not found)

**Merge Strategy**:
```typescript
function mergeConfigs(pluginConfig: GatesConfig, projectConfig: GatesConfig): GatesConfig {
  return {
    hooks: { ...pluginConfig.hooks, ...projectConfig.hooks },
    gates: { ...pluginConfig.gates, ...projectConfig.gates }
  };
}
```

- **Hooks**: Project hooks replace plugin hooks for same event name
- **Gates**: Project gates override plugin gates with same name
- **Result**: Project configuration always takes precedence at key level

### Configuration Structure

**GatesConfig Interface**:
```typescript
interface GatesConfig {
  hooks: Record<string, HookConfig>;
  gates: Record<string, GateConfig>;
}
```

**GateConfig Interface**:
```typescript
interface GateConfig {
  command?: string;              // Shell command gate (optional)
  keywords?: string[];           // Trigger keywords (UserPromptSubmit only)
  on_pass?: string;              // CONTINUE | BLOCK | STOP | {gate_name}
  on_fail?: string;              // CONTINUE | BLOCK | STOP | {gate_name}
}
```

**HookConfig Interface**:
```typescript
interface HookConfig {
  enabled_tools?: string[];      // PostToolUse filtering
  enabled_agents?: string[];     // SubagentStop filtering
  gates?: string[];              // Gate chain to execute
}
```

### Validation

**Location**: `config.ts::validateConfig()`

Validates configuration invariants:
1. Hook event names must be known types (PostToolUse, SubagentStop, UserPromptSubmit, etc.)
2. Gates referenced in hooks must exist in gates config
3. Gate actions must be CONTINUE/BLOCK/STOP or reference existing gates

## 2. Hook System Processing

### Supported Hook Events (12 types)

All of Claude Code's hook events are supported:
- `SessionStart`, `SessionEnd`
- `UserPromptSubmit`
- `SlashCommandStart`, `SlashCommandEnd`
- `SkillStart`, `SkillEnd`
- `PreToolUse`, `PostToolUse`
- `SubagentStop`
- `Stop`
- `Notification`

### Dispatch Flow

**Location**: `plugin/hooks/hooks-app/src/dispatcher.ts` → `dispatch()` function

**Execution sequence**:

1. **Update Session State** (best-effort)
   - Tracks active_command, active_skill, edited_files, file_extensions
   - Stores in `.claude/session/state.json`
   - Errors don't fail the hook

2. **Context Injection** (PRIMARY - always runs first)
   - Discovers and injects markdown from `.claude/context/{name}-{stage}.md`
   - Falls back to plugin context files
   - Pattern varies by hook type

3. **Load Configuration**
   - Loads and merges plugin + project gates.json
   - Gracefully degrades if no config found

4. **Check Hook Configuration**
   - Looks up hook event in merged config
   - Returns if not configured

5. **Filter by Enabled Lists**
   - PostToolUse: filters by `enabled_tools`
   - SubagentStop: filters by `enabled_agents`
   - Others: no filtering

6. **Execute Gates**
   - Runs gates sequentially (not parallel)
   - Keyword matching for UserPromptSubmit only
   - Circuit breaker: max 10 gates per dispatch

7. **Handle Actions**
   - Determines action from gate result + on_pass/on_fail
   - Continues or breaks based on action

### Gate Matching and Filtering

**Keyword Matching** (UserPromptSubmit only):
- Gates without keywords always run (backward compatible)
- Matches using substring (not word-boundary)
- Example: "test" matches "latest", "contest", "testing"

**Enabled Lists**:
- PostToolUse: `enabled_tools` array (e.g., ["Edit", "Write"])
- SubagentStop: `enabled_agents` array (empty = all agents)

### Session State Tracking

**Location**: `plugin/hooks/hooks-app/src/session.ts` → `Session` class

**State stored in**: `.claude/session/state.json`

**SessionState interface**:
```typescript
interface SessionState {
  session_id: string;                    // Timestamp-based ID
  started_at: string;                    // ISO 8601 timestamp
  active_command: string | null;         // From SlashCommandStart
  active_skill: string | null;           // From SkillStart
  edited_files: string[];                // From PostToolUse
  file_extensions: string[];             // From PostToolUse
  metadata: Record<string, any>;         // Custom data
}
```

**State Updates**:
- SlashCommandStart/End: updates active_command
- SkillStart/End: updates active_skill
- PostToolUse: appends edited_files, tracks file_extensions
- Atomic file writes prevent corruption

## 3. Plugin Discovery and Composition

### Plugin Entry Point

**Location**: `plugin/hooks/hooks.json`

Routes all hook events to the TypeScript CLI:
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js"
      }]
    }],
    // ... (similar for SubagentStop, UserPromptSubmit, SessionStart)
  }
}
```

**Design**: All hooks route through single CLI entry point (cli.ts) which dispatches internally.

### Gate Types

**Two gate execution models**:

1. **Shell Command Gates** (has `command` field)
   - Execute arbitrary shell commands
   - Success = exit code 0
   - Timeout: 30 seconds (configurable)
   - Output captured for context injection

2. **TypeScript Gates** (no `command` field)
   - Implemented in `src/gates/` directory
   - Export `execute(input: HookInput): Promise<GateResult>`
   - Registered in `src/gates/index.ts`
   - Name mapping: kebab-case → camelCase (plugin-path → pluginPath)

### Built-in TypeScript Gates

**Location**: `plugin/hooks/hooks-app/src/gates/`

Currently includes:
- **plugin-path**: Injects CLAUDE_PLUGIN_ROOT environment variable as context

**Gate Registry** (`src/gates/index.ts`):
```typescript
export * as pluginPath from './plugin-path';
```

## 4. Entry Points and Main Flow

### CLI Entry Point

**Location**: `plugin/hooks/hooks-app/src/cli.ts` → `main()` function

**Three modes**:

1. **Hook Dispatch Mode** (default)
   - Reads JSON from stdin
   - Calls dispatch()
   - Outputs JSON response
   - Handles BLOCK/STOP/context decisions

2. **Session Management Mode** (`session` subcommand)
   - `hooks-app session get <key> [cwd]`
   - `hooks-app session set <key> <value> [cwd]`
   - `hooks-app session append <key> <value> [cwd]`
   - `hooks-app session contains <key> <value> [cwd]`
   - `hooks-app session clear [cwd]`

3. **Diagnostic Mode**
   - `hooks-app log-path`: prints log file path
   - `hooks-app log-dir`: prints log directory

### Context Injection System

**Location**: `plugin/hooks/hooks-app/src/context.ts` → `injectContext()` function

**Convention-based file discovery**:

For most hooks, extracts name/stage from hook event:
- SlashCommandStart → { name: command, stage: 'start' }
- PostToolUse → { name: tool_name, stage: 'post' }
- etc.

**Search paths** (in priority order):
1. `.claude/context/{name}-{stage}.md` (project)
2. `.claude/context/slash-command/{name}-{stage}.md` (project subdir)
3. `.claude/context/slash-command/{name}/{stage}.md` (project nested)
4. `.claude/context/skill/{name}-{stage}.md` (project skill)
5. `.claude/context/skill/{name}/{stage}.md` (project skill nested)
6. `${CLAUDE_PLUGIN_ROOT}/context/{name}-{stage}.md` (plugin fallback, same variations)

**Special case - SubagentStop**:
- Uses agent-command scoping
- Pattern: `{agent}-{command}-{stage}.md` (most specific)
- Falls back to `{agent}-{stage}.md` (agent-only)
- Uses active_command/active_skill from session state

### Action Handling

**Location**: `plugin/hooks/hooks-app/src/action-handler.ts` → `handleAction()` function

**Action types**:

| Action | Behavior |
|--------|----------|
| `CONTINUE` | Proceed to next gate (return gate's additionalContext) |
| `BLOCK` | Block agent action, return blockReason to Claude Code |
| `STOP` | Stop Claude entirely, return stopMessage |
| `{gate_name}` | Chain to another gate (append to gates array) |

**Gate Chaining**:
- Allows conditional gate pipelines
- Example: format → check → test → build
- Format failure STOPs, others BLOCK on failure

## 5. Logging and Debugging

**Location**: `plugin/hooks/hooks-app/src/logger.ts`

**Log file**: `${TMPDIR}/turboshovel/hooks-YYYY-MM-DD.log`

**Environment variables**:
- `TURBOSHOVEL_LOG=1`: Enable logging
- `TURBOSHOVEL_LOG_LEVEL=debug|info|warn|error`: Set verbosity (default: info)

**Log format**: JSON lines (one JSON object per line)

**Special logging**:
- `logger.always()`: unconditional logging (startup diagnostics)
- `logger.event()`: structured event logging with timing

## 6. Multi-Source Configuration Support

### Current Support

**Existing**:
- Plugin gates.json (defaults at `${CLAUDE_PLUGIN_ROOT}/hooks/gates.json`)
- Project gates.json (overrides at `.claude/gates.json` or `gates.json`)
- Context files from project `.claude/context/` (overrides plugin context)

**Merge semantics**:
- Both config files are loaded
- Merged at top-level keys (hooks and gates objects)
- Project keys completely override plugin keys (not deep merge)

### No Additional Discovery Mechanisms

**Not supported**:
- Environment variable config sources
- Config files from multiple directories (only one project config loaded)
- Plugin composition (single plugin, not plugin chains)
- Multiple plugin directories

## Key Files Summary

### Configuration Files
- `plugin/hooks/hooks.json`: Hook registration (routes to CLI)
- `plugin/hooks/gates.json`: Plugin default gates
- `.claude/gates.json`: Project-specific gates (user override)

### TypeScript Implementation
- `src/cli.ts`: Entry point (hook input/output)
- `src/dispatcher.ts`: Main dispatch logic and flow control
- `src/config.ts`: Config loading and merging
- `src/gate-loader.ts`: Gate execution (shell and TypeScript)
- `src/context.ts`: Context file discovery and injection
- `src/action-handler.ts`: Action result processing
- `src/session.ts`: Session state persistence
- `src/logger.ts`: Debug logging system
- `src/types.ts`: TypeScript interfaces
- `src/gates/index.ts`: Gate registry
- `src/gates/plugin-path.ts`: Built-in gate example

### Context Files
- `plugin/hooks/context/`: Plugin-level context (fallback)
- `.claude/context/`: Project-level context (override)

### Examples
- `plugin/hooks/examples/permissive.json`: Warn-only mode
- `plugin/hooks/examples/strict.json`: Blocking mode
- `plugin/hooks/examples/convention-based.json`: Context + explicit gates
- `plugin/hooks/examples/pipeline.json`: Gate chaining pattern
