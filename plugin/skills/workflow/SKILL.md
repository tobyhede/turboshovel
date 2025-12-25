---
name: workflow
description: How agents execute and orchestrate workflows - subagents report PASS/FAIL, main agent handles dispatch and troubleshooting
---

# Workflow Execution

## For Subagents

You're executing a workflow task. Your context shows:
- **Task N:** What you need to do
- **Attempt:** Retry count if applicable

### Protocol

1. Execute the task as described in the prompt
2. End your response with a status line: `STATUS: PASS` or `STATUS: FAIL`
3. If stuck, blocked, or unclear, report `STATUS: FAIL` - main agent will handle

**Do NOT:**
- Run `workflow next` - main agent advances the workflow
- Try to fix infrastructure issues - report FAIL and let main handle
- Continue past errors - fail fast so main can troubleshoot

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
Task(description="2.A - Review authentication code", ...)
```

The TaskId format is `N.X` where N is task number, X is subtask letter.

### Parallel Subtasks

For parallel execution (e.g., `### 2.{n}` subtasks):
1. Dispatch all agents in one message (multiple Task calls)
2. Run `workflow status` to check agent completion
3. When all agents report done, run `workflow next`

### Handling Failures

When a subagent reports `STATUS: FAIL`:
1. Check agent output for details
2. Discuss with user before proceeding
3. Either retry (`workflow next --step N`) or abort (`workflow stop`)

Never auto-retry failed tasks without understanding the failure.
