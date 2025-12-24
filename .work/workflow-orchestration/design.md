# Workflow Orchestration Design

> Date: 2025-12-22
> Status: APPROVED

---

## 1. Goal

Enable main agent workflows to dispatch subagents for tasks, track their execution, and advance the parent workflow based on subagent outcomes.

---

## 2. Architecture Principle

**Hooks trigger CLI commands. CLI commands mutate state.**

```
Hook (automation) ──→ workflow CLI ──→ State File
                          ↑
                     Agent (manual)
```

- Hooks are optional automation
- Agents can call CLI directly (same commands)
- CLI is the single API for state changes
- No direct hook-to-state coupling

---

## 3. Available Hook Data

| Hook | Key Fields |
|------|------------|
| PostToolUse (Task) | `tool_input.description`, `tool_input.subagent_type` |
| SubagentStart | `agent_id`, `agent_type` |
| SubagentStop | `agent_id`, `agent_transcript_path` |

**Critical**: `agent_id` is available at SubagentStart, not at PostToolUse.

---

## 4. The Correlation Problem

**PostToolUse** knows the TaskId (from description) but not the agent_id.
**SubagentStart** knows the agent_id but not which task it's for.

**Solution**: Sequential binding via pending task queue.

1. PostToolUse fires → push TaskId to pending queue
2. SubagentStart fires → pop from queue, bind agent_id to TaskId
3. SubagentStop fires → lookup TaskId by agent_id

This works because Claude Code dispatches sequentially: PostToolUse always fires immediately before SubagentStart for the same task.

---

## 5. CLI Commands

### Existing
```
workflow start <file>     # Start workflow
workflow next             # Advance step
workflow status           # Show state
workflow stop             # Abort
```

### New/Extended

```
workflow start --task <taskId>
```
Mark task as started (pending agent binding).

```
workflow start --agent <agentId> [file]
```
Bind agent to pending task. Optionally start child workflow from file.

```
workflow next --pass [--task <taskId>]
workflow next --fail [--task <taskId>]
```
Advance with explicit pass/fail. For parallel tasks, specify which task.

```
workflow stash
```
Pause enforcement, preserve workflow state. Allows untracked work.

```
workflow pop
```
Resume enforcement from stashed state.

---

## 6. Data Model

### TaskId
```
{ task: number, subtask?: string }

Examples:
  "3" → { task: 3 }
  "3.A" → { task: 3, subtask: "A" }
```

Parsed from Task description: `"3.A - Cross-check"` → `{ task: 3, subtask: "A" }`

### WorkflowState (additions)

```
pendingTasks: TaskId[]              # Queue of tasks awaiting agent binding
agentBindings: {                    # Map of agent_id → task info
  [agentId]: {
    taskId: TaskId
    childWorkflowId?: string
    status: running | done | stopped
    result?: pass | fail
  }
}
```

### Session State (additions)

```
stashedWorkflowId?: string          # ID of stashed workflow (if any)
```

When stashed:
- `active_workflow` → null (enforcement off)
- `stashedWorkflowId` → previous workflow ID

When popped:
- `active_workflow` → stashedWorkflowId
- `stashedWorkflowId` → null

### Child Workflow (additions)

```
agentId: string                     # Which agent owns this workflow
parentWorkflowId: string            # Parent workflow reference
parentTaskId: TaskId                # Which parent task this fulfills
```

---

## 7. Flows

### Sequential Task

```
Main Agent              Hooks                   State
    │                     │                       │
    ├─ Task "2-Review" ──►│ PostToolUse           │
    │                     │ → workflow start      │
    │                     │   --task 2            │
    │                     │                       │
    │                     │ SubagentStart         │
    │                     │ (agent_id: xyz)       │
    │                     │ → workflow start      │
    │                     │   --agent xyz         │
    │                     │                       │
    │                     │ SubagentStop          │
    │                     │ (agent_id: xyz)       │
    │                     │ → workflow next       │
    │                     │   --pass --task 2     │
    │◄────────────────────┼───────────────────────┤
    │                     │              Step 3   │
```

### Parallel Tasks

