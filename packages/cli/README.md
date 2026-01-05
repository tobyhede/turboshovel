# @turboshovel/cli

Workflow orchestration CLI for Claude Code.

## Installation

```bash
npm install -g @turboshovel/cli
```

## Usage

```bash
# Start a workflow
tsv start my-workflow.md

# Check status
tsv status

# Mark step as passed (advance to next step)
tsv pass

# Mark step as failed (evaluates FAIL condition)
tsv fail

# Jump to specific step
tsv goto 3

# Stop workflow
tsv stop
```

## Commands

| Command | Description |
|---------|-------------|
| `tsv start <file>` | Start a new workflow |
| `tsv pass` | Mark current step as passed (evaluates PASS condition) |
| `tsv fail` | Mark current step as failed (evaluates FAIL condition) |
| `tsv goto <n>` | Jump to specific step number |
| `tsv status` | Show current state |
| `tsv stop` | Abort workflow and delete workflow state |
| `tsv complete` | Mark workflow as successfully completed |
| `tsv stash` | Pause enforcement |
| `tsv pop` | Resume enforcement |
| `tsv list` | List all workflows |
| `tsv gate <name>` | Run a gate |

The `turboshovel` command is an alias for `tsv`.

## Workflow System

Workflows provide structured, repeatable processes with state tracking, conditional logic, and task management.

### Why Workflows?

Traditional skills and agents are guidance-only. Workflows enforce process:

- **State Persistence**: Survives context clears and session restarts
- **Conditional Logic**: PASS/FAIL branches, GOTO for loops, agent-controlled decisions
- **Step Tracking**: Monitor progress across multiple substeps
- **Retry Management**: Automatic retry counts and limits
- **Variable Storage**: Pass data between workflow tasks

### Execution Paradigm: Claude Executes, Workflow Tracks

**Critical concept:** Workflows are **state trackers**, not executors. Claude still does all the work using its normal tools.

| Component | Who/What | Role |
|-----------|----------|------|
| **Workflow file** | Markdown document | Instructions for Claude (like a skill) |
| **Workflow CLI** | Human/Claude control | Tracks state: current step, variables, retry count |
| **Claude** | AI agent | Executes steps using Step, Bash, Edit, etc. |

**What the workflow provides:**
- **Persistent state** - survives context clears, session restarts
- **Progress tracking** - current step, retry counts, variables
- **CLI control** - human can check status, jump steps, stop workflow
- **Context injection** - active workflow prompt auto-injects into conversation

**What the workflow does NOT do:**
- Execute bash commands automatically (Claude runs them)
- Dispatch agents automatically (Claude uses Step tool)
- Make decisions automatically (Claude interprets PASS/FAIL outcomes)

### Orchestration (Subagent Dispatch)

**1. Task Binding (Agent-managed)**
Queue a step for an agent to execute autonomously:
```bash
tsv start --step 3.1      # Queue step 3.1
tsv start --agent xyz123  # Bind agent xyz123 to pending step
```

**2. Subworkflow Dispatch (Enforced)**
Queue a step with a mandatory subworkflow:
```bash
tsv start --step 3.1 subtask.workflow.md  # Queue step with workflow
tsv start --agent xyz123                  # Bind agent (auto-starts subworkflow)
```

**Completion & Status:**
```bash
tsv pass --agent xyz123  # Mark agent as passed
tsv fail --agent xyz123  # Mark agent as failed
```

**Pause Enforcement:**
Pause enforcement for ad-hoc work:
```bash
tsv stash   # Pause enforcement
# ... do untracked work ...
tsv pop     # Resume enforcement
```

## Workflow Syntax Reference

### Step Format

Steps must use H2 headers (`##`) with sequential numbering:

```markdown
## 1. Step title

Step content here.

## 2. Next step

More content.
```

**Invalid formats:**
- H1 headers (`#`) - rejected with error
- Non-sequential numbering (1, 3, 4) - rejected with error
- Zero or negative numbers - rejected with error

### Code Blocks (Commands)

Bash code blocks execute as shell commands:

```markdown
## 1. Run tests

```bash
npm test
```
```

**Rules:**
- Only `bash` language supported
- One code block per task (multiple blocks rejected)
- Combine multiple commands with `&&` or `;`
- No code block means task is prompt-only

### Prompts

Prompts guide agent behavior. Two types:

**Explicit prompts** (using `**Prompt:**` marker):

