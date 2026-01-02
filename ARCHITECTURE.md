# Hook System Architecture

The Turboshovel hook system is a **self-referential TypeScript application** that uses its own configuration format to define default behaviors. The plugin is built on itself.

## Core Concept

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Claude Code Hook Event                          │
│         (PostToolUse, SubagentStop, UserPromptSubmit, etc.)            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          hooks.json Registration                         │
│              Routes ALL hook events to TypeScript CLI                    │
│         node ${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           TypeScript CLI                                 │
│                     plugin/core/src/cli.ts                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────┐
│      Context Injection        │   │         Config Loading             │
│  (PRIMARY - always runs)      │   │   (loads + merges gates.json)     │
│                               │   │                                   │
│  Project .claude/context/     │   │  1. Plugin gates.json (defaults)  │
│                               │   │  2. Project gates.json (override) │
└───────────────────────────────┘   └───────────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────────────┐
                                    │          Gate Execution            │
                                    │                                   │
                                    │  Shell command gates (command:)   │
                                    │  TypeScript gates (no command:)   │
                                    └───────────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────────────┐
                                    │          Action Handling           │
                                    │                                   │
                                    │  CONTINUE → proceed               │
                                    │  BLOCK → prevent agent action     │
                                    │  STOP → halt Claude entirely      │
                                    │  {gate} → chain to another gate   │
                                    └───────────────────────────────────┘
```

## Self-Referential Design

The hook system uses **its own turboshovel.json** to configure default behaviors:

```
plugin/turboshovel.json                ← Plugin defaults (TypeScript gates)
        ↓ merged with
.claude/turboshovel.json               ← Project overrides (user configuration)
        ↓
Merged Configuration             ← Project takes precedence
```

### Plugin turboshovel.json

```json
{
  "gates": {
    "plugin-path": {
      "description": "Verify plugin path resolution in subagents",
      "on_pass": "CONTINUE",
      "on_fail": "CONTINUE"
    },
    "check": {
      "description": "Run project quality checks",
      "keywords": ["lint", "check", "format"],
      "command": "echo '[PLACEHOLDER] Configure with actual command'",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "UserPromptSubmit": {
      "gates": ["check"]
    }
  }
}
```

**TypeScript gates** have no `command` field - they're implemented in `src/gates/`.

**Shell command gates** have a `command` field - they execute shell commands.

## Directory Structure

```
plugin/
├── hooks.json                  # Hook registration (routes to CLI)
├── turboshovel.json            # Plugin default gates configuration
└── core/
    └── src/
        ├── cli.ts              # Entry point
        ├── dispatcher.ts       # Main dispatch logic
        ├── context.ts          # Context file discovery/injection
        ├── config.ts           # Config loading/merging
        ├── gate-loader.ts      # Gate execution
        ├── action-handler.ts   # Action processing
        ├── session.ts          # Session state management
        ├── logger.ts           # Debug logging
        ├── schemas.ts          # Zod validation schemas
        ├── types.ts            # TypeScript interfaces
        ├── errors.ts           # Custom error types
        ├── utils.ts            # Utility functions
        ├── cli/                # CLI subcommands
        │   └── workflow-cli.ts # Workflow CLI entry point
        ├── gates/              # Built-in TypeScript gates
        │   ├── index.ts        # Gate registry
        │   └── plugin-path.ts
        └── workflow/           # Workflow system
            ├── index.ts        # Workflow exports
            ├── state.ts        # Workflow state management
            ├── types.ts        # Workflow type definitions
            ├── context.ts      # Workflow context injection
            ├── compiler.ts     # XState Machine compiler
            ├── step-id.ts      # Step ID parsing
            ├── parser/         # Workflow file parsing
            │   ├── index.ts
            │   ├── parser.ts
            │   ├── helpers.ts
            │   └── types.ts
            └── hooks/          # Workflow hook handlers
                ├── index.ts
                ├── subagent-start.ts
                ├── subagent-stop.ts
                └── step-tracker.ts
    └── dist/                   # Compiled JavaScript output

examples/                       # Project root examples
├── context/                    # Example context files
├── strict.json                 # Example: strict mode
├── permissive.json             # Example: warn only
└── pipeline.json               # Example: gate chaining
```

## Execution Flow

### 1. Hook Event Received

Claude Code fires a hook event (e.g., `UserPromptSubmit`). The `hooks.json` routes it to the TypeScript CLI:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js"
      }]
    }]
  }
}
```

### 2. Context Injection (Primary Behavior)

**Always runs first.** Discovers and injects markdown content from **project context**:

- `.claude/context/{name}-{stage}.md`
- `.claude/context/slash-command/{name}-{stage}.md`
- `.claude/context/skill/{name}-{stage}.md`

Context files are discovered from your project's `.claude/context/` directory following the naming conventions.

### 3. Config Loading and Merging

Loads both configs and merges them:

```typescript
// Load plugin defaults first
const pluginConfig = await loadConfigFile(`${CLAUDE_PLUGIN_ROOT}/turboshovel.json`);

// Load project overrides
const projectConfig = await loadConfigFile('.claude/turboshovel.json');

// Merge: project overrides plugin
const mergedConfig = {
  hooks: { ...pluginConfig.hooks, ...projectConfig.hooks },
  gates: { ...pluginConfig.gates, ...projectConfig.gates }
};
```

### 4. Gate Execution

For each gate in the hook's `gates` array:

**TypeScript Gate** (no `command` field):
```typescript
// Gate name maps to module: "plugin-path" → gates/plugin-path.ts
const gates = await import('./gates');
const result = await gates.pluginPath.execute(input);
```

**Shell Command Gate** (has `command` field):
```typescript
const { stdout, stderr } = await exec(gateConfig.command, { cwd });
```

### 5. Action Handling

Based on gate result and `on_pass`/`on_fail` configuration:

- **CONTINUE**: Proceed to next gate or complete
- **BLOCK**: Return block decision to Claude Code
- **STOP**: Return stop signal to halt Claude
- **{gate_name}**: Chain to another gate

### Gate Chain Limit

To prevent infinite loops from misconfigured gate chains, there is a circuit breaker limit of **10 gates per dispatch** (`MAX_GATES_PER_DISPATCH`).

If a gate chain exceeds this limit, execution stops with a block reason indicating the maximum depth was exceeded. Check your gate configuration for circular references if you encounter this error.

## Supported Hook Events

All 11 registered Claude Code hook types are supported:

| Event | Context Pattern | Description |
|-------|----------------|-------------|
| `SessionStart` | `session-start.md` | Beginning of Claude session |
| `SessionEnd` | `session-end.md` | End of Claude session |
| `UserPromptSubmit` | `prompt-submit.md` | User submits prompt |
| `SubagentStart` | `{agent}-start.md` | Agent begins |
| `SubagentStop` | `{agent}-end.md` | Agent completes |
| `PreToolUse` | `{tool}-pre.md` | Before tool executes |
| `PostToolUse` | `{tool}-post.md` | After tool executes |
| `Stop` | `agent-stop.md` | Agent stops |
| `Notification` | `notification-receive.md` | Notification received |
| `PreCompact` | `pre-compact.md` | Before context compaction |
| `PermissionRequest` | `permission-request.md` | Permission dialog |

**Note:** SessionStart fires at the beginning of each Claude Code session and injects context from `session-start.md`.

**Planned hooks (not yet registered):** SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd.

## TypeScript Gates

Gates without a `command` field are TypeScript gates. They're implemented in `src/gates/` and export an `execute` function:

```typescript
// src/gates/commands.ts
import { HookInput, GateResult } from '../types';

export async function execute(input: HookInput): Promise<GateResult> {
  // Gate logic here
  return {
    additionalContext: '...'  // Inject content
    // or
    decision: 'block',
    reason: '...'             // Block execution
    // or
    continue: false,
    message: '...'            // Stop Claude
  };
}
```

Register in `src/gates/index.ts`:
```typescript
export * as pluginPath from './plugin-path';
```

Gate name maps to export: `"plugin-path"` → `gates.pluginPath.execute()`

## Configuration Merging

**Project configuration overrides plugin configuration at the key level:**

```json
// Plugin turboshovel.json (defaults)
{
  "hooks": {
    "UserPromptSubmit": { "gates": ["check"] },
    "PostToolUse": { "gates": ["check"] }
  },
  "gates": {
    "plugin-path": { "on_pass": "CONTINUE" },
    "check": { "command": "echo placeholder" }
  }
}

// Project .claude/turboshovel.json (overrides)
{
  "hooks": {
    "PostToolUse": { "gates": ["lint", "test"] }  // Replaces plugin's PostToolUse
  },
  "gates": {
    "check": { "command": "npm run lint" },       // Replaces plugin's check
    "lint": { "command": "eslint ." },            // New gate
    "test": { "command": "npm test" }             // New gate
  }
}

// Merged result
{
  "hooks": {
    "UserPromptSubmit": { "gates": ["check"] },    // From plugin
    "PostToolUse": { "gates": ["lint", "test"] }   // From project (replaced)
  },
  "gates": {
    "plugin-path": { "on_pass": "CONTINUE" },      // From plugin
    "check": { "command": "npm run lint" },        // From project (replaced)
    "lint": { "command": "eslint ." },             // From project (new)
    "test": { "command": "npm test" }              // From project (new)
  }
}
```

## Session State

The hook system maintains two separate session state mechanisms:

### Hook Session State

Cross-hook coordination state for context tracking:

```typescript
interface SessionState {
  session_id: string;           // Unique session ID
  started_at: string;           // ISO timestamp
  active_command: string | null; // Current slash command
  active_skill: string | null;   // Current skill
  edited_files: string[];        // Files modified this session
  file_extensions: string[];     // Extensions edited
  metadata: Record<string, any>; // Custom data
}
```

State persists in `.claude/session/state.json`.

### Workflow Session State

Active workflow tracking (separate from hook session):

State persists in `.claude/turboshovel/session.json` and tracks:
- Active workflow ID
- Stashed workflow ID (for paused enforcement)
- Current step
- Workflow variables

**Workflow stashing:** Use `tsv stash` to pause enforcement for ad-hoc work, then `tsv pop` to resume. When stashed, workflow hooks pass through silently without enforcing step prefixes.

**Important:** These are two distinct session mechanisms:
- **Hook session** (`.claude/session/state.json`) - tracks active commands, edited files, etc.
- **Workflow session** (`.claude/turboshovel/session.json`) - tracks active workflow state

## Logging

All hook invocations are logged to `$TMPDIR/turboshovel/hooks-YYYY-MM-DD.log`:

```bash
# View logs
tail -f $(node plugin/core/dist/cli.js log-path)

# Or use mise task
mise run logs
```

Log entries include:
- Hook event type
- Config file paths loaded
- Gate execution results
- Action handling decisions
- Timing information

## Benefits of Self-Referential Design

1. **Dogfooding**: Plugin uses its own infrastructure
2. **Consistent Patterns**: Same config format for plugin and projects
3. **Testable**: TypeScript gates are unit-testable
4. **Debuggable**: Standard TypeScript tooling works
5. **Extensible**: Add new TypeScript gates, projects can override
6. **Type-Safe**: Full TypeScript type checking