```
Main Agent              Hooks                   State
    │                     │                       │
    ├─ Task "3.A" ───────►│ → start --task 3.A    │
    ├─ Task "3.B" ───────►│ → start --task 3.B    │
    │                     │                       │
    │                     │ SubagentStart (abc)   │
    │                     │ → start --agent abc   │
    │                     │   (binds to 3.A)      │
    │                     │                       │
    │                     │ SubagentStart (xyz)   │
    │                     │ → start --agent xyz   │
    │                     │   (binds to 3.B)      │
    │                     │                       │
    │                     │ SubagentStop (xyz)    │
    │                     │ → next --pass         │
    │                     │   --task 3.B          │
    │                     │   (3.B done, wait)    │
    │                     │                       │
    │                     │ SubagentStop (abc)    │
    │                     │ → next --pass         │
    │                     │   --task 3.A          │
    │                     │   (all done, advance) │
    │◄────────────────────┼───────────────────────┤
```

### Subagent with Nested Workflow

```
Subagent receives prompt with workflow file.
Subagent runs: workflow start --agent <id> task.workflow.md
  → Creates child workflow linked to parent task
  → Subagent follows its workflow
  → Workflow completes with DONE/STOP
SubagentStop handler reads child workflow status.
```

---

## 8. Context Injection

**Decision**: SubagentStart hook injects agent_id into subagent context.

Subagent sees:
```
AGENT_ID: xyz
If you need to run workflow commands, use --agent xyz
```

---

## 9. Workflow File Syntax

### Step Structure

| Element | Syntax | Description |
|---------|--------|-------------|
| Main step | `## N.` | `## 1. Dispatch agents` |
| Static subtask | `### N.A` | Predefined subtask: `### 1.A First reviewer` |
| Dynamic subtask | `### N.{n}` | Template for runtime subtasks: `### 3.{n} Execute task` |
| Bash command | ` ```bash ` | Executed by workflow system |
| Prompt | `**Prompt:**` or implicit text | Interpreted by Claude |
| Aggregation | `ALL` / `ANY` | `- PASS ALL: CONTINUE` |

### Step Types

**Command step** - has ` ```bash ` code block → workflow system executes it
```markdown
## 2. Run tests

```bash
npm test
```

- PASS: CONTINUE
- FAIL: STOP
```

**Prompt step** - has prompt text → Claude interprets and acts
```markdown
## 1. Dispatch reviewers

### 1.A First reviewer (code-review-agent)
### 1.B Second reviewer (code-agent)

- PASS ALL: CONTINUE
- FAIL ANY: STOP
```

**Control flow step** - just conditionals
```markdown
## 5. Check progress

- IF: more_batches → GOTO 3
- ELSE: CONTINUE
```

### Static vs Dynamic Subtasks

**Static subtasks** - predefined in workflow file:
```markdown
## 1. Dispatch two agents for independent analysis

### 1.A First reviewer (code-review-agent)
### 1.B Second reviewer (code-agent)

- PASS ALL: CONTINUE
- FAIL ANY: STOP
```

**Dynamic subtasks** - created at runtime via CLI:
```markdown
## 3. Execute batch

### 3.{n} Execute task

- PASS ALL: CONTINUE
- FAIL ANY: STOP
```

MainAgent creates `3.a`, `3.b`, `3.c` via `workflow start --task 3.a`.

### Aggregation Modifiers

When step has subtasks (static or dynamic), use aggregation modifiers to control pass/fail evaluation.

#### Valid Combinations

Only two valid pairings exist. Invalid combinations create undefined states:

| Combo | ALL PASS | ALL FAIL | MIXED | Valid? |
|-------|----------|----------|-------|--------|
| `PASS ALL` + `FAIL ALL` | ✓ PASS | ✓ FAIL | ❌ Neither triggers | **Invalid** |
| `PASS ANY` + `FAIL ANY` | ✓ PASS | ✓ FAIL | ❌ Both trigger | **Invalid** |
| `PASS ALL` + `FAIL ANY` | ✓ PASS | ✓ FAIL | ✓ FAIL | **Valid** (pessimistic) |
| `PASS ANY` + `FAIL ALL` | ✓ PASS | ✓ FAIL | ✓ PASS | **Valid** (optimistic) |

#### Syntax Rules

1. **At most one modifier**: Specify `ALL` or `ANY` on either PASS or FAIL (not both required)
2. **Implied opposite**: The other condition's modifier is logically determined
3. **Default**: No modifier = `PASS ALL` + `FAIL ANY` (pessimistic)
4. **Validation**: If both specified, must be a valid pair; invalid pairs → parse error

#### Parsing Matrix

