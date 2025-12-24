# Autonomous Workflow Design Decisions

> Captured from brainstorming session 2025-12-22

---

## 1. Design Goal

**One command, fully autonomous execution from plan to done.**

- Entry point: `/cipherpowers:plan` (or similar) kicks off entire lifecycle
- Execution model: Autonomous - only stops on BLOCKING issues
- No human intervention required unless critical issues discovered

---

## 2. Terminology

**Everything is a Task.** No "Step" vs "Task" confusion.

```markdown
## 1. Review code          ← Task 1
## 2. Run tests            ← Task 2
## 3. Post-collation       ← Task 3 (has subtasks)
### 3.A Cross-check        ← Task 3.A (parallel subtask)
### 3.B Revise             ← Task 3.B (parallel subtask)
## 4. Finalize             ← Task 4
```

---

## 3. TaskId Type

```typescript
interface TaskId {
  readonly task: number | string;      // 1, 2, 3 or "review", "test"
  readonly subtask?: number | string;  // 'A', 'B' or 1, 2 (optional)
}
```

**Examples:**
```typescript
{ task: 1 }                    // Task 1 (simple)
{ task: 3 }                    // Task 3 (has subtasks)
{ task: 3, subtask: 'A' }      // Task 3.A (parallel subtask)
{ task: 3, subtask: 'B' }      // Task 3.B (parallel subtask)
```

**Display:**
```typescript
function formatTaskId(id: TaskId): string {
  if (id.subtask !== undefined) {
    return `${id.task}.${id.subtask}`;
  }
  return `${id.task}`;
}
```

---

## 4. Workflow Commands

```bash
workflow start <file>          # Start workflow
workflow next                  # Advance (defaults to --pass)
workflow next --pass           # Explicit pass → follow PASS action path
workflow next --fail           # Explicit fail → follow FAIL action path
workflow next --pass --task 3.A # For parallel subtasks
workflow status                # Show current state
workflow stop                  # Abort workflow
```

**Why --pass/--fail?** Workflow needs to know the result to follow correct action path (CONTINUE vs RETRY vs GOTO).

**Why --task?** For parallel subtasks, need to specify which task completed.

---

## 5. CLI Output

When workflow reaches terminal state, output using existing workflow language:

```bash
# Workflow completed successfully (hit DONE action)
workflow next --pass
→ Output: "WORKFLOW: DONE"

# Workflow halted (hit STOP action)
workflow next --fail
→ Output: "WORKFLOW: STOP"
```

**No new terminology** - uses existing actions: DONE, STOP.

---

## 6. Status Alignment

**Current (inconsistent):**
```typescript
// TaskState
status: 'pending' | 'running' | 'complete' | 'blocked'

// Actions
type: 'CONTINUE' | 'STOP' | 'GOTO' | 'DONE' | 'RETRY'
```

**Proposed (aligned):**
```typescript
type ExecutionStatus = 'pending' | 'running' | 'done' | 'stopped' | 'blocked';

// Used by both TaskState and WorkflowState
```

Maps to actions: `DONE → 'done'`, `STOP → 'stopped'`

---

## 7. TaskState Interface

```typescript
interface TaskState {
  readonly id: TaskId;           // Proper type: { task: 3, subtask: 'A' }
  readonly agentId?: string;     // From SubagentStop hook (v2.0.42+)
  readonly toolUseId?: string;   // From PostToolUse hook (v2.0.43+)
  readonly status: ExecutionStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
}
```

---

## 8. WorkflowState Interface

```typescript
interface WorkflowState {
  readonly id: string;
  readonly workflow: string;
  readonly currentTask: TaskId;              // Current position
  readonly status: ExecutionStatus;          // NEW: 'active' | 'done' | 'stopped'
  readonly retryCount: number;
  readonly retryMax: number;
  readonly variables: Record<string, boolean | number | string>;
  readonly tasks: readonly TaskState[];
  readonly startedAt: string;
  readonly updatedAt: string;
}
```

