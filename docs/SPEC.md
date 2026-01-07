# Rundown Workflow Specification

Version: 1.0.0
Status: Draft

Rundown is a format for defining executable workflows using Markdown.

---

## Table of Contents

- [Syntax Synopsis](syntax-synopsis)
- [Document Structure](document-structure)
- [Step Definitions](step-definitions)
- [Substeps](substeps)
- [Transitions](transitions)
- [Actions](actions)
- [Variables](variables)
- [Conformance](conformance)
- [Examples](examples)

---

## Syntax Synopsis

See [rundown-format.md](./rundown-format.md) for the complete BNF-style grammar.

---

## Document Structure

A Rundown document (`.runbook.md`) consists of an optional title and description, followed by one or more steps.

### Header
- **Title**: An optional H1 header (`# Title`).
- **Description**: Optional description text.

### Steps
Steps are the fundamental units of execution. They are defined using H2 (`##`) headers.
---

## Step Definitions

A step (`##`) defines a unit of work or orchestration.
A step always has an identifier and title.

```markdown
## {Identifier} {Title}
```

A step may contain ONE of the following following content types:

- **Prompt**: prompt text and/or code block.
- **Substeps**: sequence of nested steps defined using H3 (`###`).
- **Runbooks**: list of one or more runbooks.


### Identifiers
Step identifiers define the sequence and structure of the runbook.
Steps can be `dynamic`. Dynamic steps enable steps to be defined at runtime.


| Format | Type | Description |
|--------|------|-------------|
| `1` | Static | Standard sequential step |
| `1.1` | Static Substep | Explicitly numbered nested step |
| `1.{n}` | Dynamic Substep | Template nested step |
| `{N}` | Dynamic | Template step instantiated at runtime |
| `{N}.1` | Nested Static | Static child of dynamic parent |
| `{N}.{n}`| Nested Dynamic | Dynamic child of dynamic parent |

**Rules:**
1. Static steps MUST be numbered sequentially starting from 1.
2. Static substeps MUST be numbered sequentially starting from 1.
3. Only one dynamic step can be defined at each level.
4. Dynamic identifiers (`{N}`, `{n}`) are placeholders.


#### Dynamic

{}



---
### Prompt

A step may have a prompt and/or a code block.

- **Prompt**: text instructions for the agent/user.
- **Code Block**: code block containing a command.

```markdown
## {Identifier} {Title}
{Prompt}
{CodeBlock}
```

#### Code Blocks

Code blocks enable automatic execution and handling of commands.

- **Executable**: code blocks may be executed automatically.
- **Prompt Code Block**: A code block marked `prompt` is never executed - the block is output for the agent/user.

```markdown
## {Identifier} {Title}
\`\`\`bash
command-to-run
\`\`\`
```

---

### Substeps

Substeps enable grouping of related processes within a Step.

- **Headers**: Defined using H3 (`###`) headers.
- **Nesting**: Only valid as children of H2 steps. Substeps CANNOT contain further nested steps (H4 is invalid).
- **Exclusivity**: Like Steps, a Substep MUST contain either a **Prompt** or a **Runbook List**, but not both.

#### Identifiers
Substep identifiers must strictly match the parent Step ID prefix.

| Format | Parent | Child | Context |
| :--- | :--- | :--- | :--- |
| `1.1` | Static | Static | Sequential task in a static step. |
| `1.{n}` | Static | Dynamic | Iterative task in a static step. |
| `{N}.1` | Dynamic | Static | Fixed task within a dynamic instance. |
| `{N}.{n}` | Dynamic | Dynamic | Iterative task within a dynamic instance. |

#### Result Aggregation
When a Step contains Substeps, the parent step's final outcome is derived from the collective results of its children. This aggregation is controlled by [5. Transitions](#5-transitions) using `ALL` or `ANY` modifiers.


---


## Transitions

Transitions define the control flow based on the result of a step or substep.

**Syntax:**
```
- { PASS | FAIL | YES | NO } [ { ALL | ANY } ]: action
```

**Result:**
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

## Actions

Actions determine what happens next.

| Action | Description |
|--------|-------------|
| `CONTINUE` | Proceed to the next unit in sequence. |
| `COMPLETE` | Runbook has completed successfully. |
| `STOP ["msg"]` | Halt execution immediately. Optional failure message. |
| `GOTO {id \| NEXT}` | Jump to Step `id` or jump and create new dynamic step instance. |
| `RETRY [n] [action]` | Retry the current unit `n` times (default 1). If exhausted, perform `action`. |


### GOTO

- Target ID must exist.
- `GOTO {N}.M` navigates within the current dynamic instance to substep M.
- Use `NEXT` to advance to the next instance (not `GOTO {N}`).

| Target     | Valid From        | Description                                       |
|------------|-------------------|---------------------------------------------------|
| GOTO N     | Static step       | Jump to step N (must exist, N ≤ total steps)      |
| GOTO N.M   | Any step          | Jump to substep M of step N                       |
| GOTO {N}.M | Dynamic step {N}. | Jump to substep M within current dynamic instance |
| GOTO NEXT  | Dynamic step {N}. | Create the next dynamic step instance (N+1)       |

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

Executable examples and conformance test cases are maintained in the `packages/parser/fixtures/conformance/` directory.

- **Valid Runbooks**: `packages/parser/fixtures/conformance/valid/`
- **Invalid Runbooks (Error Cases)**: `packages/parser/fixtures/conformance/invalid/`