```markdown
## 1. Review code

**Prompt:** Review the implementation for security issues.
```

**Implicit prompts** (step description becomes prompt):

```markdown
## 1. Review code

Review the implementation for security issues.
Check for SQL injection, XSS, and auth bypasses.
```

If no code block and no explicit prompt, all step text becomes the implicit prompt.

### Conditions (PASS/FAIL)

Define what happens based on command or agent outcome:

```markdown
## 1. Run tests

```bash
npm test
```

- PASS: CONTINUE
- FAIL: STOP "Tests failed"
```

**Condition patterns:**
- List items (`- PASS: action`)
- Paragraphs (`PASS: action`)
- Defaults if omitted: `PASS: CONTINUE`, `FAIL: STOP`

### IF/ELSE Conditionals

> **⚠️ NOT YET IMPLEMENTED:** IF/ELSE conditionals are planned but not currently supported by the parser. The parser only handles PASS/FAIL conditions. Use the agent-controlled branching pattern below instead.

The planned syntax for variable-based conditional branching:

```markdown
## 6. Check progress

- IF: more_batches
  - GOTO: 3
- ELSE: CONTINUE
```

Variables would be set programmatically by agents or workflow logic.

#### Agent-Controlled Branching (Current Workaround)

Since IF/ELSE is not yet implemented, use agent-driven decisions with the `--goto` flag to create loops and conditional branching:

```markdown
## 5. Check remaining steps

**Prompt:** Check TodoWrite for remaining steps.

If more steps remain → `tsv goto 3`
If all done → `tsv pass`

- PASS: CONTINUE
```

**How it works:**
1. Agent reads the step guidance with decision instructions
2. Agent evaluates the condition (e.g., checks TodoWrite for remaining steps)
3. Agent executes the appropriate CLI command:
   - **Loop back:** `tsv goto 3` (jumps to step 3)
   - **Continue forward:** `tsv pass` (proceeds to step 6)

**Advantages over parsed IF/ELSE:**
- Agent can apply contextual judgment
- More flexible than rigid conditionals
- Works with existing workflow infrastructure
- Supports complex multi-condition decisions

### Actions Reference

| Action | Syntax | Description |
|--------|--------|-------------|
| `CONTINUE` | `PASS: CONTINUE` | Proceed to next step |
| `STOP` | `FAIL: STOP` | End workflow with failure |
| `STOP` with message | `FAIL: STOP "Tests failed"` | End workflow with error message |
| `DONE` | `PASS: DONE` | End workflow with success |
| `GOTO` | `FAIL: GOTO 1` | Jump to specific step number |
| `RETRY` | `FAIL: RETRY` | Retry current task (default: 1 attempt, then STOP) |
| `RETRY` with max | `FAIL: RETRY 3` | Retry up to 3 times before STOP |
| `RETRY` with action | `FAIL: RETRY 3 GOTO 2` | Retry up to 3 times, then GOTO 2 |
| `RETRY` with message | `FAIL: RETRY "error msg"` | Retry once, then STOP with message |

**Action validation:**
- GOTO targets must exist (validated at parse time)
- GOTO self creates infinite loop (rejected)
- Task numbers 1-indexed (not zero-based)

### Error Recovery with RETRY

RETRY is an inline modifier with configurable retry count and exhaustion action.

**Syntax:** `RETRY [N:=1] [ACTION:=STOP]`

Where:
- `N` is the maximum retry attempts (default: 1)
- `ACTION` is what happens when retries are exhausted (default: STOP)
- Valid exhaustion actions: STOP, GOTO, CONTINUE, DONE

**Breaking change:** Default max retries changed from 3 to 1.

**Examples:**

```markdown
## 3. Run integration tests

```bash
npm run test:integration
```

- PASS: CONTINUE
- FAIL: RETRY              # Retry once, then STOP
- FAIL: RETRY 3            # Retry 3 times, then STOP
- FAIL: RETRY 3 GOTO 2     # Retry 3 times, then jump to task 2
- FAIL: RETRY 5 CONTINUE   # Retry 5 times, then continue anyway
- FAIL: RETRY "Tests failed after retries"  # Retry once, then STOP with message
```

**Retry behavior:**
- Increments `retryCount` on each failure
- Executes exhaustion ACTION after `retryMax` attempts (default: 1)
- Resets to 0 on task change
- State persists between retries

## Writing Workflows for Agents

### Agent Interpretation

