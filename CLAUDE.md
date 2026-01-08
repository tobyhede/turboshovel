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

Create `.claude/turboshovel.json` with your project commands:

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

**This project uses Jest for testing. Do NOT use Vitest.**

From repository root:

```bash
npm run build      # Build all packages
npm run test       # Run all tests (Jest)
npm run lint       # Lint all packages
npm run lint:fix   # Auto-fix lint issues
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for full development guide.

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

## Rundown System

Execute multi-step processes with state tracking. Workflow orchestration is handled by the external `rundown` CLI.

### Installation

Install rundown CLI globally:

```bash
npm install -g @rundown/cli
```

### Commands

```bash
rundown run <file>     # Run a runbook
rundown pass           # Mark current step as passed
rundown fail           # Mark current step as failed
rundown goto <n>       # Jump to specific step number
rundown status         # Show current state
rundown stop           # Abort runbook
rundown complete       # Mark complete
rundown stash          # Pause enforcement
rundown pop            # Resume enforcement
rundown ls             # List active runbooks
rundown ls --all       # List available runbook files
rundown check <file>   # Check runbook for errors
```

### Turboshovel CLI

Turboshovel CLI provides quality gates functionality:

```bash
turboshovel gate <name>  # Run a gate from config
```

### State Persistence

State persists in `.claude/rundown/runbooks/` (workflow files) and `.claude/rundown/session.json` (active workflow tracking). Both survive context clears.

### Command Execution

When runbooks auto-execute bash code blocks:
- **Working directory**: Project root (where `rundown run` was invoked)
- **Result**: Exit code only (0 = pass, non-zero = fail)
- **Timeout**: None (for long commands, use `--prompted` flag)
- **stderr**: Diagnostic only, doesn't affect pass/fail

## Commands

- `/turboshovel:verify` - Verify with consensus-based collation

## Documentation

- [README.md](README.md) - Quick start and examples
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development setup and commands
- [SETUP.md](SETUP.md) - Configuration guide
- [CONVENTIONS.md](CONVENTIONS.md) - Context file patterns
- [TYPESCRIPT.md](TYPESCRIPT.md) - Custom TypeScript gates
