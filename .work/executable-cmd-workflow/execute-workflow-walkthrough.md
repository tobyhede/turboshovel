# Execute Workflow: High-Level Summary & Walkthrough

## What Is It?

The Execute Workflow is a **state machine for plan execution**. It replaces the 189-line `executing-plans` skill with an enforceable, persistent workflow that survives context clears.

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEFORE (Skill-Based)                         │
├─────────────────────────────────────────────────────────────────┤
│  User: /execute plan.md                                         │
│      ↓                                                          │
│  Claude reads skill → Interprets steps → Hopes to remember      │
│      ↓                                                          │
│  [Context clear] → Progress lost → Start over                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    AFTER (Workflow-Based)                       │
├─────────────────────────────────────────────────────────────────┤
│  User: workflow start execute.workflow.md                       │
│      ↓                                                          │
│  CLI creates state file → Steps enforced → Progress persisted   │
│      ↓                                                          │
│  [Context clear] → workflow status → Resume where you left off  │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Big Picture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         EXECUTE WORKFLOW                                  │
│                                                                          │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│   │ 1. Load │───▶│ 2. Track│───▶│ 3. Batch│───▶│ 4. Review│             │
│   │   Plan  │    │  Tasks  │    │ Execute │    │   Code   │             │
│   └─────────┘    └─────────┘    └────┬────┘    └────┬─────┘             │
│                                      │              │                    │
│                                      │              ▼                    │
│                                      │         ┌─────────┐              │
│                                      │         │ 5. Report│             │
│                                      │         │  & Wait  │             │
│                                      │         └────┬─────┘             │
│                                      │              │                    │
│                                      │              ▼                    │
│                                      │         ┌─────────┐              │
│                                      │         │ 6. More  │──── NO ────▶│
│                                      │         │ Batches? │             │
│                                      │         └────┬─────┘             │
│                                      │              │                    │
│                                      │             YES                   │
│                                      │              │                    │
│                                      ◀──────────────┘                    │
│                                     GOTO 3                               │
│                                                                          │
│                                                         ┌─────────┐     │
│                                              ──────────▶│ 7. Done │     │
│                                                         └─────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Walkthrough

### Step 1: Load Plan

```
┌─────────────────────────────────────────────┐
│  INPUT: Plan file path (plan.md)            │
│                                             │
│  ACTIONS:                                   │
│  • Read plan file                           │
│  • Review critically for concerns           │
│  • If concerns → STOP, discuss with user    │
│                                             │
│  COMMAND: test -f plan.md                   │
│                                             │
│  EXIT 0 → PASS → CONTINUE to Step 2        │
│  EXIT ≠0 → FAIL → STOP "Plan not found"    │
└─────────────────────────────────────────────┘
```

### Step 2: Create Task Tracking

```
┌─────────────────────────────────────────────┐
│  INPUT: Parsed plan with tasks              │
│                                             │
│  ACTIONS:                                   │
│  • Create TodoWrite entries for each task   │
│  • Mark all as 'pending'                    │
│                                             │
│  NO COMMAND (Claude-controlled step)        │
│                                             │
│  Agent runs: workflow next --skip-exec      │
│  → Advances to Step 3                       │
└─────────────────────────────────────────────┘
```

### Step 3: Execute Batch