Agents should:
1. **Read task description** - Understand the goal
2. **Execute command** (if present) - Run bash block
3. **Follow prompt** (if present) - Agent-driven task
4. **Evaluate outcome** - Determine PASS/FAIL
5. **Apply action** - CONTINUE, STOP, GOTO, etc.

### Variable Usage

Set variables during task execution:

```markdown
## 3. Execute batch

Execute next batch of tasks (3 tasks per batch).

**Prompt:** After completing batch, set `more_batches` variable based on remaining tasks.
```

Access variables in conditionals (planned syntax, not yet implemented):

```markdown
## 6. Check progress

- IF: more_batches
  - GOTO: 3
- ELSE: CONTINUE
```

> **Note:** IF/ELSE conditionals are not yet implemented. Use agent-controlled branching instead (see above).

### Integration with Cipherpowers Skills

Workflows can reference existing skills:

```markdown
## 1. Review code

**Prompt:** Use `/cipherpowers:code-review` skill to review implementation.

- PASS: CONTINUE
- FAIL: STOP "Review found BLOCKING issues"
```

**Workflow advantages over skills:**
- Enforces execution order
- Tracks completion state
- Provides retry logic
- Survives context clears

## Best Practices

### When to Use Workflows vs Gates

**Use workflows when:**
- Multi-task processes with branching
- State must persist across sessions
- Retry logic needed
- Progress tracking important
- Agent-driven execution

**Use gates when:**
- Single quality check (lint, test, build)
- Immediate enforcement needed
- No state tracking required
- Triggered by file edits or keywords

### Workflow Composition Patterns

**Sequential tasks** (most common):
```markdown
## 1. Setup
- PASS: CONTINUE

## 2. Execute
- PASS: CONTINUE

## 3. Verify
- PASS: DONE
```

**Loop with agent-controlled branching**:
```markdown
## 1. Process batch
- PASS: CONTINUE

## 2. Check remaining

**Prompt:** Check if more items remain.

If more items → `tsv goto 1`
If complete → `tsv pass`

- PASS: CONTINUE
```

**Retry with backoff**:
```markdown
## 1. Flaky operation
- PASS: CONTINUE
- FAIL: RETRY 5
```

**Error recovery**:
```markdown
## 1. Deploy
- PASS: CONTINUE
- FAIL: GOTO 99

## 2. Verify
- PASS: DONE

## 99. Rollback
**Prompt:** Rollback deployment and report error.
- PASS: STOP "Deployment failed, rolled back"
```

## State Management

### Persistence

Workflow state persists to `.claude/turboshovel/workflows/{id}.json`:

```json
{
  "id": "wf-2025-01-15-abc123",
  "workflow": "my-workflow.md",
  "task": 3,
  "taskName": "Execute batch",
  "retryCount": 0,
  "retryMax": 3,
  "variables": {
    "more_batches": true,
    "has_blocked_task": false
  },
  "tasks": [
    {
      "id": "task-001",
      "status": "complete",
      "startedAt": "2025-01-15T10:00:00Z",
      "completedAt": "2025-01-15T10:05:00Z"
    }
  ],
  "startedAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:05:00Z"
}
```

### Active Workflow Tracking

The active workflow ID is stored in `.claude/turboshovel/session.json`. This survives context clears and session restarts.

**Note on dual session architecture:** The plugin maintains two separate session mechanisms:
- **Hook session** (`.claude/session/state.json`) - Tracks hook execution state, modified files, and gate results within a Claude Code session
- **Workflow session** (`.claude/turboshovel/session.json`) - Tracks active workflow and persists across sessions

### Variables

Variables are key-value pairs stored in workflow state:

```typescript
variables: Record<string, boolean | number | string>
```

**Common patterns:**
- `has_blocked_task: true` - Agent encountered blocker
- `more_batches: true` - Batch processing incomplete
- `tests_passing: false` - Test status

Variables are set by:
- Workflow hooks (SubagentStop tracking)
- Agent logic during task execution
- Manual updates via CLI (future)

### Task Tracking

Tasks represent parallel work items within a workflow task:

```typescript
interface TaskState {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'blocked';
  subagentType?: string;
  startedAt?: string;
  completedAt?: string;
}
```

**SubagentStop hook integration:**
- Automatically detects task completion
- Parses `STATUS: OK` or `STATUS: BLOCKED` from agent output
- Updates task state and workflow variables
- Suggests next action (`tsv next`)

## License

MIT