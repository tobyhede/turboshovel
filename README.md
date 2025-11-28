# Turboshovel

![Turboshovel Logo](turboshovel.png)

Generic hook framework for Claude Code providing:
- Automatic context injection via `.claude/context/` files
- Configurable quality gates (check, test, build)
- Keyword-triggered execution
- TypeScript gate extensibility
- Session state tracking

## History

Turboshovel was extracted from the [cipherpowers](https://github.com/cipherpowers/cipherpowers) project as a standalone, generic hook framework. The original implementation was tightly coupled to cipherpowers workflows; this extraction makes the hook framework reusable for any Claude Code project.

## Quick Start

1. Install from local path: `claude plugins install /path/to/turboshovel`
2. Create `.claude/gates.json` with your commands
3. Optional: Add context files to `.claude/context/`

Note: For marketplace installation (once published), use: `claude plugins install turboshovel`

## Documentation

See `plugin/hooks/` for detailed documentation:
- [README.md](plugin/hooks/README.md) - Quick start
- [SETUP.md](plugin/hooks/SETUP.md) - Configuration guide
- [ARCHITECTURE.md](plugin/hooks/ARCHITECTURE.md) - System design
- [CONVENTIONS.md](plugin/hooks/CONVENTIONS.md) - Context file patterns
- [TYPESCRIPT.md](plugin/hooks/TYPESCRIPT.md) - Custom TypeScript gates
