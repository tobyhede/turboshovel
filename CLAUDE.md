# CLAUDE.md

Turboshovel is a Claude Code plugin providing a generic hook framework for quality enforcement and context injection.

## Features

- **Quality Gates**: Automatically enforce project checks (lint, test, build) at hook points (PostToolUse, SubagentStop, UserPromptSubmit)
- **Context Injection**: Convention-based `.claude/context/{name}-{stage}.md` files auto-inject into conversations
- **Keyword Triggers**: Gates automatically fire based on conversation keywords
- **File Pattern Filtering**: Run gates only for specific files/directories (perfect for monorepos)
- **Session Tracking**: Session state persists across hook invocations
- **TypeScript Gates**: Custom gates via TypeScript for complex logic

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

## Development Commands

- Build: `cd plugin/core && npm run build`
- Test: `cd plugin/core && npm test`
- Lint: `cd plugin/core && npm run lint`

## Architecture

See ARCHITECTURE.md for system design.

## Environment Variables

- `TURBOSHOVEL_LOG=0` - Disable logging (enabled by default)
- `TURBOSHOVEL_LOG_LEVEL=debug|info|warn|error` - Set log verbosity (default: info)

## Multi-Plugin Configuration

When using turboshovel alongside other Claude Code plugins (like cipherpowers), **do not** set `CLAUDE_PLUGIN_ROOT` in your project's `.claude/settings.local.json`.

**Incorrect** (breaks multi-plugin support):
```json
{
  "env": {
    "CLAUDE_PLUGIN_ROOT": "/path/to/some/plugin"
  }
}
```

**Correct** (let Claude Code handle paths automatically):
```json
{
  "enabledPlugins": {
    "turboshovel@turboshovel": true,
    "other-plugin@marketplace": true
  }
}
```

Claude Code automatically sets `${CLAUDE_PLUGIN_ROOT}` to the correct path for each plugin during hook execution. Project-level overrides break this mechanism.

## Workflow System

Execute multi-step processes with state tracking:

- `workflow start <file>` - Start workflow
- `workflow next` - Advance to next task (use `--step N` to jump to specific step)
- `workflow next --fail` - Signal task failure, evaluate FAIL condition (RETRY/STOP/GOTO)
- `workflow complete` - Mark workflow as complete
- `workflow status` - Show current state
- `workflow stop` - Abort workflow
- `workflow list` - List all workflows (active and inactive)
- `workflow stash` - Pause workflow enforcement for ad-hoc work
- `workflow pop` - Resume workflow enforcement

State persists in `.claude/turboshovel/workflows/` (workflow files) and `.claude/turboshovel/session.json` (active workflow tracking). Both survive context clears.

### CLI Access

The `workflow` command is part of the plugin but not globally installed. Access options:

```bash
# Option 1: Full path (always works)
node /path/to/plugin/core/dist/cli/workflow-cli.js <command>

# Option 2: npm link (for development)
cd plugin/core && npm link
workflow status  # Now works globally

# Option 3: Shell alias
alias workflow='node /path/to/plugin/core/dist/cli/workflow-cli.js'
```

## Commands

- `/turboshovel:verify` - N-Verification with consensus-based collation

## Documentation

- [README.md](README.md) - Quick start and examples
- [SETUP.md](SETUP.md) - Configuration guide
- [CONVENTIONS.md](CONVENTIONS.md) - Context file patterns
- [TYPESCRIPT.md](TYPESCRIPT.md) - Custom TypeScript gates