---

## 9. Hook Integration - agent_id

> **Verified 2025-12-22** via Claude Code documentation and CHANGELOG.

### Version Requirements
- **Minimum:** Claude Code v2.0.42+ (for `agent_id` in SubagentStop)
- **Recommended:** Claude Code v2.0.43+ (for SubagentStart hook and `tool_use_id`)

### PostToolUse (Task dispatch detection)
```typescript
{
  session_id: string;
  tool_name: "Task";
  tool_input: {
    description: string;    // "3.A - Cross-check" → parse TaskId
    prompt: string;
    subagent_type: string;
  };
  tool_response: string;
  tool_use_id: string;      // v2.0.43+ - potential correlation key
  // NOTE: agent_id is NOT available here
}
```

### SubagentStart (v2.0.43+)
```typescript
{
  subagent_type: string;    // Unverified - payload poorly documented
  // agent_id presence unknown - needs testing
}
```

### SubagentStop (agent completion)
```typescript
{
  agent_id: string;              // CONFIRMED: Unique agent identifier (v2.0.42+)
  agent_transcript_path: string; // Transcript file path
  output: string;                // Agent's output
}
```

### Correlation Strategy
1. **PostToolUse:** Capture `tool_input.description` + `tool_use_id`
2. **SubagentStop:** Receive `agent_id`
3. **Correlation:** Test if `tool_use_id` correlates with `agent_id`, or use timing+description matching

**This enables reliable task matching for parallel execution.**

---

## 10. Agent-Task Mapping

**At dispatch (PostToolUse for Task tool):**
```typescript
// Parse TaskId from description
const taskId = parseTaskId(input.tool_input.description);
// "3.A - Cross-check" → { task: 3, subtask: 'A' }

// Store pending mapping (no agent_id yet)
{
  toolUseId: input.tool_use_id,  // v2.0.43+
  description: input.tool_input.description,
  parentTask: taskId,
  workflowId: "wf-xxx",
  status: "dispatched"
}
```

**At completion (SubagentStop):**
```typescript
// Receive agent_id
const agentId = input.agent_id;  // "xyz789"

// Correlate with pending dispatch
// Option A: tool_use_id === agent_id (needs testing)
// Option B: Match by timing + description

// Update mapping with agent_id
mapping.agentId = agentId;
mapping.status = "completed";

// Check subagent's workflow status
const subagentWorkflow = loadWorkflow(mapping.workflowId);
// → status: "done" or "stopped"

// Update parent workflow
workflow next --pass --task 3.A  // or --fail
```

---

## 11. Parallel Subtask Flow

```
Main Agent:
  workflow start verify.workflow.md

== Task 3: Parallel subtasks ==
  Dispatch: Task(description: "3.A - Cross-check", ...)
  Dispatch: Task(description: "3.B - Revise", ...)

PostToolUse (for each Task dispatch):
  → tool_name = "Task"
  → Parse TaskId from tool_input.description
  → Store pending: { toolUseId: "tu-1", task: 3.A, status: "dispatched" }
  → Store pending: { toolUseId: "tu-2", task: 3.B, status: "dispatched" }
  ⚠️ No agent_id available yet

Subagent "xyz" runs its own workflow:
  workflow start task.workflow.md
  → Tasks 1, 2, 3...
  → workflow next --pass
  → WORKFLOW: DONE

SubagentStop (agent_id: "xyz"):
  → Correlate: agent_id "xyz" ↔ pending task 3.A
  → Update mapping: { agentId: "xyz", task: 3.A, status: "completed" }
  → Check subagent workflow: DONE
  → All subtasks done? NO (3.B still running)
  → Wait

Subagent "abc" completes:
  → WORKFLOW: DONE

SubagentStop (agent_id: "abc"):
  → Correlate: agent_id "abc" ↔ pending task 3.B
  → All subtasks done? YES
  → Evaluate: PASS (ALL)? YES
  → workflow next --pass
  → Advance to Task 4
```

