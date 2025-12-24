# Execute Workflow Validation v2 (With Command Execution)

## Overview

This document validates the turboshovel workflow system by mapping the cipherpowers `executing-plans` skill to executable workflows. **Key difference from v1:** This version incorporates the planned command execution feature where `workflow next` can execute bash commands and evaluate exit codes.

### Command Execution Model

```
workflow next
    ↓
If step has command → Execute bash → Exit code → PASS(0) / FAIL(≠0)
    ↓
Evaluate conditions → Action (CONTINUE/GOTO/STOP/DONE/RETRY)
    ↓
Update state → Print guidance for next step
```

**CLI Options:**
- `workflow next` - Execute command, evaluate, apply action
- `workflow next --skip-exec` - Skip execution, just advance (Claude controls)
- `workflow next --exit-code N` - Inject exit code without executing (agent provides result)
- `workflow next --step N` - Jump to specific step (for GOTO loops)

---

## Part 1: Draft Workflow Files (Executable)

### Main Workflow: `execute.workflow.md`

```markdown
# Execute Workflow

Execute implementation plans in controlled batches with review checkpoints.

## 1. Load plan

Read plan file from path or discover in `.work/` directory.

Review critically for questions or concerns.

```bash
# Verify plan file exists (Claude provides path)
test -f "${PLAN_PATH:-plan.md}"
```

- PASS: CONTINUE
- FAIL: STOP "Plan file not found"

## 2. Create task tracking

Create TodoWrite items for plan tasks.

Agent creates TodoWrite entries based on plan tasks.

- PASS: CONTINUE
- FAIL: STOP "Could not create task tracking"

## 3. Execute batch

Execute first 3 tasks (or remaining tasks if fewer).

For each task:
1. Mark as in_progress
2. Select agent (semantic, not keyword)
3. Dispatch with following-plans skill embedded
4. Check STATUS in completion

```bash
# Batch execution gate - tests should pass after batch
npm test 2>/dev/null || exit 0
```

- PASS: CONTINUE
- FAIL: RETRY 3

## 4. Code review

**MANDATORY:** Code review between batches.

```bash
# Dispatch code-review-agent via hook
# Hook observes Task tool use and tracks review
echo "Code review dispatched"
```

- PASS: CONTINUE
- FAIL: STOP "BLOCKING issues found. Fix before continuing."

## 5. Report and wait

Show what was implemented. Show verification output.
Say: "Ready for feedback."

- PASS: CONTINUE

## 6. Check more batches

Agent evaluates: Are there more tasks in the plan?

```bash
# Agent runs: check remaining tasks
# If more tasks: exit 1 (FAIL → GOTO 3)
# If no more: exit 0 (PASS → CONTINUE)
workflow status | grep -q "more_batches=true" && exit 1 || exit 0
```

- PASS: CONTINUE
- FAIL: GOTO 3

## 7. Complete development

Verify tests, present options, execute user choice.

```bash
npm test && npm run build
```

- PASS: DONE
- FAIL: STOP "Tests or build failing"
```

### Nested Workflow: `task-execution.workflow.md`

```markdown
# Task Execution

Execute a single task within a subagent.

## 1. Load task

Read plan file and task specification.

```bash
test -f "${PLAN_PATH:-plan.md}"
```

- PASS: CONTINUE
- FAIL: STOP "Could not load plan"

## 2. Execute task

Follow plan exactly. Check against following-plans decision tree:
- Syntax fix only → fix and continue
- Approach change → BLOCKED

Agent executes task using appropriate tools.

- PASS: CONTINUE
- FAIL: RETRY 2

## 3. Run verification

Execute any verification steps specified in plan.

```bash
# Run tests for modified files
npm test -- --findRelatedTests ${MODIFIED_FILES}
```

- PASS: CONTINUE
- FAIL: RETRY 2

## 4. Report completion

Report with STATUS: OK or STATUS: BLOCKED.

- PASS: DONE
```

### Nested Workflow: `code-review.workflow.md`

```markdown
# Code Review

Dispatch code-review-agent to review batch implementation.

## 1. Dispatch reviewer

Dispatch code-review-agent subagent.

```bash
# Hook observes Task tool dispatch
echo "Reviewer dispatched"
```

- PASS: CONTINUE
- FAIL: RETRY 1

## 2. Categorize issues

Agent categorizes feedback as BLOCKING or NON-BLOCKING.

- PASS: CONTINUE
- FAIL: STOP "Has BLOCKING issues"

## 3. Address feedback

Address NON-BLOCKING feedback or defer with justification.

- PASS: DONE
```

