# Turboshovel Workflow System Design

> **Core Insight:** Workflows are executable skills.
>
> **Turboshovel:** What if skills, but executable?

## The Problem

Agents skip steps under pressure. Skills provide guidance, but compliance drops to ~33% under load. Manual orchestration (running commands, clearing context, tracking progress) is tedious.

## The Vision

Merge the deprecated cipherpowers workflow tool (Rust) with turboshovel's hooks system to create:

- **Markdown workflows** that define processes
- **Hooks that enforce compliance** (BLOCK on failure)
- **Context injection** that keeps agents on track
- **State tracking** that survives context clears and sessions

---

## Design Decisions (from brainstorming)

### Activation Model: Hybrid
- Some workflows are explicit (`/workflow feature.md`)
- Some auto-trigger via commands (`/execute` → `execute.workflow.md`)
- Agents can discover and use workflows from context

### State Scope: Layered
```
Session (long-lived)
  └─> Command (/execute)
        └─> SubAgent (code-exec-agent)
              └─> Skill/Workflow (task-specific)
```
Each layer has appropriate state lifetime.

### Enforcement: Hybrid with Escalation
1. Trust agent to evaluate (soft guidance)
2. Verify with gates/checks
3. BLOCK and force retry if agent claims "done" but check fails

### Workflow Composition: Multiple Files
- Workflows reference other workflows
- Explicit: `workflow: task.workflow.md`
- Convention: step "execute" discovers `execute.workflow.md`

### Command Binding: Explicit References
- Steps explicitly reference commands/skills: `command: /execute`
- Reduces context, clear intent
- Context injection supports but doesn't drive execution

### Implementation: TypeScript Only
- Extend turboshovel's hooks-app
- Single codebase, simpler maintenance

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Markdown Workflows                                          │
│  - Define steps, nesting, loops                              │
│  - Reference commands/skills to execute                      │
│  - Specify gates/checks at each step                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Hooks + Checks (turboshovel)                                │
│  - Track workflow state across clears/sessions               │
│  - Inject context: "Step 3 of Execute, Task 2 of 5"          │
│  - Run gates, BLOCK on failure                               │
│  - Escalate if agent claims done but check fails             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Commands, Agents + Skills (Claude Code / cipherpowers)      │
│  - Do the actual work                                        │
│  - Receive context from hooks                                │
│  - Report completion, get verified                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Unification Model

| Before | After |
|--------|-------|
| `/execute` runs execute logic | `/execute` starts `execute.workflow.md` |
| Skill doc says "do these steps" | Workflow enforces steps, tracks progress |
| Agent follows guidance (maybe) | System verifies, BLOCKs on failure |

**Three activation paths:**
1. **Explicit:** `/workflow path/to/feature.workflow.md`
2. **Command wrapper:** `/execute` auto-binds to its workflow file
3. **Agent initiative:** Agent sees context, discovers workflow, uses it

---

## Example: Nested Workflow Structure

```
Feature Workflow (feature.workflow.md)
├── brainstorm (interactive)
├── plan
│     └─ Plan Workflow (plan.workflow.md)
│           ├── verify-technical
│           ├── verify-security
│           └── verify-architecture
├── verify (plan review)
├── execute
│     └─ Execute Workflow (execute.workflow.md)
│           ├── Task 1..N
│           │     └─ Task Workflow (task.workflow.md)
│           │           ├── code
│           │           ├── test → fix loop
│           │           ├── commit
│           │           └── code-review → fix loop
│           ├── check → fix loop
│           └── final review → fix loop
└── verify-docs
```

---

## Workflow Syntax (Extended Rust Format)

Keep the Rust workflow tool syntax, extend with new block types:

```markdown
# Execute Workflow

## 1. Load plan

Check for existing plan in work directory.

```bash
test -f plan.md
```

- PASS: CONTINUE
- FAIL: STOP No plan found. Run /plan first.

## 2. Execute batch

```command
/cipherpowers:execute-batch
```

workflow: task.workflow.md

## 3. Commit changes

```command
/cipherpowers:commit
```

- PASS: CONTINUE
- FAIL: RETRY

## 4. Code review

```command
/cipherpowers:code-review
```

- PASS: CONTINUE
- FAIL: RETRY

## 5. Next batch or complete

- IF: batches_remaining > 0
  - GOTO: 2
- ELSE: CONTINUE
```

**Extensions to Rust syntax:**

| New Element | Purpose |
|-------------|---------|
| ` ```command ``` ` | Invoke Claude Code command (vs `bash` for shell) |
| `workflow:` | Nested workflow reference |
| `RETRY` | New action - loop back to retry current step |
| `IF/ELSE` | Conditional branching (extend GOTO) |

**What's NOT in workflows:**
- No inline gate references - gates configured separately
- No template variables - state auto-injected as context

---

## Separation of Concerns

**Workflows = Pure Process**
- Steps and order
- Nesting (workflow references)
- Commands to invoke
- Control flow (CONTINUE, STOP, GOTO, RETRY)

**Gates = Enforcement**
- Configured in `gates.json`
- Fire based on hooks + workflow state
- Determine when to BLOCK
- No workflow knowledge needed in gate config

