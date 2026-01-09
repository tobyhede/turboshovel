# Turboshovel

**Persistent Workflows for Claude Code**

Turboshovel is a Claude Code plugin that brings persistent, enforceable workflows to your agents. Define multi-step processes in Markdown runbooks, and Turboshovel ensures agents follow them—even across context clears.

## Features

### 💾 Persistent State
Workflow progress survives context clears. Resume interrupted tasks instantly. Never lose track of where you are.

### 🛡️ Process Enforcement
Enforce multi-step workflows with Rundown runbooks. Prevent agents from skipping steps or jumping around.

### ⚙️ Quality Gates
Run lint, test, build at workflow boundaries. Block agents when checks fail. Chain gates for complex pipelines.

### 🧠 Context Injection
Auto-inject context at runbook steps. Agents get focused, step-specific instructions exactly when needed.

## Installation

```bash
claude plugin add tobyhede/turboshovel
```

Turboshovel includes [Rundown](https://github.com/tobyhede/rundown) for workflow orchestration.

## Quick Start

### 1. Create a Runbook

Define your workflow in `.claude/rundown/runbooks/feature.runbook.md`:

```markdown
## 1. Create Plan
Design the implementation approach.
- PASS: CONTINUE
- FAIL: STOP

## 2. Implement Feature
Write the code following the plan.
- PASS: CONTINUE
- FAIL: RETRY 2

## 3. Run Tests
Verify everything works.
- PASS: COMPLETE
- FAIL: GOTO 2
```

### 2. Add Quality Gates

Create `.claude/turboshovel.json`:

```json
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

### 3. Run the Workflow

```bash
rundown run .claude/rundown/runbooks/feature.runbook.md
```

**How it works:**
- Runbook defines the workflow steps and transitions
- State persists in `.claude/rundown/session.json`
- Context clears? `rundown status` shows where you are
- Gates enforce quality at each step boundary

## CLI Commands

```bash
rundown run <file>     # Start a workflow
rundown pass           # Mark current step as passed
rundown fail           # Mark current step as failed
rundown goto <n>       # Jump to step number
rundown status         # Show current state
rundown stop           # Abort workflow
rundown complete       # Mark complete
rundown stash          # Pause enforcement
rundown pop            # Resume enforcement
```

## Documentation

- **[SETUP.md](SETUP.md)** - Full configuration guide
- **[CONVENTIONS.md](CONVENTIONS.md)** - Context file naming conventions
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design
- **[TYPESCRIPT.md](TYPESCRIPT.md)** - Custom TypeScript gates

## License

MIT