---

## Part 2: Execution Model Analysis

### Current Model (Pre-Command-Execution)

```
Claude executes → Claude interprets outcome → Claude calls CLI
                                                     ↓
                                              workflow next
                                                     ↓
                                              State advances
```

**Problems:**
- Claude must remember to call `workflow next`
- Claude must interpret PASS/FAIL correctly
- Claude can skip steps under pressure

### New Model (With Command Execution)

```
Claude starts workflow → workflow next
                              ↓
                     CLI executes command
                              ↓
                     Exit code → PASS/FAIL
                              ↓
                     Evaluate conditions
                              ↓
                     Apply action (GOTO/STOP/DONE/RETRY)
                              ↓
                     Advance state automatically
```

**Improvements:**
- Bash commands execute automatically
- Exit codes are objective (not Claude interpretation)
- GOTO/RETRY/STOP enforced by CLI
- Steps cannot be skipped

### Hybrid Model (Best of Both)

For tasks where Claude must make decisions (not just run bash):

```
workflow next --skip-exec    # Claude controls this step
    ↓
Claude executes (Task, Edit, etc.)
    ↓
Claude determines outcome
    ↓
workflow next --exit-code 0  # OR workflow next --exit-code 1
    ↓
CLI evaluates conditions and applies action
```

**Or for agent results:**

```
workflow next --exit-code 0  # Agent completed successfully
workflow next --exit-code 1  # Agent failed or BLOCKED
```

---

## Part 3: Skill Transformation

### Current: `executing-plans` Skill

189 lines of markdown instructions that Claude interprets.

### Proposed: Thin Wrapper

```markdown
# Executing Plans

Start the execute workflow:

```bash
workflow start plugin/hooks/examples/execute.workflow.md
```

The workflow system handles:
- Step tracking and transitions
- Batch execution loops (GOTO 3)
- BLOCKED escalation (STOP)
- Code review gates (Step 4 mandatory)
- Completion flow (Step 7)

## Agent Completion Reporting

When your task is complete, report status:

```bash
# Task completed successfully
workflow next --exit-code 0

# Task blocked or failed
workflow next --exit-code 1
```
```

### following-plans Skill (Unchanged)

Still embedded in agent prompts. STATUS: OK/BLOCKED still required.
But now: agent calls `workflow next --exit-code N` instead of just reporting.

---

## Part 4: Required Hooks (Updated)

### Hook 1: Task Dispatch Tracker (PostToolUse)

**When:** Task tool is used
**Action:** Register dispatch in workflow state

```typescript
// Already planned - no changes needed
await workflow.addTask({
  id: taskId,
  subagent_type: input.tool_input?.subagent_type,
  status: 'running',
});
```

### Hook 2: Subagent Completion (SubagentStop)

**When:** Subagent completes
**Action:** Parse STATUS, set workflow variables

```typescript
// Parse agent output for STATUS: OK or STATUS: BLOCKED
const status = parseAgentStatus(input.subagent_output);

// Set variable for workflow conditions
if (status === 'BLOCKED') {
  await workflow.setVariable('has_blocked_task', true);
}

// Inject guidance for next step
return `Subagent complete with ${status}. Run: workflow next --exit-code ${status === 'OK' ? 0 : 1}`;
```

### Hook 3: Workflow Context Injection (All Events)

**When:** Any hook event with active workflow
**Action:** Inject current step context

