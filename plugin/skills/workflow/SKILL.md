---
name: workflow
description: Use when executing multi-step processes requiring state persistence and agent coordination - defines two-tier protocol where subagents report PASS/FAIL status and main agent handles dispatch, advancement, and failure troubleshooting
---

# Workflow Execution

## Overview

Workflows are multi-step processes with state tracking. **Two-tier orchestration:** subagents execute individual tasks and report outcomes; main agent dispatches, monitors, and handles failures.

**Core principle:** Subagents fail fast, main agent troubleshoots.

## When to Use

- Multi-step processes needing state persistence across context clears
- Parallel subagent orchestration with status tracking
- PASS/FAIL signaling between agents
- Processes requiring retry/resume capability

**Not for:** Single-step tasks, ad-hoc commands

---

## For Subagents

You're executing a workflow task. Your context shows:
- **Task N:** What you need to do
- **Attempt:** Retry count if applicable

### Protocol

1. Execute the task as described in the prompt
2. End your response with a status line: `STATUS: PASS` or `STATUS: FAIL`
3. If stuck, blocked, or unclear, report `STATUS: FAIL` - main agent will handle

**Do NOT:**
- Advance the parent workflow - only your orchestrator does that
- Try to fix infrastructure issues - report FAIL and let main handle
- Continue past errors - fail fast so main can troubleshoot

**You CAN:** Run your own nested workflows with full `workflow` commands.

---

## For Main Agent

You orchestrate the workflow. Use these commands:

| Command | Purpose |
|---------|---------|
| `workflow start <file>` | Begin a workflow |
| `workflow next` | Advance after task completes |
| `workflow next --step N` | Jump to specific task |
| `workflow next --pass --agent <id>` | Mark agent task as passed |
| `workflow next --fail --agent <id>` | Mark agent task as failed |
| `workflow status` | Check current state |
| `workflow complete` | Mark workflow finished |
| `workflow stop` | Abort workflow |
| `workflow stash` | Pause enforcement (for ad-hoc work) |
| `workflow pop` | Resume enforcement |
| `workflow gate <name>` | Run a gate by name |

### Dispatching Tasks

Include TaskId in Task description:
```
Task(description="2.1 - Review authentication code", ...)
```

The TaskId format is `N.X` where N is task number, X is subtask number.

### Parallel Subtasks

For parallel execution (e.g., `### 2.{n}` subtasks):
1. Dispatch all agents in one message (multiple Task calls)
2. Run `workflow status` to check agent completion
3. When all agents report done, run `workflow next`

### Dynamic Subtask `{n}` Syntax

`### N.{n}` marks dynamic subtasks - orchestrator decides count at runtime.

- Queue with sequential numbers: `workflow start --task 3.1`, `--task 3.2`
- `$n` in prompts substitutes with subtask number (1, 2, etc.)

### Handling Failures

When subagent reports `STATUS: FAIL`: check output, discuss with user, then retry (`--step N`) or abort (`stop`).

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Subagent advances parent workflow | Only advance your own nested workflow, not parent's |
| Subagent auto-retries on failure | Report `STATUS: FAIL` and let main handle |
| Main agent auto-retries without user | Always discuss failures before retry |
| Missing TaskId in dispatch | Include `N.X` format in Task description |
| Parallel tasks without status check | Run `workflow status` before advancing |
