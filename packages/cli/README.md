# @turboshovel/cli

Workflow orchestration CLI for Claude Code.

**For the complete Workflow System Guide, see [docs/WORKFLOWS.md](../../docs/WORKFLOWS.md).**

## Installation

```bash
npm install -g @turboshovel/cli
```

## Quick Reference

### Commands

| Command | Description |
|---------|-------------|
| `tsv run <file>` | Run a workflow |
| `tsv pass` | Mark current step as passed |
| `tsv fail` | Mark current step as failed |
| `tsv goto <n>` | Jump to specific step number |
| `tsv status` | Show current state |
| `tsv stop` | Abort workflow |
| `tsv complete` | Mark workflow as complete |
| `tsv stash` | Pause enforcement |
| `tsv pop` | Resume enforcement |
| `tsv ls` | List active workflows |
| `tsv ls --all` | List available workflow files |
| `tsv check <file>` | Check workflow for errors |

### Subagent Dispatch

```bash
# Task Binding (Agent execution)
tsv run --step 3.1
tsv run --agent <id>

# Subworkflow Dispatch (Enforced execution)
tsv run --step 3.1 <workflow-file>
tsv run --agent <id>
```

## License

MIT
