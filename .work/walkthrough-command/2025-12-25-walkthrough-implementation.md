# Walkthrough System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a self-verifying walkthrough workflow that exercises all workflow features and serves as both an end-to-end test and feature demonstration.

**Architecture:** A workflow file that progresses through all features (parallel subtasks, conditionals, retry, gates, agent binding), with subagents logging to a trace file, culminating in a verification script that validates the entire execution.

**Tech Stack:** Markdown workflow files, bash scripts, JSON gates configuration

---

## Task 1: Create Verification Script

**Files:**
- Create: `plugin/scripts/walkthrough-verify.sh`

**Step 1: Create the scripts directory**

Run: `mkdir -p plugin/scripts`

**Step 2: Create the verification script**

```bash
#!/bin/bash
# Verify walkthrough execution
set -e

LOG=".work/walkthrough.log"

# Expected log entries (in order they should appear)
EXPECTED=(
  "workflow-started"
  "agent-1-started"
  "agent-1-complete"
  "agent-2-started"
  "agent-2-complete"
  "gate-check-ran"
  "retry-attempt-1"
  "retry-attempt-2"
)

echo "=== Walkthrough Verification ==="

# Check log exists
if [[ ! -f "$LOG" ]]; then
  echo "FAIL: Log file not found at $LOG"
  exit 1
fi

echo "Log file found: $LOG"
echo ""
echo "Log contents:"
cat "$LOG"
echo ""

# Check each expected entry exists
MISSING=()
for entry in "${EXPECTED[@]}"; do
  if ! grep -q "$entry" "$LOG"; then
    MISSING+=("$entry")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "FAIL: Missing log entries:"
  for m in "${MISSING[@]}"; do
    echo "  - $m"
  done
  exit 1
fi

echo "All expected log entries found"

# Check workflow state directory exists
STATE_DIR=".claude/turboshovel/workflows"
if [[ ! -d "$STATE_DIR" ]]; then
  echo "FAIL: Workflow state directory not found"
  exit 1
fi

# Count state files
STATE_COUNT=$(ls -1 "$STATE_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
if [[ "$STATE_COUNT" -eq 0 ]]; then
  echo "FAIL: No workflow state files found"
  exit 1
fi

echo "Workflow state directory verified ($STATE_COUNT state files)"

# Append success marker
echo "verification-passed" >> "$LOG"

echo ""
echo "=== PASS: Walkthrough verification complete ==="
exit 0
```

**Step 3: Make script executable**

Run: `chmod +x plugin/scripts/walkthrough-verify.sh`

**Step 4: Commit**

```bash
git add plugin/scripts/walkthrough-verify.sh
git commit -m "feat: add walkthrough verification script"
```

---

## Task 2: Add Test Gates

**Files:**
- Modify: `plugin/gates.json`

**Step 1: Add walkthrough gates to gates.json**

Add these gates to the `"gates"` object:

```json
"walkthrough:log": {
  "description": "Append message to walkthrough log",
  "command": "echo \"$1\" >> .work/walkthrough.log",
  "on_pass": "CONTINUE",
  "on_fail": "CONTINUE"
},
"walkthrough:gate-check": {
  "description": "Test gate - checks marker file and logs execution",
  "command": "test -f .work/walkthrough-marker && echo 'gate-check-ran' >> .work/walkthrough.log",
  "on_pass": "CONTINUE",
  "on_fail": "BLOCK"
}
```

The full gates object should look like:

```json
{
  "gates": {
    "plugin-path": { ... },
    "check": { ... },
    "test": { ... },
    "build": { ... },
    "walkthrough:log": {
      "description": "Append message to walkthrough log",
      "command": "echo \"$1\" >> .work/walkthrough.log",
      "on_pass": "CONTINUE",
      "on_fail": "CONTINUE"
    },
    "walkthrough:gate-check": {
      "description": "Test gate - checks marker file and logs execution",
      "command": "test -f .work/walkthrough-marker && echo 'gate-check-ran' >> .work/walkthrough.log",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": { ... }
}
```

**Step 2: Validate JSON syntax**

