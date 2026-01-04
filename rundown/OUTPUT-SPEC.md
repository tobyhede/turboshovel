# CLI Output Format

Concise, consistent output format shared across workflow commands.

---

## Execution Modes

### Default (Auto-Execute and Chain)
- Commands execute automatically
- Output piped to stdout via `stdio: 'inherit'`
- Exit code determines outcome: `0 = PASS`, `non-zero = FAIL`
- Transitions evaluated automatically based on outcome
- Chaining continues while next step has a `bash` command
- A transition always prints metadata for the next step

### With `--prompted`
- Commands are displayed but NOT executed
- Agent runs the command manually
- Agent calls `tsv pass` or `tsv fail` for every step
- No auto-chaining; each step waits for manual signal

### Flag Inheritance
- Child workflows inherit the `--prompted` flag from the parent

---

## Common Blocks

### Metadata
From and Result are optional, only displayed if there is a previous result to display.

```
File:     {WorkflowPath}
State:    .claude/turboshovel/workflows/{StateId}.json
Prompt:   {Yes|No}
```

### Action
```
Action:   {START|CONTINUE|GOTO n|COMPLETE|STOP|RETRY (n/N)}
From?:    {m}/{N}
Result?:  {PASS|FAIL}
```

Notes:
- `Action` reflects the transition or command effect.
- `From` is the step that was just evaluated (where we transitioned from)
- `Result` is the pass/fail result of that evaluation (aligns with `--result` flag)


### Step Block

```
Step:    {n}/{N}

## {n}. {StepTitle}

{Step:Prompt?}

```bash
{Step:Command?}
```

```prompt
{Step:PromptBlock?}
```

$ {Step:Command?}        <- Default only for `bash` blocks (disabled with --prompted)
{Step:CommandOutput?}    <- Default only for `bash` blocks, real-time via stdio:inherit
```

Notes:
- Prompts appear before the fenced block.
- Omit the fenced block if the step has neither `bash` nor `prompt`.
- Only one fenced block is shown per step (either `bash` or `prompt`).
- In `--prompted`, omit the `$` line and command output for `bash` blocks.
- `prompt` blocks never show a `$` line or command output.
- `Step` is the current step after the transition
---

## Sequencing Rules

- Standard output is `Metadata` followed by the `Step Block`.
- In auto-exec mode, command output appears after the Step Block.
- If another step is entered (chaining or manual transition), print a separator line (`-----`), then the next `Metadata` + `Step Block`.
- `From`/`Result` are populated in the Action block after a transition.

---

## Terminal Messages

When a workflow ends, print the Metadata (with `Action: COMPLETE` or `Action: STOP`) and then:

```
Workflow complete.
```

or

```
Workflow blocked at step {n}.
```

or

```
Workflow stopped.
```

---

## List Output

```
{ID}  {Status}  {Step}  {File}
{ID}  {Status}  {Step}  {File}
...
```

Status values: `active`, `stashed`, `complete`.

### No Workflows

```
No workflows.
```

---

## No Active Workflow

```
No active workflow.
```
