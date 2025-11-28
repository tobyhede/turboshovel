# CLAUDE.md

Turboshovel is a Claude Code plugin providing a generic hook framework for quality enforcement and context injection.

## Features

- **Quality Gates**: Automatically enforce project checks (lint, test, build) at hook points (PostToolUse, SubagentStop, UserPromptSubmit)
- **Context Injection**: Convention-based `.claude/context/{name}-{stage}.md` files auto-inject into conversations
- **Keyword Triggers**: Gates automatically fire based on conversation keywords
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
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["check"]
    }
  }
}
```

## Development Commands

- Build: `cd plugin/hooks/hooks-app && npm run build`
- Test: `cd plugin/hooks/hooks-app && npm test`
- Lint: `cd plugin/hooks/hooks-app && npm run lint`

## Architecture

See plugin/hooks/ARCHITECTURE.md for system design.

## Environment Variables

- `TURBOSHOVEL_LOG=0` - Disable logging (enabled by default)
- `TURBOSHOVEL_LOG_LEVEL=debug|info|warn|error` - Set log verbosity (default: info)

## Documentation

- [README.md](plugin/hooks/README.md) - Quick start and examples
- [SETUP.md](plugin/hooks/SETUP.md) - Configuration guide
- [CONVENTIONS.md](plugin/hooks/CONVENTIONS.md) - Context file patterns
- [TYPESCRIPT.md](plugin/hooks/TYPESCRIPT.md) - Custom TypeScript gates