---

## 12. Built-in Workflow Gate

**Architecture:**
- Code is builtin in turboshovel core
- User opts-in via gates.json configuration

```json
{
  "gates": {
    "workflow-track": {
      "type": "builtin:workflow-track"
    },
    "workflow-advance": {
      "type": "builtin:workflow-advance"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Task"],
      "gates": ["workflow-track"]
    },
    "SubagentStop": {
      "gates": ["workflow-advance"]
    }
  }
}
```

**workflow-track (PostToolUse) behavior:**
1. Check if `tool_name === "Task"`
2. Parse TaskId from `tool_input.description`
3. Store pending dispatch: `{ toolUseId, description, parentTask }`

**workflow-advance (SubagentStop) behavior:**
1. Get `agent_id` from hook input
2. Correlate with pending dispatch (toolUseId or timing)
3. Read subagent's workflow state
4. If DONE → call `workflow next --pass --task X`
5. If STOP → call `workflow next --fail --task X`

---

## 13. Qualifiers for Parallel Subtasks

```markdown
## 3. Post-collation
### 3.A Cross-check
### 3.B Revise

# Aggregation conditions
- PASS (ALL): CONTINUE    # All subtasks must pass
- PASS (ANY): CONTINUE    # Any subtask passes
- FAIL (ANY): STOP        # Any subtask fails
```

**Defaults (backwards compatible):**
- `PASS` alone = `PASS (ALL)`
- No PASS line → `PASS: CONTINUE`
- No FAIL line → `FAIL: STOP`

---

## Open Questions (Resolved)

> All questions verified 2025-12-22 via research agent.

### ✅ Q1: Does PostToolUse (Task) include tool_input?
**YES.** PostToolUse includes complete `tool_input` object with `description`, `prompt`, and `subagent_type`.

### ✅ Q2: Does PostToolUse (Task) include agent_id?
**NO.** `agent_id` is only available in SubagentStop (since v2.0.42).

### ✅ Q3: Does SubagentStart hook exist?
**YES** (since v2.0.43). Added in CHANGELOG but poorly documented - payload structure needs testing.

### ✅ Q4: How to get TaskId at dispatch time?
**Solution:** Parse TaskId from `tool_input.description` in PostToolUse hook.
- Task descriptions follow pattern: "3.A - Cross-check"
- Extract TaskId with regex: `/^(\d+)\.([A-Z])/` or similar

### Remaining Gaps (Require Testing)
1. Whether `tool_use_id` (PostToolUse) correlates with `agent_id` (SubagentStop)
2. SubagentStart exact payload structure (does it include `agent_id`?)
3. Execution order: SubagentStart vs PostToolUse for Task tool

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/workflow/types.ts` | Add TaskId type, update TaskState, add ExecutionStatus |
| `src/workflow/state.ts` | Add agent mapping storage |
| `src/workflow/hooks/task-tracker.ts` | Capture agent_id, store mapping |
| `src/workflow/hooks/subagent-stop.ts` | Lookup mapping, check workflow status, call CLI |
| `src/cli/workflow-cli.ts` | Add --pass/--fail/--task flags |
| `src/workflow/parser/` | Parse subtask syntax (### under ##) |

---

## Next Steps

1. ~~**Verify Claude Code hooks** - What fields are now available in PostToolUse and SubagentStop?~~ ✅ DONE
2. ~~**Resolve TaskId at dispatch** - How to map dispatch to workflow task?~~ ✅ DONE (parse from description)
3. **Test hook behavior** - Verify `tool_use_id`↔`agent_id` correlation and SubagentStart payload
4. **Update turboshovel HookInput type** - Add `tool_input`, `tool_use_id` fields
5. **Create implementation plan** - TDD tasks for each component
