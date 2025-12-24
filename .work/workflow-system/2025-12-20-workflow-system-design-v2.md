# Turboshovel Workflow System Design (v2)

> **Core Insight:** Workflows are executable skills.
>
> **Turboshovel:** What if skills, but executable?

## The Problem

Agents skip steps under pressure. Skills provide guidance, but compliance drops under load. Manual orchestration is tedious.

## The Vision

Merge the deprecated cipherpowers workflow tool with turboshovel's hooks system:

- **Markdown workflows** that define processes
- **CLI tool** for agents to manage workflow state
- **Hooks that track** Task dispatches and workflow transitions
- **Context injection** that keeps agents on track
- **State tracking** that survives context clears and sessions

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Markdown Workflows                                          │
│  - Define steps, nesting, loops                              │
│  - Reference nested workflows                                │
│  - Specify actions (CONTINUE, STOP, RETRY, GOTO)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Workflow CLI Tool                                           │
│  - workflow start/next/complete/status                       │
│  - Agents invoke via Bash tool                               │
│  - Reads/writes state to .claude/turboshovel/               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Hooks (turboshovel)                                         │
│  - PostToolUse: Track Task dispatches                        │
│  - PostToolUse: Observe workflow CLI calls                   │
│  - SubagentStop: Capture subagent completion                 │
│  - Inject context based on workflow state                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Workflow Execution Model

### Main Agent + Subagent Pattern

```
MAIN AGENT                              SUBAGENT
══════════                              ════════

workflow start execute.workflow.md
         │
Step 3: Execute batch
         │
    Task(subagent_type, prompt)  →  workflow start task.workflow.md
         │                                   │
         │                               Step 1: Do work
         │                                   │
         │                               Step 2: Code review ◄──┐
         │                                   │                  │
         │                               Step 3: Fix blocking ──┘
         │                                   │
         │                               workflow complete
         │                                   │
    SubagentStop hook fires      ←───────────┘
         │
    [All subagents done?]
         │
    workflow next
         │
    Step 4: ...
```

### Key Commands

| Command | Purpose |
|---------|---------|
| `workflow start <file>` | Start workflow (main or nested) |
| `workflow next` | Advance to next step (validates first) |
| `workflow next --step N` | Jump to specific step (for loops) |
| `workflow complete` | Mark workflow done (subagent finishing) |
| `workflow status` | Show current workflow state |
| `workflow list` | List all active/paused workflows |
| `workflow stop` | Abort current workflow |
| `workflow resume <id>` | Resume paused workflow |

---

## Workflow Syntax

### Basic Structure

```markdown
# Execute Workflow

## 1. Load plan

Load plan from path or discover in `.work/` directory.

- PASS: CONTINUE
- FAIL: STOP "No plan file found."

## 2. Execute batch

workflow: task.workflow.md

- PASS: CONTINUE
- BLOCKED: STOP
- FAIL: RETRY 3

## 3. Check progress

- IF: more_batches
  - GOTO: 2
- ELSE: CONTINUE

## 4. Complete

- DONE
```

### Actions

| Action | Behavior |
|--------|----------|
| `CONTINUE` | Proceed to next step |
| `STOP [message]` | End workflow with failure |
| `DONE` | End workflow with success |
| `GOTO N` | Jump to step N |
| `RETRY [N]` | Retry current step (max N times, default 3) |

### Conditions

Minimal truthy/falsy checks only:

```markdown
- IF: more_batches
  - GOTO: 2
- ELSE: CONTINUE

- IF: NOT has_blocking_issues
  - CONTINUE
```

**No expression language.** Variables are booleans set by commands/CLI.

### Nested Workflows

```markdown
## 3. Execute batch

workflow: task.workflow.md

- PASS: CONTINUE
```

Step references another workflow file. Subagent starts that workflow, runs to completion.

---

## State Management

### Location

`.claude/turboshovel/workflows/`

### State Structure

```json
{
  "id": "exec-2025-12-20-abc123",
  "workflow": "execute.workflow.md",
  "step": 3,
  "step_name": "Execute batch",
  "retry_count": 0,
  "retry_max": 3,
  "variables": {
    "more_batches": true,
    "completed_batches": 1,
    "total_batches": 3
  },
  "tasks": [
    { "id": "task-abc", "status": "complete" },
    { "id": "task-def", "status": "running" },
    { "id": "task-ghi", "status": "pending" }
  ],
  "nested": {
    "workflow": "task.workflow.md",
    "instances": [...]
  }
}
```

### Layered State

```
┌─────────────────────────────────────────────────────────────┐
│ Persistent State (survives sessions)                        │
│ .claude/turboshovel/workflows/{id}.json                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Session State (survives /clear)                             │
│ .claude/.session.json - active workflow reference           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Context Injection (ephemeral)                               │
│ Computed from state, injected at each hook                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Hook Integration

### Task Tracking

```
Agent uses Task tool
        │
        ▼
PostToolUse hook (Task)
        │
        ▼
Is workflow active? ──No──→ Normal behavior
        │
       Yes
        │
        ▼
Register task in workflow state
        │
        ▼
... subagent runs ...
        │
        ▼
SubagentStop hook
        │
        ▼
Update task status
        │
        ▼
All tasks for step done? ──No──→ Wait
        │
       Yes
        │
        ▼