```
┌─────────────────────────────────────────────────────────────────────┐
│  THE HEART OF THE WORKFLOW                                          │
│                                                                     │
│  For each task in batch (default: 3):                               │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ Mark task   │───▶│ Select agent│───▶│ Dispatch    │             │
│  │ in_progress │    │ (semantic)  │    │ with skill  │             │
│  └─────────────┘    └─────────────┘    └──────┬──────┘             │
│                                               │                     │
│                                               ▼                     │
│                     ┌─────────────────────────────────────┐        │
│                     │  Agent executes task                 │        │
│                     │  Reports STATUS: OK or BLOCKED       │        │
│                     └─────────────────────────────────────┘        │
│                                                                     │
│  COMMAND: npm test                                                  │
│                                                                     │
│  EXIT 0 → PASS → CONTINUE to Step 4                                │
│  EXIT ≠0 → FAIL → RETRY (up to 3 times, then STOP)                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Agent Selection (Semantic, Not Keyword):**

```
┌───────────────────────────────────────────────────────────────┐
│  Task Type              │  Agent                              │
├───────────────────────────────────────────────────────────────┤
│  Rust implementation    │  rust-exec-agent                    │
│  General implementation │  code-exec-agent                    │
│  Complex debugging      │  ultrathink-debugger                │
│  Documentation          │  technical-writer                   │
└───────────────────────────────────────────────────────────────┘
```

### Step 4: Code Review (MANDATORY)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️  THIS STEP CANNOT BE SKIPPED                                    │
│                                                                     │
│  ACTIONS:                                                           │
│  • Dispatch code-review-agent                                       │
│  • Categorize issues: BLOCKING vs NON-BLOCKING                      │
│  • BLOCKING issues → Must fix before proceeding                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  Review dispatched                                       │       │
│  │      ↓                                                   │       │
│  │  Issues found?                                           │       │
│  │      ├── BLOCKING → FAIL → STOP "Fix before continuing" │       │
│  │      └── NON-BLOCKING only → PASS → CONTINUE            │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  WHY MANDATORY?                                                     │
│  Workflow enforces Step 4 must complete before Step 5.              │
│  There is no way to skip from Step 3 to Step 5.                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 5: Report and Wait

```
┌─────────────────────────────────────────────┐
│  ACTIONS:                                   │
│  • Show what was implemented                │
│  • Show verification output                 │
│  • Say: "Ready for feedback."               │
│                                             │
│  WAIT for user input/feedback               │
│                                             │
│  Agent runs: workflow next --skip-exec      │
│  → Advances to Step 6                       │
└─────────────────────────────────────────────┘
```

### Step 6: Check More Batches (The Loop)

```
┌─────────────────────────────────────────────────────────────────────┐
│  THE DECISION POINT                                                 │
│                                                                     │
│         ┌─────────────────┐                                         │
│         │ More pending    │                                         │
│         │ tasks in plan?  │                                         │
│         └────────┬────────┘                                         │
│                  │                                                  │
│         ┌───────┴───────┐                                          │
│         │               │                                          │
│        YES              NO                                          │
│         │               │                                          │
│         ▼               ▼                                          │
│    ┌─────────┐    ┌─────────┐                                      │
│    │ GOTO 3  │    │CONTINUE │                                      │
│    │ (loop)  │    │to Step 7│                                      │
│    └─────────┘    └─────────┘                                      │
│                                                                     │
│  HOW IT WORKS:                                                      │
│  • Agent checks TodoWrite for pending tasks                         │
│  • If more: workflow next --exit-code 1 → FAIL → GOTO 3            │
│  • If done: workflow next --exit-code 0 → PASS → CONTINUE          │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 7: Complete Development

```
┌─────────────────────────────────────────────┐
│  FINAL STEP                                 │
│                                             │
│  ACTIONS:                                   │
│  • Verify all tests pass                    │
│  • Present completion options:              │
│    1. Merge locally                         │
│    2. Create PR                             │
│    3. Keep as-is                            │
│    4. Discard                               │
│  • Execute user's choice                    │
│                                             │
│  COMMAND: npm test && npm run build         │
│                                             │
│  EXIT 0 → PASS → DONE (workflow complete)  │
│  EXIT ≠0 → FAIL → STOP "Fix before done"   │
└─────────────────────────────────────────────┘
```

---

## The Batch Loop in Action

```
Plan with 7 tasks:
┌─────────────────────────────────────────────────────────────────────┐
│  Task 1  │  Task 2  │  Task 3  │  Task 4  │  Task 5  │  Task 6  │ 7 │
└─────────────────────────────────────────────────────────────────────┘

Execution:

BATCH 1 (Tasks 1-3)
├── Step 3: Execute tasks 1, 2, 3
├── Step 4: Code review
├── Step 5: Report "Ready for feedback"
└── Step 6: more_batches=true → GOTO 3

BATCH 2 (Tasks 4-6)
├── Step 3: Execute tasks 4, 5, 6
├── Step 4: Code review
├── Step 5: Report "Ready for feedback"
└── Step 6: more_batches=true → GOTO 3

BATCH 3 (Task 7)
├── Step 3: Execute task 7
├── Step 4: Code review
├── Step 5: Report "Ready for feedback"
└── Step 6: more_batches=false → CONTINUE

Step 7: Complete development → DONE
```

---

## Command Execution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      workflow next                                   │
│                           │                                          │
│                           ▼                                          │
│              ┌────────────────────────┐                             │
│              │ Step has bash command? │                             │
│              └───────────┬────────────┘                             │
│                          │                                          │
│              ┌───────────┴───────────┐                              │
│              │                       │                              │
│             YES                      NO                             │
│              │                       │                              │
│              ▼                       ▼                              │
│     ┌─────────────────┐     ┌─────────────────┐                    │
│     │ Execute command │     │ PASS (continue) │                    │
│     │ via sh -c       │     └─────────────────┘                    │
│     └────────┬────────┘                                            │
│              │                                                      │
│              ▼                                                      │
│     ┌─────────────────┐                                            │
│     │ Get exit code   │                                            │
│     └────────┬────────┘                                            │
│              │                                                      │
│     ┌────────┴────────┐                                            │
│     │                 │                                            │
│  EXIT 0            EXIT ≠0                                         │
│     │                 │                                            │
│     ▼                 ▼                                            │
│   PASS              FAIL                                           │
│     │                 │                                            │
│     ▼                 ▼                                            │
│  ┌───────────────────────────────────────┐                        │
│  │ Evaluate conditions from workflow     │                        │
│  │ - PASS: CONTINUE / GOTO / DONE        │                        │
│  │ - FAIL: STOP / RETRY / GOTO           │                        │
│  └───────────────────────────────────────┘                        │
│              │                                                      │
│              ▼                                                      │
│     ┌─────────────────┐                                            │
│     │ Apply action    │                                            │
│     │ Update state    │                                            │
│     │ Print next step │                                            │
│     └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## CLI Options

