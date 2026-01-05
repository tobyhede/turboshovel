# CLI Output Format

Concise, consistent output format shared across workflow commands.

---

## Execution Modes

### Default (Auto-Execute)
- Commands execute automatically.
- Output piped to stdout via `stdio: 'inherit'`.
- Transitions evaluated automatically based on outcome.

### With `--prompted`
- Commands are displayed but NOT executed.
- Agent runs the command manually.
- Agent calls `tsv pass` or `tsv fail` for every step.

---

## Common Blocks

### Metadata
Displayed when a workflow starts or resumes.

```
File:     {WorkflowPath}
State:    .claude/turboshovel/workflows/{StateId}.json
Prompt:   Yes
```
*Note: The `Prompt:` line is only displayed if prompted mode is enabled.*

### Action
Displayed when a transition occurs or an action is taken.

```
Action:   {START|CONTINUE|GOTO n|COMPLETE|STOP}
From:     {n}/{N}
Result:   {PASS|FAIL}
```
*Note: `From` and `Result` are optional and only displayed when applicable (e.g., after a step evaluation).*

### Step Block
Displayed when entering a step. Includes a preceding blank line.

```

Step:     {n}/{N}

## {n}. {StepTitle}

{Prompt Text...}

```bash
{Command Code}
```
```
*Note: Prompts are rendered as plain text paragraphs. The command block is only shown if the step has a command.*

### Command Execution
In default mode, the command and its output are shown following the step block.

```

$ {Command}

{Command Output...}
```

### Separator
Used to visually separate distinct phases or steps.

```
-----
```

---

## Terminal Messages

### Completion

```

Workflow complete.
```

### Stopped

```

Workflow stopped.
```

### Blocked

```

Workflow blocked at step {n}.
```
*Note: Substeps are formatted as `n.m`.*

### Stashed

```

Step:     {n}/{N}

Workflow stashed.
```

### No Active Workflow

```
No active workflow.
```

### No Workflows

```
No workflows.
```

---

## List Output

Displays a tabular list of workflows.

```
{ID}  {Status}  {Step}  {File}
{ID}  {Status}  {Step}  {File}
...
```