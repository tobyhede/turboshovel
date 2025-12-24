# Reference Workflow

A comprehensive demonstration of all workflow syntax and capabilities.

This workflow showcases every feature: sequential steps, parallel tasks, nested workflows, agent orchestration, conditional branching, retry logic, variables, and the new task binding system.

---

## 1. Initialize environment

Run setup commands using a bash code block.

```bash
echo "Starting workflow" && npm run lint
```

- PASS: CONTINUE
- FAIL: STOP "Environment setup failed"

## 2. Validate prerequisites

Prompt-only step (no code block). All step text becomes the implicit prompt.

Check that required files exist and dependencies are installed.
Verify the `.work/` directory contains a valid plan file.

- PASS: CONTINUE
- FAIL: STOP "Prerequisites not met"

## 3. Load configuration

Explicit prompt using `**Prompt:**` marker.

**Prompt:** Load the configuration from `gates.json` and set workflow variables based on project type.

Set variables:
- `batch_size`: Number of tasks per batch (default 3)
- `requires_review`: Whether code review is mandatory

- PASS: CONTINUE
- FAIL: RETRY 2

## 4. Dispatch independent agents

Parallel subtasks using H3 headers with subtask notation (N.letter).

### 4.A Static analysis (code-agent)

Dispatch code-agent to run static analysis on the codebase.

### 4.B Security scan (research-agent)

Dispatch research-agent to check for known vulnerabilities in dependencies.

### 4.C Type checking (code-agent)

Dispatch code-agent to verify TypeScript types compile.

- PASS (ALL): CONTINUE
- FAIL (ANY): STOP "Analysis phase failed"

## 5. Execute nested workflow

Delegate to a child workflow using the `workflow:` directive.

workflow: collate.workflow.md

The child workflow runs independently and reports back.

- PASS: CONTINUE
- FAIL: STOP "Nested workflow failed"

## 6. Execute batch of tasks

**Prompt:** Execute the next batch of tasks from the plan.

For each task in the batch:
1. Parse task ID (e.g., "6.1 - Implement feature")
2. Dispatch subagent with task description
3. Track completion via SubagentStop hook

Task binding flow:
- PostToolUse fires → `workflow start --task 6.1`
- SubagentStart fires → `workflow start --agent <id>` (binds agent to task)
- SubagentStop fires → `workflow next --pass --task 6.1`

- PASS: CONTINUE
- FAIL: RETRY 3

## 7. Review batch implementation

**Prompt:** Dispatch code-review-agent to review the completed batch.

Categorize feedback as:
- BLOCKING: Must fix before proceeding
- NON-BLOCKING: Can defer with justification

- PASS: CONTINUE
- FAIL: STOP "BLOCKING issues found. Fix before continuing."

## 8. Report progress

**Prompt:** Show what was implemented in this batch.

Display:
- Completed task count
- Files modified
- Tests added/updated

Say: "Ready for feedback. Use `workflow stash` to pause for ad-hoc work."

- PASS: CONTINUE

## 9. Check remaining work

Agent-controlled branching pattern for loops.

**Prompt:** Check TodoWrite for remaining tasks.

Decision logic:
- If more batches needed → `workflow next --step 6`
- If all tasks complete → `workflow next`

This pattern allows agent judgment rather than rigid conditionals.

- PASS: CONTINUE

## 10. Dual verification phase

Parallel verification with different aggregation rules.

### 10.A First reviewer (code-review-agent)

Independent review against requirements.

### 10.B Second reviewer (code-agent)

Independent review from implementation perspective.

At least one reviewer must pass for verification to succeed.

- PASS (ANY): CONTINUE
- FAIL (ALL): STOP "Both reviewers rejected"

## 11. Cross-check divergences

Handle cases where parallel reviewers disagree.

**Prompt:** If reviewers had divergent findings:
1. Load both review outputs
2. Identify conflicting assessments
3. Dispatch verification agent to resolve
4. Document resolution in collation report

- PASS: CONTINUE
- FAIL: RETRY 2

## 12. Conditional skip example

Demonstrate GOTO for skipping optional steps.

**Prompt:** Check if `requires_review` variable is false.

If review not required → `workflow next --step 14`
If review required → `workflow next`

