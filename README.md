# Turboshovel

**Automate context and enforce quality.**

Turboshovel is a Claude Code plugin that turns your documentation into active agent instructions. It injects context when it matters and enforces quality checks before code is committed.

## Features

### 🧠 Context Injection
**Teach your agent your project rules automatically.**
Simply create markdown files in `.claude/context/` and they will be injected into the agent's context exactly when needed—when a session starts, when a command runs, or when a tool is used.
*Zero configuration required.*

### 🛡️ Quality Gates
**Prevent mistakes with automatic checks.**
Configure gates to run linting, testing, or custom scripts. Block the agent from proceeding if quality checks fail.


## Installation

### Plugin
```bash
claude plugin marketplace add tobyhede/turboshovel
claude plugin install turboshovel@turboshovel
```

### Rundown CLI (Optional - for guided workflows)
Turboshovel integrates with the [Rundown CLI](https://github.com/tobyhede/rundown) for guided workflow execution:
```bash
npm install -g @rundown/cli
```

## Quick Start

### 1. Onboard Your Agent (Context Injection)
Teach the agent about your project immediately when a session starts.

```bash
mkdir -p .claude/context

# Create session start context
cat > .claude/context/session-start.md << 'EOF'
## Project Guidelines
- We use TypeScript strict mode.
- Prefer functional components for React.
- Run tests before implementing features.
EOF
```
*Now, every time you start a session, the agent knows the rules.*

### 2. Add Safety Nets (Quality Gates)
Ensure the agent doesn't break the build.

**Create configuration:**
```bash
# .claude/turboshovel.json
{
  "gates": {
    "test": {
      "command": "npm test",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "SubagentStop": {
      "gates": ["test"]
    }
  }
}
```
*Now, the agent cannot finish a sub-task if tests fail.*


## Documentation

- **[SETUP.md](SETUP.md)** - full configuration guide for gates and hooks.
- **[CONVENTIONS.md](CONVENTIONS.md)** - context file naming conventions.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - deep dive into how Turboshovel works.
- **[TYPESCRIPT.md](TYPESCRIPT.md)** - custom TypeScript gates.

## Examples
Check the `examples/` directory for ready-to-use configurations:
- `examples/context/` - Example context files.
- `examples/strict.json` - Strict quality gate configuration.

## License
MIT
