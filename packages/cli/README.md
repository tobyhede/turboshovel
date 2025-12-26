# @turboshovel/cli

Workflow orchestration CLI for Claude Code.

## Installation

```bash
npm install -g @turboshovel/cli
```

## Usage

```bash
# Start a workflow
tsv start my-workflow.md

# Check status
tsv status

# Advance to next step
tsv next

# Handle failure (evaluates FAIL condition)
tsv next --fail

# Stop workflow
tsv stop
```

## Commands

| Command | Description |
|---------|-------------|
| `tsv start <file>` | Start a new workflow |
| `tsv next` | Advance to next step |
| `tsv status` | Show current state |
| `tsv stop` | Abort workflow and delete workflow state |
| `tsv complete` | Mark workflow as successfully completed |
| `tsv stash` | Pause enforcement |
| `tsv pop` | Resume enforcement |
| `tsv list` | List all workflows |
| `tsv gate <name>` | Run a gate |

The `turboshovel` command is an alias for `tsv`.

## Workflow Format

Workflows are markdown files with numbered tasks:

```markdown
## 1. First task

Do something here.

- PASS: CONTINUE
- FAIL: RETRY 3

## 2. Second task

Do something else.

- PASS: CONTINUE
- FAIL: STOP "Task failed"
```

## State Persistence

State persists in `.claude/turboshovel/`:
- `workflows/*.json` - Individual workflow states
- `session.json` - Active workflow tracking

## License

MIT