Run: `cat plugin/gates.json | jq .`
Expected: Valid JSON output, no errors

**Step 3: Commit**

```bash
git add plugin/gates.json
git commit -m "feat: add walkthrough test gates"
```

---

## Task 3: Add workflow gate CLI Command

**Files:**
- Modify: `plugin/core/src/cli/workflow-cli.ts`

**Step 1: Add gate subcommand to workflow CLI**

Add a new `gate` subcommand that allows running a gate by name:

```typescript
// Add after the existing subcommands (around line 416)

.command('gate <name>')
.description('Run a gate by name')
.action(async (name: string) => {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  if (!config?.gates?.[name]) {
    console.error(`Gate not found: ${name}`);
    process.exit(1);
  }

  const gate = config.gates[name];
  if (!gate.command) {
    console.error(`Gate has no command: ${name}`);
    process.exit(1);
  }

  try {
    const { execSync } = await import('child_process');
    execSync(gate.command, {
      cwd,
      stdio: 'inherit',
      shell: true
    });
    console.log(`Gate ${name}: PASS`);
  } catch (error) {
    console.error(`Gate ${name}: FAIL`);
    process.exit(1);
  }
});
```

**Step 2: Run tests**

Run: `cd plugin/core && npm test`
Expected: All tests pass

**Step 3: Build**

Run: `cd plugin/core && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add plugin/core/src/cli/workflow-cli.ts
git commit -m "feat: add workflow gate CLI command"
```

---

## Task 4: Create Workflow Skill

**Files:**
- Create: `plugin/skills/workflow/SKILL.md`

**Step 1: Create the skill directory**

Run: `mkdir -p plugin/skills/workflow`

**Step 2: Create the skill file**

```markdown
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
```

**Step 3: Commit**

```bash
git add plugin/skills/workflow/SKILL.md
git commit -m "feat: add workflow execution skill"
```

---

## Task 5: Create Walkthrough Workflow

**Files:**
- Create: `plugin/workflows/walkthrough.workflow.md`

**Step 1: Create the workflow file**

```markdown
# Walkthrough Workflow

Exercise all turboshovel workflow features with verification.

## 1. Initialize

Set up test environment and log workflow start.

```bash
mkdir -p .work
rm -f .work/walkthrough.log .work/walkthrough-marker .work/walkthrough-retry-counter
echo "workflow-started" >> .work/walkthrough.log
touch .work/walkthrough-marker
```

- PASS: CONTINUE
- FAIL: GOTO 6

## 2. Parallel Subtasks

Dispatch 2 agents in parallel to test agent binding and SubagentStart/Stop hooks.

### 2.{n}

Execute parallel agent task.

**Prompt:** You are agent $n in the walkthrough.
1. Append "agent-$n-started" to .work/walkthrough.log
2. Wait briefly (simulate work)
3. Append "agent-$n-complete" to .work/walkthrough.log
4. Report STATUS: PASS

- PASS: CONTINUE
- FAIL: RETRY 1

## 3. Gate Integration

Run the walkthrough:gate-check gate to verify gate execution within workflows.

```bash
workflow gate walkthrough:gate-check
```

- PASS: CONTINUE
- FAIL: RETRY 2

## 4. Retry Mechanics

Test retry behavior with a command that fails on first attempt, succeeds on second.

```bash
# Uses a counter file to track attempts
COUNTER_FILE=".work/walkthrough-retry-counter"
if [[ ! -f "$COUNTER_FILE" ]]; then
  # First attempt - log and fail
  echo "1" > "$COUNTER_FILE"
  echo "retry-attempt-1" >> .work/walkthrough.log
  exit 1
else
  # Second attempt - log and succeed
  echo "retry-attempt-2" >> .work/walkthrough.log
  exit 0
fi
```

- PASS: CONTINUE
- FAIL: RETRY 3

## 5. Verification

Run verification script to validate entire walkthrough execution.

```bash
./plugin/scripts/walkthrough-verify.sh
```

- PASS: DONE
- FAIL: GOTO 6

## 6. Error Handler

Handle walkthrough failures.

**Prompt:** The walkthrough encountered an error. Check .work/walkthrough.log for the execution trace and diagnose the issue.

- FAIL: BLOCKED
```