Context injection: "All tasks complete. Run: workflow next"
```

### Workflow CLI Observation

```
Agent runs: workflow next
        │
        ▼
PostToolUse hook (Bash)
        │
        ▼
Parse "workflow" command
        │
        ▼
Update session state with new step
        │
        ▼
Fire WorkflowStepComplete (if configured)
```

---

## RETRY Loop Control

### Syntax

```markdown
- FAIL: RETRY 3      # Max 3 retries
- FAIL: RETRY        # Uses default
```

### Behavior

State tracks:
```json
{
  "step": 3,
  "retry_count": 1,
  "retry_max": 3
}
```

When `retry_count >= retry_max`:
- RETRY becomes STOP
- Clear error message with retry history

### Global Default

In workflow config or `gates.json`:
```json
{
  "workflow": {
    "default_retry_max": 3
  }
}
```

---

## User Visibility

### CLI Commands

```bash
workflow status              # Current workflow state
workflow list                # All workflows
workflow stop                # Abort
workflow resume <id>         # Resume paused
```

### BLOCKED Messages

Context injection includes:

```
⚠️ WORKFLOW BLOCKED

Workflow: execute.workflow.md
Step: 3. Code review
Attempt: 2 of 3
Reason: BLOCKING issues found

Actions:
- Fix issues, run: workflow next
- Skip step: workflow next --force
- Abort: workflow stop
```

---

## Design Decisions Summary

| Decision | Choice |
|----------|--------|
| Tool interface | CLI (Bash), not MCP |
| Conditions | Truthy/falsy only, no expressions |
| Variables | Set by commands/CLI, stored in state |
| Retry control | `RETRY [N]` with default limit |
| Task tracking | Hooks observe Task tool |
| Subagent workflows | Self-contained, own quality loops |
| Main agent control | Calls `workflow next` when ready |
| Separation | Workflows = process, Gates = enforcement |

---

## Implementation Phases

### Phase 1: Workflow CLI

- TypeScript CLI tool: `workflow`
- Commands: start, next, complete, status, stop
- State management in `.claude/turboshovel/`
- Basic workflow parser

### Phase 2: Hook Integration

- PostToolUse hook for Task tool tracking
- PostToolUse hook for workflow CLI observation
- SubagentStop hook for completion tracking
- Context injection from workflow state

### Phase 3: Parser

**Library:** `micromark` (streaming tokenizer)

**Strategy:** State-machine consuming micromark event stream, direct analog to Rust's pulldown-cmark pattern. Provides fine-grained control for custom AST construction.

**Architecture:**
```
micromark events → WorkflowParser class → Workflow AST
                   (state machine)
```

**Implementation:**
- `WorkflowParser` class consumes micromark token stream
- Explicit state management for step/action/condition parsing
- Port all 41 `#[test]` cases from `parser.rs` as Jest specification
- Example workflows (`examples/*.md`) as integration fixtures

**Types:**
```typescript
// Discriminated unions prevent invalid states at compile time
type Action =
  | { readonly type: 'CONTINUE' }
  | { readonly type: 'STOP'; readonly message?: string }
  | { readonly type: 'GOTO'; readonly step: StepNumber };

// Branded type - cannot assign generic number
type StepNumber = number & { readonly __brand: 'StepNumber' };

// Factory enforces constraints (positive integer)
function createStepNumber(n: number): StepNumber | null {
  return n > 0 && Number.isInteger(n) ? (n as StepNumber) : null;
}
```

**Error Handling (two-level):**
- **Fatal:** `throw new WorkflowSyntaxError()` for syntax/validation failures (non-sequential steps, invalid GOTO targets)
- **Non-fatal:** `console.warn()` for recoverable issues (GOTO to self = infinite loop warning) - mirrors Rust's `eprintln!`

**Risks:**
- Implicit prompt detection (HIGH) - complex state-dependent rules
- Separator permissiveness (HIGH) - must match Rust exactly

**Fallback:** `pulldown-cmark-wasm` for exact Rust parity if needed

**Effort:** ~15 hours (validated estimate)

### Phase 4: Gates Integration

- WorkflowStepComplete hook
- Gate firing based on workflow state
- BLOCK/RETRY integration

---

## Open Questions

1. **MCP interface**: Add later for cleaner tool integration?
2. **Parallel task syntax**: How to express parallel vs serial in workflow file?

---

## Reference Files

**Rust workflow tool (for porting):**
- `.reference/workflow/src/parser.rs`
- `.reference/workflow/src/runner.rs`
- `.reference/workflow/src/models.rs`

**Turboshovel hooks (to extend):**
- `plugin/hooks/hooks-app/src/dispatcher.ts`
- `plugin/hooks/hooks-app/src/session.ts`
- `plugin/hooks/hooks-app/src/context.ts`

**Cipherpowers (workflow patterns):**
- `/Users/tobyhede/src/cipherpowers/docs/BUILD/WORKFLOW.md`
- `/Users/tobyhede/src/cipherpowers/plugin/skills/executing-plans/SKILL.md`

**Parser research (2025-12-20):**
- `.work/2025-12-20-verify-research-collated-143900.md` - Consolidated findings
- `.work/2025-12-20-verify-research-crosscheck-153916.md` - Validated estimates