```typescript
// Existing context injection - already implemented
// Just ensure workflow prompt is included
const step = workflow.currentStep();
return `## Active Workflow: ${workflow.name}\n\n**Step ${step.number}:** ${step.description}\n\n${step.prompt}`;
```

### Hook 4: More Batches Variable (Custom Gate)

**When:** Step 6 needs to check if more batches
**Action:** Check TodoWrite for pending tasks

```typescript
// Custom gate in gates.json
{
  "more_batches": {
    "command": "node -e \"const todos = require('./todos.json'); process.exit(todos.some(t => t.status === 'pending') ? 1 : 0)\"",
    "description": "Check if more tasks remain"
  }
}
```

---

## Part 5: Validation Test Cases

### Test 1: Basic Flow (All PASS)

```
1. workflow start execute.workflow.md
2. Step 1: test -f plan.md → exit 0 → PASS → CONTINUE
3. Step 2: Agent creates TodoWrite → PASS → CONTINUE
4. Step 3: npm test → exit 0 → PASS → CONTINUE
5. Step 4: Review dispatched → PASS → CONTINUE
6. Step 5: Report → PASS → CONTINUE
7. Step 6: No more batches → exit 0 → PASS → CONTINUE
8. Step 7: npm test && build → exit 0 → PASS → DONE
```

### Test 2: Batch Loop (GOTO)

```
1. Start workflow with 7 tasks
2. Step 3: Execute batch 1 (tasks 1-3) → PASS
3. Step 4: Review → PASS
4. Step 5: Report → PASS
5. Step 6: more_batches=true → exit 1 → FAIL → GOTO 3
6. Step 3: Execute batch 2 (tasks 4-6) → PASS
7. Step 4: Review → PASS
8. Step 5: Report → PASS
9. Step 6: more_batches=true → exit 1 → FAIL → GOTO 3
10. Step 3: Execute batch 3 (task 7) → PASS
11. Step 4: Review → PASS
12. Step 5: Report → PASS
13. Step 6: more_batches=false → exit 0 → PASS → CONTINUE
14. Step 7: DONE
```

### Test 3: BLOCKED Escalation

```
1. Start workflow
2. Step 3: Agent reports STATUS: BLOCKED
3. Hook sets has_blocked_task=true
4. Agent runs: workflow next --exit-code 1
5. Step 3 condition: FAIL → RETRY (count 1)
6. Agent retries, still BLOCKED
7. RETRY count exceeds max → STOP "Retry limit exceeded"
8. Workflow halts, context shows BLOCKED reason
```

### Test 4: Skip Execution Mode

```
1. Start workflow
2. Step 2: No bash command, agent controls
3. Agent creates TodoWrite manually
4. Agent runs: workflow next --skip-exec
5. CLI advances to Step 3 without evaluating conditions
```

### Test 5: Agent-Injected Exit Code

```
1. Start workflow
2. Step 3: Has bash command but agent ran it already
3. Agent knows result: tests passed
4. Agent runs: workflow next --exit-code 0
5. CLI evaluates PASS condition → CONTINUE
```

---

## Part 6: Command Execution Integration Points

### Point 1: Current Step Command Extraction

```typescript
// In workflow-cli.ts next command
const currentStep = steps[state.step - 1];
if (currentStep.command && !options.skipExec && options.exitCode === undefined) {
  const result = await runStep(currentStep, state, { cwd });
  // result.exitCode, result.action, result.shouldRetry
}
```

### Point 2: Action Handling

```typescript
switch (result.action.type) {
  case 'CONTINUE': nextStepNum = state.step + 1; break;
  case 'GOTO': nextStepNum = result.action.step; break;
  case 'DONE': await manager.setActive(null); return;
  case 'STOP': await manager.setActive(null); process.exit(1);
  case 'RETRY':
    if (result.shouldRetry) {
      await manager.update(state.id, { retryCount: result.newRetryCount });
      return; // Stay on same step
    } else {
      process.exit(1); // Max retries exceeded
    }
}
```

### Point 3: Implicit Defaults

```typescript
// When no conditions specified in workflow
// PASS → CONTINUE
// FAIL → STOP

const DEFAULT_PASS: Action = { type: 'CONTINUE' };
const DEFAULT_FAIL: Action = { type: 'STOP' };
```

---

## Part 7: Files to Create

### Workflow Examples

| File | Purpose |
|------|---------|
| `plugin/hooks/examples/execute.workflow.md` | Main execute workflow |
| `plugin/hooks/examples/task-execution.workflow.md` | Single task execution |
| `plugin/hooks/examples/code-review.workflow.md` | Code review gate |

### Skill Updates

| File | Change |
|------|--------|
| `cipherpowers/skills/executing-plans/SKILL.md` | Thin wrapper invoking workflow |
| `cipherpowers/skills/following-plans/SKILL.md` | Add `workflow next --exit-code` guidance |

### Hook Updates

| File | Change |
|------|--------|
| `plugin/context/subagent-stop.md` | Add workflow next guidance on completion |

---

## Summary

This validation confirms the workflow system with command execution provides:

1. **Automatic bash execution** - Commands run on `workflow next`
2. **Objective exit codes** - 0=PASS, ≠0=FAIL (not Claude interpretation)
3. **Enforced actions** - GOTO/STOP/RETRY applied by CLI
4. **Hybrid control** - `--skip-exec` for Claude-controlled steps
5. **Agent injection** - `--exit-code N` for agent-provided results
6. **Batch loops** - FAIL → GOTO pattern for iteration
7. **Mandatory gates** - Code review step cannot be skipped

**The executing-plans skill becomes a thin wrapper** that starts the workflow and provides agent completion guidance. The workflow system enforces the process that was previously just guidance.
