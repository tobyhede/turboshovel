# Turboshovel

**Automate context, enforce quality, and guide agents.**

Turboshovel is a Claude Code plugin that turns your documentation into active agent instructions. It injects context when it matters, enforces quality checks before code is committed, and guides agents through complex workflows.

## Features

### 🧠 Context Injection
**Teach your agent your project rules automatically.**
Simply create markdown files in `.claude/context/` and they will be injected into the agent's context exactly when needed—when a session starts, when a command runs, or when a tool is used.
*Zero configuration required.*

### 📋 Guided Workflows
**Keep agents on track with executable plans.**
Define step-by-step workflows in simple Markdown. Turboshovel enforces the process, ensuring no steps are skipped and criteria are met before moving forward.

### 🛡️ Quality Gates
**Prevent mistakes with automatic checks.**
Configure gates to run linting, testing, or custom scripts. Block the agent from proceeding if quality checks fail.

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

### 2. Guide the Agent (Workflows)
Use a workflow to guide the agent through a standard process.

**Create a workflow file:**
```markdown
# .claude/workflows/feature.workflow.md

## 1. Plan
Create an implementation plan.
- PASS: CONTINUE

## 2. Implement
Write the code.
- PASS: CONTINUE

## 3. Verify
Run tests.
- PASS: DONE
```

**Run the workflow:**
```bash
tsv run feature.workflow.md
```

### 3. Add Safety Nets (Quality Gates)
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

## Installation

### Plugin (Required for Context & Gates)
```bash
claude plugin marketplace add tobyhede/turboshovel
claude plugin install turboshovel@turboshovel
```

### CLI (Required for Workflows)
```bash
npm install -g @turboshovel/cli
```

## Documentation

- **[WORKFLOWS.md](docs/WORKFLOWS.md)** - detailed guide to creating and running workflows.
- **[SETUP.md](SETUP.md)** - full configuration guide for gates and hooks.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - deep dive into how Turboshovel works.
- **[VERIFICATION.md](docs/VERIFICATION.md)** - guide to the "Verify by Consensus" skill.

## Examples
Check the `examples/` directory for ready-to-use configurations and workflows:
- `examples/workflows/simple.workflow.md` - Minimal workflow.
- `examples/context/` - Example context files.
- `examples/strict.json` - Strict quality gate configuration.

## License
MIT