**Connection via Workflow State**

Gates don't reference workflows. Instead, dispatcher provides workflow context:
```typescript
// When gate runs, it receives:
{
  workflow: "execute.workflow.md",
  step: 3,
  step_name: "Commit changes",
  command: "/cipherpowers:commit"
}
```

Gate can use this to decide relevance (or gates just run unconditionally on their configured hooks).

---

## State Management

**Location:** `.claude/turboshovel/` (configurable via `gates.json`)

**Layered model:**

```
┌─────────────────────────────────────────────────────────────┐
│ Work State (persistent across sessions)                      │
│ .claude/turboshovel/workflows/{workflow-id}.state.json      │
│ - Which phase, which batch, completed tasks                  │
│ - Survives session end                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Session State (.claude/.session.json)                        │
│ - Active workflow, current step                              │
│ - Survives /clear within session                             │
│ - Already exists in turboshovel                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Context Injection (ephemeral)                                │
│ - Computed from session + work state                         │
│ - Injected at each hook event                                │
│ - "You are on step 3 of execute.workflow.md"                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Hook Integration

**New hook:** `WorkflowStepComplete`
- Fires when workflow step finishes
- Before advancing to next step
- Gates can run and BLOCK if needed

**Workflow-aware dispatcher:**

```
Hook fires (e.g., SlashCommandEnd)
         │
         ▼
Is workflow active? ─── No ──→ Normal gate processing
         │
        Yes
         │
         ▼
What step are we on?
What command just ran?
         │
         ▼
Update workflow state
         │
         ▼
Fire WorkflowStepComplete
         │
         ▼
Run configured gates
         │
         ▼
PASS → Advance step
FAIL → BLOCK or RETRY based on workflow
```

---

## Implementation Approach

**Phase 1: Workflow Parser**
- Port Rust markdown parser to TypeScript
- Add new block types (command, workflow reference)
- Test against existing workflow examples

**Phase 2: State Management**
- Extend session.ts for workflow state
- Add persistent state in `.claude/turboshovel/`
- State load/save on workflow start/step complete

**Phase 3: Dispatcher Integration**
- Add workflow awareness to existing dispatcher
- Implement WorkflowStepComplete hook
- Context injection based on workflow state

**Phase 4: Command Wrappers**
- `/workflow` command for explicit activation
- Wire existing commands (if desired) to auto-bind workflows

---

## Nested Workflow State Model

**Pattern:** Main agent spawns subagents that run nested workflows. SubagentStop hook is the bridge for state updates.

**State structure:**
```json
{
  "workflow": "execute.workflow.md",
  "workflow_id": "exec-2025-12-19-abc123",
  "step": 2,
  "step_name": "Execute batch",

  "nested": {
    "workflow": "task.workflow.md",
    "total": 5,
    "completed": 2,
    "instances": [
      { "id": "task-1", "status": "complete", "result": "success" },
      { "id": "task-2", "status": "complete", "result": "success" },
      { "id": "task-3", "status": "running" },
      { "id": "task-4", "status": "pending" },
      { "id": "task-5", "status": "pending" }
    ]
  }
}
```

**SubagentStop hook flow:**
1. Match subagent to tracked nested instance
2. Mark instance complete, update count
3. If all nested complete → fire WorkflowStepComplete, advance parent
4. If more remain → inject context: "Task 3 done. Spawn task 4."

**Context injection:**
- Subagent receives: workflow it's running, task ID, parent context
- Main agent receives after SubagentStop: progress update, next action

---

## Workflow Lifecycle

**Start:** `/workflow path/to/workflow.md` or command auto-binds
- Creates workflow state with unique ID
- Sets session active_workflow

**Pause:** User runs other commands or clears context
- Session state persists
- Context re-injected on next prompt

**Resume:** `/workflow --resume <workflow-id>` or auto-resume on SessionStart
- Loads workflow state from `.claude/turboshovel/`
- Injects current step context

**Stop/Abandon:** `/workflow --stop`
- Removes workflow state
- Clears session active_workflow

**Out-of-workflow commands:** Normal behavior, no warning
- Flexibility is most important
- Workflow state simply doesn't advance

---

## Design Complete

**Summary of key decisions:**

1. **Core concept:** Workflows are executable skills
2. **Syntax:** Keep + extend Rust workflow tool format
3. **Separation:** Workflows = process, Gates = enforcement
4. **State:** Layered (session + persistent), in `.claude/turboshovel/`
5. **Hooks:** Add `WorkflowStepComplete`, layer on existing hooks
6. **Nested:** SubagentStop bridges child → parent state
7. **Implementation:** TypeScript only, extend hooks-app

---

## Reference Files

**Rust workflow tool (for porting):**
- `.reference/workflow/src/parser.rs` - Markdown parser
- `.reference/workflow/src/runner.rs` - Execution engine
- `.reference/workflow/src/models.rs` - Data types

**Turboshovel hooks (to extend):**
- `plugin/hooks/hooks-app/src/dispatcher.ts` - Gate dispatch
- `plugin/hooks/hooks-app/src/session.ts` - Session state
- `plugin/hooks/hooks-app/src/context.ts` - Context injection
