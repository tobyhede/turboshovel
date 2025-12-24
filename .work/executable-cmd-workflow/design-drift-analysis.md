# Design Drift Analysis

## Original Design (v2) vs Current Plan

### Core Paradigm

| Aspect | Original Design | Current Plan | Drift |
|--------|-----------------|--------------|-------|
| **Execution** | Claude executes | CLI executes bash | **MAJOR** |
| **PASS/FAIL** | Claude interprets | Exit code determines | **MAJOR** |
| **Actions** | Claude applies | CLI applies | **MAJOR** |
| **workflow next** | Just advances state | Executes + evaluates + advances | **MAJOR** |

### Original Design Quote (README line 403-422)

> **Critical concept:** Workflows are **state trackers**, not executors. Claude still does all the work using its normal tools.
>
> **What the workflow does NOT do:**
> - Execute bash commands automatically (Claude runs them)
> - Dispatch agents automatically (Claude uses Task tool)
> - Make decisions automatically (Claude interprets PASS/FAIL outcomes)

### Our Plan Quote

> CLI executes bash → Exit code → PASS/FAIL → Apply action (GOTO/STOP/RETRY)

---

## Specific Drifts

### 1. IF/ELSE Conditionals

**Original Design (v2 line 143-155):**
```markdown
- IF: more_batches
  - GOTO: 2
- ELSE: CONTINUE

- IF: NOT has_blocking_issues
  - CONTINUE
```

**Current State:**
```
> ⚠️ NOT YET IMPLEMENTED: IF/ELSE conditionals are planned but not currently supported
```

**Workaround Created:**
"Agent-controlled branching" - Claude decides and runs `workflow next --step N`

**Assessment:** The design planned IF/ELSE. We documented it as "not implemented" and created a workaround. This is a **feature gap**, not a drift. But it changes how loops work.

### 2. Command Execution Model

**Original Design (v2 line 86-95):**
```
| Command | Purpose |
|---------|---------|
| `workflow next` | Advance to next step (validates first) |
```

**Our Plan:**
```
workflow next → Execute bash → Exit code → Evaluate → Apply action
```

**Assessment:** Original `workflow next` was simple state advancement. Our plan makes it an executor. This is a **paradigm shift**.

### 3. Variable Setting

**Original Design (v2 line 155):**
> Variables are booleans set by commands/CLI.

**Current Implementation:** Variables exist in state, but no CLI command to set them.

**Our Plan:** Exit codes determine PASS/FAIL, not variables.

**Assessment:** The original intended variables like `more_batches` to be set explicitly, then IF/ELSE would check them. Our plan bypasses this with exit codes.

### 4. Nested Workflows

**Original Design (v2 line 159-168):**
```markdown
## 3. Execute batch

workflow: task.workflow.md

- PASS: CONTINUE
```

**Current Parser:** Parses `nestedWorkflow` field but CLI doesn't use it.

**Our Plan:** Not addressed.

**Assessment:** Nested workflows were core to the design. They're parsed but not executed.

### 5. Hook Integration

**Original Design (v2 line 227-279):**
- PostToolUse hook for Task tool tracking
- SubagentStop hook for completion tracking
- Context injection from workflow state

**Current Implementation:**
- Context injection exists (via context files)
- No Task tracking hook
- No SubagentStop workflow integration

**Our Plan:** Mostly ignored hooks, focused on CLI execution.

**Assessment:** Hook integration was Phase 2 of the original plan. We implemented Phase 1 (CLI) and Phase 3 (Parser), but not Phase 2.

---

## Execution Model Comparison

### Original (Claude-Centric)

```
Claude reads workflow step
    ↓
Claude executes (Bash, Task, Edit)
    ↓
Claude interprets result
    ↓
Claude decides: PASS or FAIL?
    ↓
Claude runs: workflow next (or --step N)
    ↓
CLI advances state
```

### Our Plan (CLI-Centric)

```
Claude runs: workflow next
    ↓
CLI executes bash command
    ↓
Exit code determines: PASS (0) or FAIL (≠0)
    ↓
CLI evaluates conditions
    ↓
CLI applies action (CONTINUE/GOTO/STOP/RETRY)
    ↓
CLI advances state
```

### Hybrid (What Rust Did)

```
workflow run execute.workflow.md    # CLI runs entire workflow
    ↓
CLI executes each step's command
    ↓
Exit code → PASS/FAIL
    ↓
CLI applies action
    ↓
Prompts pause for human [y/n]
```

---

## Questions for Decision

### 1. Which execution model?

**Option A: Original (Claude-centric)**
- `workflow next` just advances state
- Claude executes commands, interprets results
- Claude decides PASS/FAIL
- Pros: Flexible, agent can reason about outcomes
- Cons: Can skip steps under pressure

**Option B: Our Plan (CLI-centric)**
- `workflow next` executes command + evaluates
- Exit code determines PASS/FAIL
- CLI applies actions
- Pros: Enforced, objective outcomes
- Cons: Less flexible, bash-only enforcement

**Option C: Hybrid**
- `workflow next` - Claude-controlled (default)
- `workflow next --run` - CLI executes command
- `workflow next --exit-code N` - Agent injects result
- Pros: Both models available
- Cons: Complexity

### 2. IF/ELSE priority?

The original design had explicit IF/ELSE syntax. Should we:
- Implement IF/ELSE as designed?
- Keep agent-controlled branching as the pattern?
- Both?

### 3. Hook integration?

Original Phase 2 was never implemented:
- Task dispatch tracking
- SubagentStop workflow integration
- Workflow-aware context injection

Should we prioritize this over command execution?

### 4. Nested workflows?

Parser supports `nestedWorkflow` but CLI ignores it. Should we implement?

---

## Recommendation

Before adding command execution, consider:

1. **Clarify the paradigm** - Is the workflow a state tracker or executor?
2. **Implement IF/ELSE** - The design planned for it, agent-workaround is a deviation
3. **Add hooks** - Phase 2 was skipped, it's essential for Task tracking
4. **Then consider execution** - Command execution changes the paradigm

Or: **Accept the paradigm shift** and embrace CLI-centric execution, which is closer to the original Rust tool behavior.

---

## Summary

| Original Design | Current Implementation | Our Plan |
|-----------------|----------------------|----------|
| Claude executes | Claude executes | CLI executes |
| Claude interprets | Claude interprets | Exit code |
| IF/ELSE planned | Not implemented | Not planned |
| Hooks Phase 2 | Not implemented | Not planned |
| Nested workflows | Parsed, not used | Not planned |
| State tracker | State tracker | Executor |
