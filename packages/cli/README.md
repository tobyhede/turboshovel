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

# Mark step as passed (advance to next step)
tsv pass

# Mark step as failed (evaluates FAIL condition)
tsv fail

# Jump to specific step
tsv goto 3

# Stop workflow
tsv stop
```

## Commands

| Command | Description |
|---------|-------------|
| `tsv start <file>` | Start a new workflow |
| `tsv pass` | Mark current step as passed (evaluates PASS condition) |
| `tsv fail` | Mark current step as failed (evaluates FAIL condition) |
| `tsv goto <n>` | Jump to specific step number |
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
