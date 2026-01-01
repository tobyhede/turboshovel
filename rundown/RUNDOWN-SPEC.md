# Turboshovel Workflow Specification

Version: 1.0.0
Status: Draft

This document is the authoritative specification for Turboshovel workflow markdown files (`.workflow.md`).

---

## Table of Contents

1. [Overview](#overview)
2. [Document Structure](#document-structure)
3. [Tasks](#tasks)
4. [Subtasks](#subtasks)
5. [Subworkflows](#subworkflows)
6. [Conditions](#conditions)
7. [Actions](#actions)
8. [Commands](#commands)
9. [Prompts](#prompts)
10. [Variables](#variables)
11. [Validation Rules](#validation-rules)
12. [State Management](#state-management)
13. [Examples](#examples)

---

## Overview

A workflow is a markdown document that defines a sequence of tasks to be executed. Workflows support:

- Sequential task execution with numbered tasks
- Parallel subtask execution within a task
- Nested subworkflows for composition
- Conditional branching based on pass/fail outcomes
- Retry logic for transient failures
- Variable substitution for dynamic content

**File naming convention:** `*.workflow.md`

---

## Document Structure

```markdown
# Workflow Title (optional H1)

Optional description paragraph.

## 1. First Task

Task content...

## 2. Second Task

Task content...
```

### Heading Levels

| Level | Purpose | Required |
|-------|---------|----------|
| H1 (`#`) | Workflow title/metadata | Optional |
| H2 (`##`) | Task headers | Required |
| H3 (`###`) | Subtask headers | Optional |

**Rule:** H1 headers MUST NOT look like task headers (start with a number). Use H2 for tasks.

---

## Tasks

### Format

```markdown
## N. Task Description
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

### Task Content

A task may contain:

1. **Prose** - Descriptive text (becomes implicit prompt if no explicit prompt)
2. **Code block** - Bash command to execute
3. **Subtasks** - Parallel execution units (H3 headers)
4. **Prompts** - Explicit agent instructions
5. **Conditions** - PASS/FAIL outcome handlers

### Numbering Rules

1. Tasks MUST be numbered sequentially starting from 1
2. No gaps allowed (1, 2, 3... not 1, 3, 5...)
3. Numbers must be positive integers
4. Maximum task number: 999,999

---

## Subtasks

Subtasks enable parallel execution within a single task. They are defined using H3 headers.

### Static Subtasks

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
- `N` matches the parent task number
- `M` is a positive integer (1, 2, 3...)
- Agent type in parentheses is optional

### Dynamic Subtasks

Created at runtime, using `{n}` placeholder:

```markdown
## 1. Execute batch

### 1.{n} Execute task (code-exec-agent)

Execute the assigned task.

- PASS ALL: CONTINUE
- FAIL ANY: STOP
```

**Format:** `### N.{n} Description (optional-agent-type)`

The `{n}` is replaced with incrementing numbers (1, 2, 3...) as subtasks are created.

### Subtask Rules

1. Subtask prefix MUST match parent task number (1.1 under task 1, not 2.1)
2. Static and dynamic subtasks CANNOT be mixed in the same task
3. Subtask IDs must be unique within a task
4. Agent type in parentheses is extracted for dispatch

---

## Subworkflows

Subtasks can reference child workflow files for composition.

### Subworkflow List Syntax

```markdown
### 1.{n}
 - workflow-a.workflow.md
 - workflow-b.workflow.md

Execute the subworkflow.
```

**Format:** Bullet list under the subtask header with `.workflow.md` files.

### Workflow Cycling

When dynamic subtasks reference multiple workflows, they cycle in order:

| Subtask | Workflow |
|---------|----------|
| 1.1 | workflow-a.workflow.md |
| 1.2 | workflow-b.workflow.md |
| 1.3 | workflow-a.workflow.md (cycles) |
| 1.4 | workflow-b.workflow.md |

### Subworkflow Rules

1. Workflow files must exist and be valid
2. Number of subtasks MUST be >= number of listed workflows
3. Workflows cycle in order when subtask count exceeds workflow count
4. Child workflows inherit parent context

---

## Conditions

Conditions define what happens when a task passes or fails.

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

### Modifiers (for subtasks)

| Modifier | Meaning |
|----------|---------|
| `ALL` | All subtasks must satisfy condition |
| `ANY` | At least one subtask must satisfy condition |

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

### Backward Compatibility

Legacy syntax is supported:

```markdown
Pass: Continue
Fail: STOP (error message)
```

---

## Actions

Actions define what happens after PASS or FAIL.

| Action | Description |
|--------|-------------|
| `CONTINUE` | Advance to next task |
| `STOP` | Halt workflow (failure) |
| `STOP message` | Halt with error message |
| `DONE` | Complete workflow (success) |
| `GOTO N` | Jump to task N |
| `RETRY` | Retry current task (default: 1 attempt, then STOP) |
| `RETRY N` | Retry up to N times, then STOP |
| `RETRY N ACTION` | Retry up to N times, then execute ACTION |
| `RETRY "message"` | Retry once, then STOP with message |

### Action Examples

```markdown
- PASS: CONTINUE          # Next task
- PASS: DONE              # Workflow complete
- PASS: GOTO 5            # Jump to task 5

- FAIL: STOP              # Halt (no message)
- FAIL: STOP "Build failed"  # Halt with message
- FAIL: RETRY             # Retry once, then STOP (default)
- FAIL: RETRY 3           # Retry up to 3 times, then STOP
- FAIL: RETRY 3 GOTO 2    # Retry up to 3 times, then jump to task 2
- FAIL: RETRY 5 CONTINUE  # Retry up to 5 times, then continue anyway
- FAIL: RETRY 3 DONE      # Retry up to 3 times, then complete workflow
- FAIL: RETRY "Tests failed" # Retry once, then STOP with message
- FAIL: GOTO 1            # Jump back to task 1
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

1. Target task MUST exist (1 to total tasks)
2. GOTO to self is invalid (use RETRY instead)
3. GOTO resets retry counter

---

## Commands

Bash commands are defined in fenced code blocks:

```markdown
## 1. Build project

Run the build process.

\`\`\`bash
npm run build
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 2
```

### Command Rules

1. Only `bash` language is supported
2. One code block per task (combine with `&&` or `;` if needed)
3. Commands are executed via CLI or hooks
4. Exit code 0 = pass, non-zero = fail

---

## Prompts

Prompts provide instructions to agents executing tasks.

### Implicit Prompts

Any prose text in a task (not code blocks, conditions, or subtasks) becomes an implicit prompt:

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

This task reviews code quality.

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
| `$n` | Subtask | Current subtask number (1, 2, 3...) |
| `$count` | Workflow | Number of items (for dynamic subtasks) |
| `{date}` | Workflow | Current date (YYYY-MM-DD) |
| `{agentId}` | Agent | Current agent's ID |

### Usage in Prompts

```markdown
## 1. Execute batch

### 1.{n}

**Prompt:** Execute task $n of $count. Write output to `.work/{date}-task-$n.md`.
```

For subtask 1.3 with count=5:
> Execute task 3 of 5. Write output to `.work/2025-01-01-task-3.md`.

### State Variables

Variables are stored in workflow state and persist across tasks:

```markdown
## 1. Check prerequisites

- PASS: CONTINUE
- FAIL: STOP

## 2. Deploy

(Only runs if task 1 passed)
```

Variables set by the system:
- `completed: true` - Set when workflow completes via DONE
- `blocked: true` - Set when workflow stops via STOP

---

## Validation Rules

The parser enforces these rules:

### Document Level

1. Must have at least one task (H2 header)
2. Tasks must be numbered sequentially (1, 2, 3...)
3. H1 headers cannot look like task headers

### Task Level

1. Task number must be positive integer (1 to 999,999)
2. Task must have description after number
3. Only one bash code block per task
4. GOTO targets must exist and not self-reference

### Subtask Level

1. Subtask prefix must match parent task number
2. Cannot mix static (1.1) and dynamic (1.{n}) subtasks
3. No duplicate subtask IDs within a task
4. Agent type is optional

### Condition Level

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
| `task` | Current task number |
| `taskName` | Current task description |
| `retryCount` | Current retry attempt |
| `retryMax` | Maximum retries allowed |
| `variables` | Key-value state storage |
| `pendingTasks` | Queue of tasks awaiting agent binding |
| `agentBindings` | Map of agent ID to task binding |
| `subtaskStates` | (Future) State of subtasks within current task |

### Child Workflow State

| Field | Description |
|-------|-------------|
| `agentId` | Agent executing this child workflow |
| `parentWorkflowId` | Parent workflow ID |
| `parentTaskId` | Task in parent that spawned this child |

---

## Examples

### Simple Sequential Workflow

```markdown
## 1. Install dependencies

\`\`\`bash
npm install
\`\`\`

- PASS: CONTINUE
- FAIL: STOP "Installation failed"

## 2. Run tests

\`\`\`bash
npm test
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 2

## 3. Build

\`\`\`bash
npm run build
\`\`\`

- PASS: DONE
- FAIL: STOP "Build failed"
```

### Parallel Review with Subtasks

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

### Dynamic Subtasks with Subworkflows

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

\`\`\`bash
npm run test:integration
\`\`\`

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

## Future Considerations

Features under consideration for future versions:

1. **Frontmatter metadata** - YAML block for workflow metadata
2. **Parameterized workflows** - Input parameters at start
3. **Conditional tasks** - Skip tasks based on conditions
4. **Parallel task groups** - Multiple tasks in parallel (not just subtasks)
5. **Timeout handling** - Per-task and per-workflow timeouts
6. **Event hooks** - Custom hooks at task boundaries

---

## Changelog

- **1.0.0** (2026-01-01): Initial specification