- PASS: CONTINUE

## 13. Optional code review

Only reached if `requires_review` is true.

**Prompt:** Perform detailed code review with security focus.

- PASS: CONTINUE
- FAIL: STOP "Security review failed"

## 14. Finalize implementation

**Prompt:** Ensure all tests pass and prepare for completion.

```bash
npm test && npm run build
```

- PASS: CONTINUE
- FAIL: GOTO 15

## 15. Handle test failures

Error recovery step (reached via GOTO from step 14).

**Prompt:** Analyze test failures and attempt fixes.

For each failing test:
1. Read error message
2. Identify root cause
3. Apply fix
4. Re-run test

After fixes → `workflow next --step 14` to retry finalization

- PASS: CONTINUE
- FAIL: STOP "Could not fix test failures"

## 16. Present completion options

**Prompt:** All implementation complete. Present options to user:

1. Create PR with changes
2. Create atomic commits and push
3. Generate summary report
4. End workflow without action

Await user selection.

- PASS: DONE
- FAIL: STOP "User aborted"

---

# Feature Summary

## Step Types
- **Code block steps**: Execute bash commands (Step 1)
- **Implicit prompt steps**: Description becomes prompt (Step 2)
- **Explicit prompt steps**: Use `**Prompt:**` marker (Steps 3, 6-16)

## Parallel Tasks
- **H3 subtask notation**: `### N.letter Title` (Steps 4, 10)
- **Aggregation rules**:
  - `PASS (ALL)`: All must pass (Step 4)
  - `PASS (ANY)`: At least one passes (Step 10)
  - `FAIL (ANY)`: Any failure stops (Step 4)
  - `FAIL (ALL)`: All must fail (Step 10)

## Actions
| Action | Example | Description |
|--------|---------|-------------|
| `CONTINUE` | `PASS: CONTINUE` | Proceed to next step |
| `STOP` | `FAIL: STOP` | End with failure |
| `STOP "msg"` | `FAIL: STOP "Error"` | End with message |
| `DONE` | `PASS: DONE` | End with success |
| `GOTO N` | `FAIL: GOTO 15` | Jump to step |
| `RETRY` | `FAIL: RETRY` | Retry (max 3) |
| `RETRY N` | `FAIL: RETRY 5` | Retry with limit |

## Nested Workflows
- **`workflow:` directive**: Delegate to child workflow (Step 5)
- Child inherits agent context and reports back

## Agent Orchestration
- **Task binding**: `--task <id>` correlates Task tool to workflow
- **Agent binding**: `--agent <id>` binds agent at SubagentStart
- **Outcome reporting**: `--pass/--fail` at SubagentStop

## Branching Patterns
- **Agent-controlled loops**: Agent decides `--step N` vs next (Steps 9, 12, 15)
- **Error recovery**: GOTO to recovery step, then retry (Steps 14-15)
- **Conditional skip**: Agent judgment bypasses steps (Steps 12-13)

## Variables
- Set during execution (Step 3)
- Used for conditional logic (Steps 9, 12)
- Types: boolean, number, string
- Common: `more_batches`, `has_blocked_task`, `requires_review`

## CLI Commands Reference

```bash
# Start workflow
workflow start reference.workflow.md

# Start with task binding
workflow start --task 6.1

# Bind agent to pending task
workflow start --agent abc123

# Advance with outcome
workflow next --pass
workflow next --fail
workflow next --pass --task 6.1

# Jump to specific step
workflow next --step 14

# Check status
workflow status

# Pause enforcement
workflow stash

# Resume enforcement
workflow pop

# List all workflows
workflow list

# Stop workflow
workflow stop
```

## Session State

```json
{
  "id": "wf-2025-12-23-ref123",
  "workflow": "reference.workflow.md",
  "step": 6,
  "stepName": "Execute batch of tasks",
  "retryCount": 1,
  "retryMax": 3,
  "variables": {
    "batch_size": 3,
    "requires_review": true,
    "more_batches": true
  },
  "pendingTasks": ["6.1"],
  "agentBindings": {
    "abc123": {
      "taskId": { "task": 6, "subtask": "1" },
      "status": "running"
    }
  }
}
```