```
┌─────────────────────────────────────────────────────────────────────┐
│  COMMAND                    │  BEHAVIOR                             │
├─────────────────────────────────────────────────────────────────────┤
│  workflow next              │  Execute command, evaluate, advance   │
│  workflow next --skip-exec  │  Skip execution, just advance        │
│  workflow next --exit-code 0│  Inject PASS without executing       │
│  workflow next --exit-code 1│  Inject FAIL without executing       │
│  workflow next --step 5     │  Jump to step 5 (for GOTO loops)     │
└─────────────────────────────────────────────────────────────────────┘
```

**When to use each:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  SCENARIO                           │  COMMAND                      │
├─────────────────────────────────────────────────────────────────────┤
│  Step has bash command, run it      │  workflow next                │
│  Step is Claude-controlled          │  workflow next --skip-exec    │
│  Agent knows result, skip exec      │  workflow next --exit-code N  │
│  GOTO condition triggered           │  workflow next --step N       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## State Persistence

```
.claude/turboshovel/
├── session.json              # Active workflow ID
└── workflows/
    └── wf-2025-12-21-abc123.json

┌─────────────────────────────────────────────┐
│  wf-2025-12-21-abc123.json                  │
├─────────────────────────────────────────────┤
│  {                                          │
│    "id": "wf-2025-12-21-abc123",           │
│    "workflow": "execute.workflow.md",       │
│    "step": 3,                              │
│    "stepName": "Execute batch",            │
│    "retryCount": 1,                        │
│    "retryMax": 3,                          │
│    "variables": {                          │
│      "more_batches": true                  │
│    },                                       │
│    "tasks": [                              │
│      {"id": "t1", "status": "complete"},   │
│      {"id": "t2", "status": "running"}     │
│    ]                                        │
│  }                                          │
└─────────────────────────────────────────────┘

After context clear:
  $ workflow status
  → Workflow: execute.workflow.md
  → Step 3: Execute batch
  → Retry: 1/3
  → Ready to continue
```

---

## BLOCKED Handling

```
┌─────────────────────────────────────────────────────────────────────┐
│  Agent encounters problem that requires deviation from plan         │
│                                                                     │
│      ┌─────────────────────────────────────┐                       │
│      │ Agent reports STATUS: BLOCKED       │                       │
│      │ Reason: "JWT won't work, need OAuth"│                       │
│      └────────────────┬────────────────────┘                       │
│                       │                                             │
│                       ▼                                             │
│      ┌─────────────────────────────────────┐                       │
│      │ Hook captures BLOCKED status        │                       │
│      │ Sets workflow variable              │                       │
│      │ Injects: "workflow next --exit-code 1"                      │
│      └────────────────┬────────────────────┘                       │
│                       │                                             │
│                       ▼                                             │
│      ┌─────────────────────────────────────┐                       │
│      │ CLI evaluates FAIL condition        │                       │
│      │ Action: RETRY (if count < max)      │                       │
│      │ Or: STOP if max exceeded            │                       │
│      └────────────────┬────────────────────┘                       │
│                       │                                             │
│                       ▼                                             │
│      ┌─────────────────────────────────────┐                       │
│      │ Context injection shows:            │                       │
│      │ ⚠️ BLOCKED: JWT won't work          │                       │
│      │ Options:                            │                       │
│      │ 1. Approve deviation                │                       │
│      │ 2. Revise plan                      │                       │
│      │ 3. Enforce plan                     │                       │
│      └─────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Benefits

```
┌─────────────────────────────────────────────────────────────────────┐
│  BEFORE (Skill)                  │  AFTER (Workflow)                │
├─────────────────────────────────────────────────────────────────────┤
│  Claude remembers steps          │  CLI enforces steps              │
│  Code review "mandatory"         │  Code review ACTUALLY mandatory  │
│  Progress in Claude's memory     │  Progress in state file          │
│  Context clear = start over      │  Context clear = resume          │
│  Agent interprets PASS/FAIL      │  Exit code determines PASS/FAIL  │
│  GOTO is agent decision          │  GOTO is CLI action              │
│  189 lines of guidance           │  ~40 lines of workflow + CLI     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference

```
Start:    workflow start execute.workflow.md
Status:   workflow status
Next:     workflow next
Skip:     workflow next --skip-exec
Inject:   workflow next --exit-code 0
Jump:     workflow next --step 3
Stop:     workflow stop
List:     workflow list
```
