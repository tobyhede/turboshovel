# Turboshovel Workflow Specification

Version: 1.1.0
Status: Draft

This document is the authoritative specification for Turboshovel workflow markdown files (`.workflow.md`).

---

## Table of Contents

1. [Overview](#overview)
2. [Execution Modes](#execution-modes)
3. [Document Structure](#document-structure)
4. [Steps](#steps)
5. [Substeps](#substeps)
6. [Subworkflows](#subworkflows)
7. [Transitions](#transitions)
8. [Actions](#actions)
9. [Commands](#commands)
10. [Prompts](#prompts)
11. [Variables](#variables)
12. [Validation Rules](#validation-rules)
13. [State Management](#state-management)
14. [CLI Commands](#cli-commands)
15. [Examples](#examples)
16. [Design Decisions](#design-decisions)
17. [Future Considerations](#future-considerations)

---

## Overview

A workflow is a markdown document that defines a sequence of steps to be executed. Workflows support:

- Sequential step execution with numbered steps
- Parallel substep execution within a step
- Nested subworkflows for composition
- Conditional branching based on pass/fail outcomes
- Retry logic for transient failures
- Variable substitution for dynamic content

**File naming convention:** `*.workflow.md`

---

## Execution Modes

Workflows run in one of two execution modes, controlled by the `--prompted` flag on `tsv start`.

### Auto Mode (Default)

**Command:** `tsv start workflow.md`

In auto mode, bash commands execute automatically:

| Behavior | Description |
|----------|-------------|
| Command execution | **Automatic** - bash commands execute immediately |
| Output | Piped to stdout (inherited stdio) |
| Outcome evaluation | Based on exit code: `0 = PASS`, `non-zero = FAIL` |
| Prompt display | Shown before command execution |
| Advancement | Agent calls `tsv pass` to confirm and advance |

**Execution flow:**
```
tsv start workflow.md
  → Show prompt (if present)
  → Execute bash command automatically
  → Display exit code result (PASS/FAIL)
  → Wait for: tsv pass (or tsv fail to override)
```

### Prompted Mode

**Command:** `tsv start --prompted workflow.md`

In prompted mode, commands are displayed but NOT executed automatically:

| Behavior | Description |
|----------|-------------|
| Command execution | **Manual** - agent runs commands themselves |
| Output | Both prompt AND command displayed to stdout |
| Outcome signaling | Agent signals with `tsv pass` or `tsv fail` |
| Advancement | Agent calls `tsv pass/fail` after manual execution |

**Execution flow:**
```
tsv start --prompted workflow.md
  → Show prompt (if present)
  → Show command (NOT executed)
  → Wait for: agent runs command manually
  → Wait for: tsv pass or tsv fail
```

### Mode Inheritance

Child workflows **inherit** their parent's execution mode:

```bash
# Parent started with --prompted
tsv start --prompted parent.workflow.md

# Child workflow automatically uses prompted mode
# (no flag needed - inherited from parent state)
tsv start child.workflow.md  # → mode: prompted
```

The `prompted` flag is stored in `WorkflowState.prompted` and automatically propagated to child workflows.

### Step Types

| Type | Has bash block? | Auto mode | Prompted mode |
|------|-----------------|-----------|---------------|
| **COMMAND** | Yes | Execute automatically | Show command, wait for manual execution |
| **PROMPT** | No | Show prompt, wait for `tsv pass` | Same as auto mode |

---

## Document Structure

```markdown
# Workflow Title (optional H1)

Optional description paragraph.

## 1. First Step

Step content...

## 2. Second Step

Step content...
```

### Heading Levels

| Level | Purpose | Required |
|-------|---------|----------|
| H1 (`#`) | Workflow title/metadata | Optional |
| H2 (`##`) | Step headers | Required |
| H3 (`###`) | Substep headers | Optional |

**Rule:** H1 headers MUST NOT look like step headers (start with a number). Use H2 for steps.

---

## Steps

### Format

```markdown
## N. Step Description
```

Where:
- `N` is a positive integer (1, 2, 3...)
- `.` or other separator (`:`, `-`, `)`) follows the number
- Description follows the separator

### Examples

```markdown
## 1. Initialize project
## 2: Run tests
## 3 - Deploy to staging
## 4) Final verification
```

### Step Content

A step may contain:

1. **Prose** - Descriptive text (becomes implicit prompt if no explicit prompt)
2. **Code block** - Bash command to execute (see [Commands](#commands))
3. **Substeps** - Parallel execution units (H3 headers)
4. **Prompts** - Explicit agent instructions
5. **Transitions** - PASS/FAIL outcome handlers

### Step Structure

```
## {StepNumber}. {StepTitle}

{Prompt text: Optional}

```bash
{command}
```

{More prompt text: Optional}

- PASS: ACTION
- FAIL: ACTION
```

**Key points:**
- Prompts can appear **before** and/or **after** the bash block
- Only ONE bash block per step (use `&&` to chain commands)
- Transitions typically appear at the end

### Numbering Rules

1. Steps MUST be numbered sequentially starting from 1
2. No gaps allowed (1, 2, 3... not 1, 3, 5...)
3. Numbers must be positive integers
4. Maximum step number: 999,999

---

## Substeps

Substeps enable parallel execution within a single step. They are defined using H3 headers.

### Static Substeps

Known at parse time, explicitly numbered:

```markdown
## 1. Dispatch reviewers

### 1.1 First reviewer (code-review-agent)

Review the implementation.

### 1.2 Second reviewer (security-agent)

Review for security issues.

- PASS ALL: CONTINUE
- FAIL ANY: STOP
```

**Format:** `### N.M Description (optional-agent-type)`

Where:
- `N` matches the parent step number
- `M` is a positive integer (1, 2, 3...)
- Agent type in parentheses is optional

### Dynamic Substeps

Created at runtime, using `{n}` placeholder:

```markdown
## 1. Execute batch

### 1.{n} Execute step (code-exec-agent)

Execute the assigned step.

- PASS ALL: CONTINUE
- FAIL ANY: STOP
```

**Format:** `### N.{n} Description (optional-agent-type)`

The `{n}` is replaced with incrementing numbers (1, 2, 3...) as substeps are created.

### Substep Rules

1. Substep prefix MUST match parent step number (1.1 under step 1, not 2.1)
2. Static and dynamic substeps CANNOT be mixed in the same step
3. Substep IDs must be unique within a step
4. Agent type in parentheses is extracted for dispatch

---

## Subworkflows

Substeps can reference child workflow files for composition.

### Subworkflow List Syntax

```markdown
### 1.{n}
 - workflow-a.workflow.md
 - workflow-b.workflow.md

Execute the subworkflow.
```

**Format:** Bullet list under the substep header with `.workflow.md` files.

### Workflow Cycling

When dynamic substeps reference multiple workflows, they cycle in order:

| Substep | Workflow |
|---------|----------|
| 1.1 | workflow-a.workflow.md |
| 1.2 | workflow-b.workflow.md |
| 1.3 | workflow-a.workflow.md (cycles) |
| 1.4 | workflow-b.workflow.md |

### Subworkflow Rules

1. Workflow files must exist and be valid
2. Number of substeps MUST be >= number of listed workflows
3. Workflows cycle in order when substep count exceeds workflow count
4. Child workflows inherit parent context

---

## Transitions

A transition defines what action to take when a step produces an outcome.

### Terminology

| Term | Meaning |
|------|---------|
| **Outcome** | PASS or FAIL - the result of step execution |
| **Action** | CONTINUE, STOP, GOTO, RETRY, DONE - what to do next |
| **Transition** | Outcome → Action mapping (e.g., `PASS: CONTINUE`) |
| **Modifier** | ALL, ANY - substep aggregation for outcomes |

### Syntax

```markdown
- PASS [modifier]: ACTION
- FAIL [modifier]: ACTION
```

Or as plain text (not in list):

```markdown
PASS [modifier]: ACTION
FAIL [modifier]: ACTION
```

### Modifiers (for substeps)

| Modifier | Meaning |
|----------|---------|
| `ALL` | All substeps must produce this outcome |
| `ANY` | At least one substep must produce this outcome |

### Valid Combinations

| Mode | PASS triggers when | FAIL triggers when |
|------|-------------------|-------------------|
| Pessimistic (default) | `PASS ALL` - all pass | `FAIL ANY` - any fails |
| Optimistic | `PASS ANY` - any passes | `FAIL ALL` - all fail |

**Rule:** You cannot combine `PASS ALL` with `FAIL ALL` or `PASS ANY` with `FAIL ANY`.

### Examples

```markdown
# Pessimistic (default) - all must succeed
- PASS ALL: CONTINUE
- FAIL ANY: STOP

# Pessimistic (implicit ALL/ANY)
- PASS: CONTINUE
- FAIL: STOP

# Optimistic - any success is enough
- PASS ANY: CONTINUE
- FAIL ALL: STOP
```

---

## Actions

Actions define what to do when a step produces an outcome.

| Action | Description |
|--------|-------------|
| `CONTINUE` | Advance to next step |
| `STOP` | Halt workflow (failure) |
| `STOP message` | Halt with error message |
| `DONE` | Complete workflow (success) |
| `GOTO N` | Jump to step N |
| `RETRY` | Retry current step (default: 1 attempt, then STOP) |
| `RETRY N` | Retry up to N times, then STOP |
| `RETRY N ACTION` | Retry up to N times, then execute ACTION |
| `RETRY "message"` | Retry once, then STOP with message |

### Action Examples

```markdown
- PASS: CONTINUE          # Next step
- PASS: DONE              # Workflow complete
- PASS: GOTO 5            # Jump to step 5

- FAIL: STOP              # Halt (no message)
- FAIL: STOP "Build failed"  # Halt with message
- FAIL: RETRY             # Retry once, then STOP (default)
- FAIL: RETRY 3           # Retry up to 3 times, then STOP
- FAIL: RETRY 3 GOTO 2    # Retry up to 3 times, then jump to step 2
- FAIL: RETRY 5 CONTINUE  # Retry up to 5 times, then continue anyway
- FAIL: RETRY 3 DONE      # Retry up to 3 times, then complete workflow
- FAIL: RETRY "Tests failed" # Retry once, then STOP with message
- FAIL: GOTO 1            # Jump back to step 1
- FAIL: CONTINUE          # Ignore failure, continue
```

### RETRY Syntax

**Full syntax:** `RETRY [N:=1] [ACTION:=STOP]`

Where:
- `N` is the maximum retry attempts (default: 1)
- `ACTION` is what happens when retries are exhausted (default: STOP)
- Valid exhaustion actions: STOP, GOTO, CONTINUE, DONE

**Breaking change (v1.0.0):** Default max retries changed from 3 to 1.

**Valid combinations:**

| Syntax | Max Retries | Exhaustion Action |
|--------|-------------|-------------------|
| `RETRY` | 1 | STOP |
| `RETRY 3` | 3 | STOP |
| `RETRY 3 GOTO 2` | 3 | GOTO 2 |
| `RETRY 5 CONTINUE` | 5 | CONTINUE |
| `RETRY 2 DONE` | 2 | DONE |
| `RETRY "error"` | 1 | STOP "error" |
| `RETRY 3 STOP "error"` | 3 | STOP "error" |

### GOTO Rules

1. Target step MUST exist (1 to total steps)
2. GOTO to self is invalid (use RETRY instead)
3. GOTO resets retry counter

---

## Commands

Bash commands are defined in fenced code blocks:

```markdown
## 1. Build project

Run the build process.

```bash
npm run build
```

- PASS: CONTINUE
- FAIL: RETRY 2
```

### Command Rules

1. Only `bash` language is supported
2. One code block per step (combine with `&&` or `;` if needed)
3. Commands are executed via CLI or hooks
4. Exit code 0 = pass, non-zero = fail

---

## Prompts

Prompts provide instructions to agents executing steps.

### Implicit Prompts

Any prose text in a step (not code blocks, transitions, or substeps) becomes an implicit prompt:

```markdown
## 1. Review the code

Look for bugs and security issues.
Focus on the authentication module.
```

The two paragraphs become the prompt.

### Explicit Prompts

Use `**Prompt:**` marker for explicit prompts:

```markdown
## 1. Review the code

This step reviews code quality.

**Prompt:** Look for bugs and security issues. Focus on authentication.
```

Only the text after `**Prompt:**` becomes the prompt.

### Prompt Rules

1. Implicit prompts are created when: no code block AND no explicit prompt
2. Explicit prompts override implicit text
3. Multiple explicit prompts are accumulated

---

## Variables

Variables enable dynamic content in workflows.

### Runtime Substitution

| Variable | Scope | Description |
|----------|-------|-------------|
| `$n` | Substep | Current substep number (1, 2, 3...) |
| `$count` | Workflow | Number of items (for dynamic substeps) |
| `{date}` | Workflow | Current date (YYYY-MM-DD) |
| `{agentId}` | Agent | Current agent's ID |

### Usage in Prompts

```markdown
## 1. Execute batch

### 1.{n}

**Prompt:** Execute step $n of $count. Write output to `.work/{date}-step-$n.md`.
```

For substep 1.3 with count=5:
> Execute step 3 of 5. Write output to `.work/2025-01-01-step-3.md`.

### State Variables

Variables are stored in workflow state and persist across steps:

```markdown
## 1. Check prerequisites

- PASS: CONTINUE
- FAIL: STOP

## 2. Deploy

(Only runs if step 1 passed)
```

Variables set by the system:
- `completed: true` - Set when workflow completes via DONE
- `blocked: true` - Set when workflow stops via STOP

---

## Validation Rules

The parser enforces these rules:

### Document Level

1. Must have at least one step (H2 header)
2. Steps must be numbered sequentially (1, 2, 3...)
3. H1 headers cannot look like step headers

### Step Level

1. Step number must be positive integer (1 to 999,999)
2. Step must have description after number
3. Only one bash code block per step
4. GOTO targets must exist and not self-reference

### Substep Level

1. Substep prefix must match parent step number
2. Cannot mix static (1.1) and dynamic (1.{n}) substeps
3. No duplicate substep IDs within a step
4. Agent type is optional

### Transition Level

1. Only valid combinations: PASS ALL + FAIL ANY, or PASS ANY + FAIL ALL
2. Modifiers infer the complement (PASS ALL implies FAIL ANY)
3. Unknown actions are rejected

---

## State Management

Workflow state is persisted to enable resumption across sessions.

### State Location

```
.claude/turboshovel/
├── workflows/
│   ├── wf-2025-01-01-abc123.json   # Individual workflow state
│   └── wf-2025-01-01-def456.json
└── session.json                     # Active workflow tracking
```

### State Fields

| Field | Description |
|-------|-------------|
| `id` | Unique workflow identifier |
| `workflow` | Source file path |
| `step` | Current step number |
| `stepName` | Current step description |
| `retryCount` | Current retry attempt |
| `variables` | Key-value state storage |
| `pendingSteps` | Queue of steps awaiting agent binding |
| `agentBindings` | Map of agent ID to step binding |
| `substepStates` | State of substeps within current step |
| `snapshot` | XState state machine snapshot |
| `prompted` | Prompted mode flag: `true` = manual, `undefined`/`false` = auto |
| `lastResult` | Last command result: `'pass'` or `'fail'` (for transition evaluation) |

### Child Workflow State

| Field | Description |
|-------|-------------|
| `agentId` | Agent executing this child workflow |
| `parentWorkflowId` | Parent workflow ID |
| `parentStepId` | Step in parent that spawned this child |

---

## CLI Commands

The `tsv` (or `turboshovel`) CLI provides commands for workflow execution.

### Workflow Lifecycle

| Command | Description |
|---------|-------------|
| `tsv start <file>` | Start a new workflow (auto mode) |
| `tsv start --prompted <file>` | Start in prompted mode (no auto-execution) |
| `tsv stop` | Abort the active workflow |
| `tsv complete` | Mark the active workflow as complete |
| `tsv status` | Show current workflow state |
| `tsv list` | List all workflows |

### Step Progression

| Command | Description |
|---------|-------------|
| `tsv pass` | Mark current step as passed (triggers PASS transition) |
| `tsv fail` | Mark current step as failed (triggers FAIL transition) |
| `tsv goto <n>` | Jump to step N directly |

### Workflow Control

| Command | Description |
|---------|-------------|
| `tsv stash` | Pause workflow enforcement (stash active workflow) |
| `tsv pop` | Resume stashed workflow |

### Agent Commands

| Command | Description |
|---------|-------------|
| `tsv start --step <stepId>` | Queue step for agent binding |
| `tsv start --agent <agentId>` | Bind agent to pending step |
| `tsv pass --agent <agentId>` | Mark agent's step as passed |
| `tsv fail --agent <agentId>` | Mark agent's step as failed |

### Utility Commands

| Command | Description |
|---------|-------------|
| `tsv gate <name>` | Run a named gate |
| `tsv test [command...]` | Test command execution (for workflow testing) |

---

## Examples

### Simple Sequential Workflow

```markdown
## 1. Install dependencies

```bash
npm install
```

- PASS: CONTINUE
- FAIL: STOP "Installation failed"

## 2. Run tests

```bash
npm test
```

- PASS: CONTINUE
- FAIL: RETRY 2

## 3. Build

```bash
npm run build
```

- PASS: DONE
- FAIL: STOP "Build failed"
```

### Parallel Review with Substeps

```markdown
## 1. Dispatch reviewers

### 1.1 Code reviewer (code-review-agent)

Review implementation quality.

### 1.2 Security reviewer (security-agent)

Review for security vulnerabilities.

### 1.3 Documentation reviewer (docs-agent)

Review documentation accuracy.

- PASS ALL: CONTINUE
- FAIL ANY: STOP "Review failed"

## 2. Collate findings

Combine all review findings.

**Prompt:** Read all review outputs and create summary.

- PASS: DONE
```

### Dynamic Substeps with Subworkflows

```markdown
## 1. Execute verification rounds

### 1.{n}
 - verify-code.workflow.md
 - verify-docs.workflow.md

Execute verification workflow.

- PASS ALL: CONTINUE
- FAIL ANY: STOP

## 2. Collate results

Combine all verification results.

- PASS: DONE
```

### Retry and Recovery

```markdown
## 1. Flaky integration test

```bash
npm run test:integration
```

- PASS: CONTINUE
- FAIL: RETRY 3

## 2. Manual fallback

If automated test fails repeatedly, manual review.

**Prompt:** The automated test failed 3 times. Please review manually.

- PASS: CONTINUE
- FAIL: GOTO 3

## 3. Skip integration

Continue without integration verification.

- PASS: DONE
```

---

## Design Decisions

This section documents key design decisions and their rationale.

### Heading Level Restrictions

| Level | Purpose | Status |
|-------|---------|--------|
| H1 (`#`) | Document title | Reserved |
| H2 (`##`) | Steps | Required |
| H3 (`###`) | Substeps | Optional |
| H4+ (`####`) | — | Not supported |

#### Why H1 is Reserved for Title

H1 headers that look like step headers (start with a number) are rejected:

```markdown
# 1. Build project    ← ERROR: Use ## instead
# My Workflow Title   ← OK: Not a step header
```

**Rationale:**
1. **Title distinction**: H1 conventionally represents the document title
2. **Unambiguous parsing**: Without this rule, the parser would need heuristics to distinguish `# My Title` from `# 1. Step`
3. **Standard hierarchy**: Aligns with Markdown conventions (H1 = document, H2 = sections)
4. **Clear error messages**: Users get immediate feedback to use H2 instead

#### Why H4+ is Not Supported

Sub-substeps via `####` (H4) are intentionally not supported.

**Problems with deeper nesting:**
1. **Execution semantics become unclear**: If substeps run in parallel, do sub-substeps also run in parallel within their parent? How do outcomes aggregate (`PASS ALL` of `PASS ALL`)?
2. **Numbering complexity**: `1.1.1`, `1.2.3.4` becomes unwieldy; dynamic numbering (`1.{n}.{m}`) is complex to parse and track
3. **State management explosion**: Each nesting level multiplies state complexity

**Alternative: Use subworkflows**

```markdown
### 1.1 Frontend review
 - frontend-review.workflow.md

### 1.2 Backend review
 - backend-review.workflow.md
```

Subworkflows provide:
- Clean separation of concerns
- Reusability across workflows
- Independent testing
- Clear execution boundaries
- Inherited execution mode (auto/prompted)

The two-level hierarchy (step → substep) handles most use cases. For deeper decomposition, compose with subworkflows.

---

## Future Considerations

Features under consideration for future versions:

1. **Frontmatter metadata** - YAML block for workflow metadata
2. **Parameterized workflows** - Input parameters at start
3. **Conditional steps** - Skip steps based on conditions
4. **Parallel step groups** - Multiple steps in parallel (not just substeps)
5. **Timeout handling** - Per-step and per-workflow timeouts
6. **Event hooks** - Custom hooks at step boundaries

---

## Changelog

- **1.1.0** (2026-01-03): Added execution modes (auto/prompted), CLI commands section, step structure clarification, Design Decisions section (heading level restrictions), renamed Conditions to Transitions (ubiquitous language alignment)
- **1.0.0** (2026-01-01): Initial specification (Updated to Step/Substep terminology)