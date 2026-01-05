# Rundown Workflow Specification

Version: 1.0.0
Status: Draft

Rundown is a format for defining executable workflows using Markdown.

---

## Table of Contents

- [1. Syntax Synopsis](#1-syntax-synopsis)
- [2. Document Structure](#2-document-structure)
  - [Header](#header)
  - [Steps](#steps)
  - [Nesting (Substeps)](#nesting-substeps)
  - [Identifiers](#identifiers)
- [3. Step Content](#3-step-content)
  - [Option A: Step Body](#option-a-step-body)
  - [Option B: Workflow List](#option-b-workflow-list)
- [4. Transitions](#4-transitions)
- [5. Actions](#5-actions)
- [6. Conformance](#6-conformance)
- [7. Examples](#7-examples)

---

## 1. Syntax Synopsis

See [rundown-format.md](./rundown-format.md) for the complete BNF-style grammar.

---

## 2. Document Structure

A Rundown document (`.workflow.md`) consists of an optional title and description, followed by one or more steps.

### Header
- **Title**: An optional H1 header (`# Title`).
- **Description**: Optional prose text following the title.

### Steps
Steps are the fundamental units of execution. They are defined using H2 (`##`) headers.

**Format:**
```markdown
## {id} {Title}
```

### Nesting (Substeps)
Steps can contain nested steps (substeps) defined using H3 (`###`) headers.

**Format:**
```markdown
### {id} {Title}
```

### Identifiers
Step identifiers (`id`) define the sequence and structure of the workflow.

| Format | Type | Description |
|--------|------|-------------|
| `1` | Static | Standard sequential step |
| `{N}` | Dynamic | Template step instantiated at runtime |
| `1.1` | Static Substep | Explicitly numbered nested step |
| `1.{n}` | Dynamic Substep | Template nested step |
| `{N}.1` | Nested Static | Static child of dynamic parent |
| `{N}.{n}`| Nested Dynamic | Dynamic child of dynamic parent |

**Rules:**
1. Top-level static steps MUST be numbered sequentially starting from 1.
2. Static substeps MUST be numbered sequentially starting from 1.
3. Dynamic identifiers (`{N}`, `{n}`) are placeholders for runtime enumeration.

---

## 3. Step Content

A step defines work to be done. It must contain either a **Body** or a **Workflow List**, but not both.

### Option A: Step Body
A step body defines local execution logic.

1. **Prompt**: Text instructions for the agent/user.
   - **Implicit**: Any prose text in the step.
   - **Explicit**: Text following a `**Prompt:**` marker.
2. **Command**: A fenced code block (````bash````) containing the command to execute.
   - Exit code `0` = PASS.
   - Non-zero exit code = FAIL.
3. **Nested Steps**: A sequence of H3 substeps (only valid for H2 steps).

### Option B: Workflow List
A step can delegate execution to other Rundown files.

**Format:**
A bulleted list of file paths immediately following the header.

```markdown
## 1. Run checks
 - lint.workflow.md
 - test.workflow.md
```

**Behavior:**
- The referenced workflows are executed in order.
- Outcomes are aggregated based on the transition rules.

---

## 4. Transitions

Transitions define the control flow based on the outcome of a step.

**Syntax:**
```markdown
- {Outcome} [{Modifier}]: {Result}
```

**Outcomes:**
- `PASS`: The step (or command) succeeded.
- `FAIL`: The step (or command) failed.

**Modifiers (Aggregation):**
Used when a step has multiple child units (substeps or workflows).
- `ALL`: Trigger only if ALL units have this outcome.
- `ANY`: Trigger if AT LEAST ONE unit has this outcome.

**Default Behavior (Pessimistic):**
- `PASS` implies `PASS ALL`
- `FAIL` implies `FAIL ANY`

---

## 5. Actions

Actions determine what happens next.

| Action | Description |
|--------|-------------|
| `CONTINUE` | Proceed to the next step. |
| `STOP ["msg"]` | Halt execution immediately. Optional failure message. |
| `DONE` | Complete the workflow successfully immediately. |
| `GOTO {id}` | Jump to a specific step ID. |
| `NEXT` | Create the next dynamic step instance (N+1) and start execution. Only valid within `## {N}.` context. |
| `RETRY [n] [act]` | Retry the current step `n` times (default 1). If exhausted, perform `act` (default STOP). |

**GOTO Rules:**
- Target ID must exist.
- `GOTO {N}` alone is invalid — use `NEXT` to advance to the next dynamic instance.
- `GOTO {N}.M` navigates within the current dynamic instance to substep M.
- `GOTO {n}` alone is invalid (same rule applies to dynamic substeps).
- Cannot GOTO from outside into a dynamic step or dynamic substep.
- GOTO resets the retry counter to 0 for the target location.
- Self-referencing GOTO (same step/substep) is rejected at compile time to prevent infinite loops.

**NEXT Rules:**
- Only valid within dynamic step context (`## {N}.`).
- Creates instance N+1 and begins execution at the first substep.
- Use for explicit iteration control in dynamic workflows.

**CONTINUE in Dynamic Context:**
- From dynamic substep (`### N.{n}`): Returns outcome to parent step for aggregation.
- Dynamic substeps have no fixed sibling — use `NEXT` for explicit iteration.
- This differs from static substeps where `CONTINUE` navigates to the next sibling.

**Workflow Outcomes:**
- **PASS**: Workflow completed successfully (via `CONTINUE` to end or `DONE` action).
- **FAIL**: Workflow did not complete (via `STOP` action, retry exhaustion, or unhandled failure).
- Parent workflows and aggregation use only these two outcomes.

**Outcome Aliases:**
- `YES` is an alias for `PASS` (for natural-language prompts).
- `NO` is an alias for `FAIL` (for natural-language prompts).

---

## 6. Conformance

Parsers and executors must adhere to strict validation:

1. **Hierarchy**: H1 is Metadata. H2 is Step. H3 is Substep. H4+ is invalid.
2. **Step Pattern**: A workflow contains EITHER:
   - One or more sequential static steps (`## 1.`, `## 2.`, ...), OR
   - Exactly one dynamic step template (`## {N}.`)
3. **Sequencing**: Static steps must be strictly sequential (1, 2, 3...).
4. **Exclusivity**: A step cannot have both a body (command/prompts/substeps) AND a workflow list.
5. **Recursion**: `RETRY` actions cannot contain another `RETRY`.

---

## 7 . Examples

Executable examples and conformance test cases are maintained in the `packages/shared/fixtures/workflow/conformance/` directory.

- **Valid Workflows**: `fixtures/workflow/conformance/valid/`
- **Invalid Workflows (Error Cases)**: `fixtures/workflow/conformance/invalid/`