**Step 2: Commit**

```bash
git add plugin/workflows/walkthrough.workflow.md
git commit -m "feat: add walkthrough workflow"
```

---

## Task 6: Create Walkthrough Command

**Files:**
- Create: `plugin/commands/walkthrough.md`

**Step 1: Create the command file**

```markdown
---
description: Run the turboshovel feature walkthrough
---

# Walkthrough

Run the turboshovel feature walkthrough to see all workflow features in action.

<instructions>
## Instructions

This walkthrough exercises all workflow features:
- Parallel subtask dispatch
- Agent binding and tracking
- Conditional branching (GOTO, RETRY)
- Gate integration
- Context injection
- Verification

## Running the Walkthrough

1. Start the workflow:
   ```bash
   workflow start ${CLAUDE_PLUGIN_ROOT}/workflows/walkthrough.workflow.md
   ```

2. Check status anytime:
   ```bash
   workflow status
   ```

3. Follow the workflow prompts to progress through tasks.

4. On completion, the verification script validates the entire execution.

## Outputs

- `.work/walkthrough.log` - Execution trace
- `.claude/turboshovel/workflows/` - Workflow state files

## Troubleshooting

If a task fails:
- Check `.work/walkthrough.log` for the last successful step
- Use `workflow status` to see current state
- Use `workflow stop` to abort and start fresh

</instructions>
```

**Step 2: Commit**

```bash
git add plugin/commands/walkthrough.md
git commit -m "feat: add walkthrough command"
```

---

## Task 7: Integration Test

**Files:**
- No files created/modified (manual testing)

**Step 1: Build the plugin**

Run: `cd plugin/core && npm run build`
Expected: Build completes without errors

**Step 2: Start a fresh walkthrough**

Run: `workflow start plugin/workflows/walkthrough.workflow.md`
Expected: Workflow starts, shows Task 1

**Step 3: Execute Task 1 (Initialize)**

The bash command should run automatically or via prompt.
Expected: `.work/walkthrough.log` contains "workflow-started"

**Step 4: Check workflow status**

Run: `workflow status`
Expected: Shows Task 1 complete, ready for Task 2

**Step 5: Execute parallel subtasks (Task 2)**

Dispatch 2 agents for subtasks 2.1 and 2.2.
Expected: Both agents log their start/complete messages

**Step 6: Continue through remaining tasks**

Run `workflow next` after each task completes.
Expected: Tasks 3, 4, 5 execute with appropriate retries

**Step 7: Verify final state**

Run: `cat .work/walkthrough.log`
Expected output:
```
workflow-started
agent-1-started
agent-1-complete
agent-2-started
agent-2-complete
gate-check-ran
retry-attempt-1
retry-attempt-2
verification-passed
```

Run: `workflow status`
Expected: Workflow complete

---

## Summary

| Task | File | Purpose |
|------|------|---------|
| 1 | `plugin/scripts/walkthrough-verify.sh` | Verification script |
| 2 | `plugin/gates.json` | Test gates |
| 3 | `plugin/core/src/cli/workflow-cli.ts` | Add `workflow gate` CLI command |
| 4 | `plugin/skills/workflow/SKILL.md` | Agent workflow skill |
| 5 | `plugin/workflows/walkthrough.workflow.md` | Walkthrough workflow |
| 6 | `plugin/commands/walkthrough.md` | Walkthrough command |
| 7 | (manual) | Integration test |

## Fixes Applied

1. **Retry logic**: Fixed bash script to succeed on attempt 2 (not 3) - now logs exactly `retry-attempt-1` and `retry-attempt-2`
2. **Gate invocation**: Added Task 3 to implement `workflow gate <name>` CLI command; workflow now calls `workflow gate walkthrough:gate-check`
3. **Path slash**: Fixed `${CLAUDE_PLUGIN_ROOT}/workflows/...` (added missing `/`)
4. **Task ordering**: Moved `mkdir -p plugin/scripts` to be first step of Task 1