| Syntax | `all` value | Interpretation |
|--------|-------------|----------------|
| `PASS ALL` / `FAIL` | `true` | PASS ALL + FAIL ANY |
| `PASS` / `FAIL ANY` | `true` | PASS ALL + FAIL ANY |
| `PASS ANY` / `FAIL` | `false` | PASS ANY + FAIL ALL |
| `PASS` / `FAIL ALL` | `false` | PASS ANY + FAIL ALL |
| `PASS` / `FAIL` | `true` | Default: PASS ALL + FAIL ANY |
| `PASS ALL` / `FAIL ANY` | `true` | Valid explicit |
| `PASS ANY` / `FAIL ALL` | `false` | Valid explicit |
| `PASS ALL` / `FAIL ALL` | — | **Parse error** |
| `PASS ANY` / `FAIL ANY` | — | **Parse error** |

#### Type Model

```typescript
// Discriminated union - invalid combinations unrepresentable
interface PassAllConditions {
  readonly all: true;
  readonly pass: Action;  // triggers when ALL complete
  readonly fail: Action;  // triggers when ANY blocked
}

interface PassAnyConditions {
  readonly all: false;
  readonly pass: Action;  // triggers when ANY complete
  readonly fail: Action;  // triggers when ALL blocked
}

type Conditions = PassAllConditions | PassAnyConditions;
```

#### Evaluation Function

```typescript
function evaluateConditions(
  tasks: readonly TaskState[],
  conditions: Conditions
): Action {
  const anyBlocked = tasks.some(t => t.status === 'blocked');
  const anyComplete = tasks.some(t => t.status === 'complete');

  // Exhaustive switch on discriminant
  switch (conditions.all) {
    case true:
      // PASS ALL + FAIL ANY: any failure triggers fail
      return anyBlocked ? conditions.fail : conditions.pass;
    case false:
      // PASS ANY + FAIL ALL: any success triggers pass
      return anyComplete ? conditions.pass : conditions.fail;
  }
}
```

#### Unified Model

The same evaluation works for 1 to N tasks:
- **Single task**: `anyBlocked` ≡ `!anyComplete` when n=1, so both strategies produce identical results
- **Multiple tasks**: Strategy determines aggregation behavior

#### Examples

```markdown
## 1. Dispatch reviewers (pessimistic - default)

### 1.A First reviewer
### 1.B Second reviewer

PASS ALL → CONTINUE
FAIL → STOP
```

```markdown
## 3. Try multiple approaches (optimistic)

### 3.A Approach one
### 3.B Approach two

PASS ANY → CONTINUE
FAIL → STOP "All approaches failed"
```

---

## 10. Decisions Made

| Question | Decision |
|----------|----------|
| How does subagent get agent_id? | Context injection by SubagentStart hook |
| How does subagent know which workflow? | Main agent specifies in Task prompt |
| Timeout for pending tasks? | No timeout, manual cleanup only |
| Hook-state coupling? | None. Hooks call CLI. |
| Aggregation modifier combinations? | Only two valid: `PASS ALL + FAIL ANY` or `PASS ANY + FAIL ALL` |
| What's the default aggregation? | `PASS ALL + FAIL ANY` (pessimistic) |
| How to represent in types? | Discriminated union with `all: true \| false` boolean |
| How to handle single vs parallel tasks? | Unified evaluation - same function, same types |

---

## 11. Out of Scope

- Inter-agent communication during execution
- Distributed workflows
- Workflow versioning/migration
- Real-time progress monitoring

---

## 12. Enforcement Mode

**Workflow start activates enforcement. Session-scoped.**

| State | Behavior |
|-------|----------|
| No active workflow | Hooks pass through silently. No enforcement. |
| Active workflow | Strict mode. Violations halt the agent. |
| Stashed workflow | Enforcement paused. Work freely. |

### Violations (when workflow active, not stashed)

| Violation | Cause | Response |
|-----------|-------|----------|
| Task without TaskId | Description like "Explore codebase" (no "3.A" prefix) | BLOCK |
| SubagentStart with no pending | Task dispatched outside workflow structure | BLOCK |
| SubagentStop for unknown agent | Agent wasn't bound at start | BLOCK |

### Stash/Pop (Escape Hatch)

```bash
workflow stash          # Pause enforcement, preserve state
# ... do untracked work (explore, debug, etc.) ...
workflow pop            # Resume enforcement
```

Use case: Main agent needs to dispatch ad-hoc exploration tasks mid-workflow.

---

## 13. Open Questions

1. How to handle subagent crash (no SubagentStop fires)?
   - Stale agent bindings with status "running" forever
   - Manual cleanup via `workflow unbind --agent <id>`?
