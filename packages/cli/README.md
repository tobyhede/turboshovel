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

## Subagent Dispatch

You can dispatch tasks to subagents in two ways:

### 1. Task Binding (Agent-managed execution)
Assign a step to an agent. The agent is responsible for executing the task and reporting success/failure.

```bash
# Queue a step for binding
tsv start --step 3.1

# Bind an agent to the queued step
tsv start --agent <agent-id>

# Agent reports outcome
tsv pass --agent <agent-id>
```

### 2. Subworkflow Dispatch (Enforced execution)
Assign a step AND a workflow to an agent. The agent is forced to follow the subworkflow.

```bash
# Queue a step with a mandatory workflow
tsv start --step 3.1 subtask.workflow.md

# Bind an agent (automatically starts the subworkflow)
tsv start --agent <agent-id>
```

When a subworkflow is active:
- The parent workflow is effectively paused.
- The agent must complete the subworkflow to resolve the parent step.
- `tsv status` shows the active child workflow.


## State Persistence

State persists in `.claude/turboshovel/`:
- `workflows/*.json` - Individual workflow states
- `session.json` - Active workflow tracking

## License

MIT
