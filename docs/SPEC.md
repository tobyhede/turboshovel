# Rundown Workflow Specification

Version: 1.0.0
Status: Draft

Rundown is a format for defining executable workflows using Markdown.

---

## Table of Contents

- [1. Syntax Synopsis](#1-syntax-synopsis)
- [2. Document Structure](#2-document-structure)
- [3. Step Content](#3-step-content)
- [4. Substeps](#4-substeps)
- [5. Transitions](#5-transitions)
- [6. Actions](#6-actions)
- [7. Variables](#7-variables)
- [8. Conformance](#8-conformance)
- [9. Examples](#9-examples)

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

A step (`##`) defines a unit of work or orchestration. Every step MUST contain exactly one of the following content types:

### Option A: Task Step (Body)
Contains local execution logic.
1. **Prompt**: Text instructions for the agent/user.
2. **Command**: A fenced code block containing the command to execute. See [Code Blocks](#code-blocks).

### Option B: Container Step (Substeps)
Contains a sequence of nested tasks defined using H3 (`###`) headers. When using this option, the Step header MUST be immediately followed by its Substeps. See [4. Substeps](#4-substeps).

### Option C: Proxy Step (Workflow List)
Delegates execution to other Rundown files.
- **Format**: A bulleted list of file paths immediately following the header.
- **Behavior**: The referenced workflows are executed in order.

---

## 4. Substeps

Substeps provide fine-grained task definition within a Step.

### Hierarchy and Scope
- **Headers**: Defined using H3 (`###`) headers.
- **Nesting**: Only valid as children of H2 steps. Substeps CANNOT contain further nested steps (H4 is invalid).
- **Exclusivity**: Like Steps, a Substep MUST contain either a **Body** (Option A) or a **Workflow List** (Option C), but not both.

### Identifiers
Substep identifiers must strictly match the parent Step ID prefix.

| Format | Parent | Child | Context |
| :--- | :--- | :--- | :--- |
| `1.1` | Static | Static | Sequential task in a static step. |
| `1.{n}` | Static | Dynamic | Iterative task in a static step. |
| `{N}.1` | Dynamic | Static | Fixed task within a dynamic instance. |
| `{N}.{n}` | Dynamic | Dynamic | Iterative task within a dynamic instance. |

### Outcome Aggregation
When a Step contains Substeps, the parent step's final outcome is derived from the collective results of its children. This aggregation is controlled by [5. Transitions](#5-transitions) using `ALL` or `ANY` modifiers.

---

## 5. Transitions

Transitions define the control flow based on the outcome of a step or substep.

**Syntax:**
```markdown
- {Outcome} [{Modifier}]: {Result}
```

**Outcomes:**
- `PASS`: The unit (step, substep, or command) succeeded.
- `FAIL`: The unit failed.

**Modifiers (Aggregation):**
Used when a step has multiple child units (substeps or workflows).
- `ALL`: Trigger only if ALL units have this outcome.
- `ANY`: Trigger if AT LEAST ONE unit has this outcome.

**Default Behavior (Pessimistic):**
- `PASS` implies `PASS ALL`
- `FAIL` implies `FAIL ANY`

---

## 6. Actions

Actions determine what happens next.

| Action | Description |
|--------|-------------|
| `CONTINUE` | Proceed to the next unit in sequence. |
| `STOP ["msg"]` | Halt execution immediately. Optional failure message. |
| `DONE` | Complete the workflow successfully immediately. |
| `GOTO {id}` | Jump to a specific step ID. |
| `NEXT` | Create the next dynamic step instance (N+1). Only valid in `## {N}.` context. |
| `RETRY [n] [act]` | Retry the current unit `n` times (default 1). If exhausted, perform `act`. |

**GOTO Rules:**
- Target ID must exist.
- Cannot GOTO into a dynamic step instance from outside (use the parent ID).
- `GOTO {N}.M` navigates within the current dynamic instance to substep M.
- Use `NEXT` to advance to the next instance (not `GOTO {N}`).

---

## 7. Code Blocks

A step body can contain **both** prompt text and a code block:

```
## 1. Step Title

Prompt text (instructions for agent/user).

\`\`\`bash
command-to-run
\`\`\`
```

### Classification

| Tag | Type | Behavior |
|-----|------|----------|
| `bash`, `sh`, `shell` | Executable | Auto-run, exit code determines PASS/FAIL |
| `prompt` | Instructional | Show to agent, never execute |
| Other/none | Passive | Preserved as prose in prompts |

### CLI Interaction

| Code Block Tag | CLI `--prompted` | Result |
|----------------|------------------|--------|
| `bash`/`sh`/`shell` | No | **Execute** automatically |
| `bash`/`sh`/`shell` | Yes | **Show**, wait for `tsv pass/fail` |
| `prompt` | No | **Show**, wait for `tsv pass/fail` |
| `prompt` | Yes | **Show**, wait for `tsv pass/fail` |
| Other/none | Any | Preserved in prompts (not a command) |

**Key insight**: `prompt` blocks **never** execute, regardless of CLI flag. The `--prompted` flag only affects executable blocks.

---

## 8. Variables

Rundown supports simple variable substitution in prompts and commands.

| Variable | Scope | Description |
|----------|-------|-------------|
| `{N}`, `{n}` | Dynamic Step | The current index of a dynamic step instance. |
| `{count}`| Workflow | Total number of items (if applicable). |
| `{date}` | Global | Current date (YYYY-MM-DD). |

---

## 9. Conformance

Parsers and executors must adhere to strict validation:

1. **Hierarchy**: H1 is Metadata. H2 is Step. H3 is Substep. H4+ is invalid.
2. **Step Pattern**: A workflow contains EITHER static steps OR exactly one dynamic step template.
3. **Sequencing**: Static steps must be strictly sequential (1, 2, 3...).
4. **Exclusivity**: Units MUST contain exactly one of their permitted content types.
5. **Recursion**: `RETRY` actions cannot contain another `RETRY`.

---

## 10. Examples

Executable examples and conformance test cases are maintained in the `packages/shared/fixtures/workflow/conformance/` directory.

- **Valid Workflows**: `fixtures/workflow/conformance/valid/`
- **Invalid Workflows (Error Cases)**: `fixtures/workflow/conformance/invalid/`
