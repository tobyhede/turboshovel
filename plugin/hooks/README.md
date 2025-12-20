# Quality Hooks

Automated quality enforcement and context injection via Claude Code's hook system. A **self-referential TypeScript application** that uses its own configuration format.

> **💡 CONTEXT INJECTION IS AUTOMATIC**
>
> Just create `.claude/context/{name}-{stage}.md` files - they auto-inject at the right time.
> **No configuration files needed.** No gates.json. No setup.
>
> The `gates.json` file is ONLY for optional quality enforcement (lint, test, build checks).

## Quick Start

### Zero-Config Context Injection (Recommended)

**Just create context files - they auto-inject automatically:**

```bash
# Create context directory
mkdir -p .claude/context

# Add context for /code-review command
cat > .claude/context/code-review-start.md << 'EOF'
## Security Requirements
- Authentication on all endpoints
- Input validation for user data
- No secrets in logs
- HTTPS only
EOF

# That's it! When /code-review runs, requirements auto-inject!
```

**Works with ANY command, skill, or agent.** Follow the naming pattern: `.claude/context/{name}-{stage}.md`

### Advanced: Quality Gates (Optional)

**Need to enforce quality checks?** Add `gates.json` configuration:

```bash
mkdir -p .claude
cat > .claude/gates.json << 'EOF'
{
  "gates": {
    "check": {"command": "npm run lint", "on_fail": "BLOCK"},
    "test": {"command": "npm test", "on_fail": "BLOCK"}
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["check"]
    }
  }
}
EOF
```

See **[SETUP.md](./SETUP.md)** for detailed gate configuration.

## How It Works

```
Hook Event → Context Injection (AUTOMATIC) → [OPTIONAL: gates.json Gates] → Action
                 ↓                                        ↓
          .claude/context/                         Quality checks
          plugin/context/                          Custom commands
          (zero config!)                           (requires gates.json)
```

1. **Context Injection** (AUTOMATIC): Always runs first, discovers `.claude/context/{name}-{stage}.md` files
2. **Gate Execution** (OPTIONAL): If `gates.json` configured, runs quality checks/custom commands
3. **Action Handling**: CONTINUE, BLOCK, STOP, or chain to another gate

**Context injection works standalone - gates.json is only for optional quality enforcement.**

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for detailed system design.

## Supported Hook Events

All 12 Claude Code hook types are supported:

| Event | Context Pattern | Default Behavior |
|-------|----------------|------------------|
| `SessionStart` | `session-start.md` | Plugin provides environment context |
| `SessionEnd` | `session-end.md` | - |
| `UserPromptSubmit` | `prompt-submit.md` | Keyword-triggered gates (check, test, build) |
| `SlashCommandStart` | `{command}-start.md` | - |
| `SlashCommandEnd` | `{command}-end.md` | - |
| `SkillStart` | `{skill}-start.md` | - |
| `SkillEnd` | `{skill}-end.md` | - |
| `SubagentStop` | `{agent}-end.md` | - |
| `PreToolUse` | `{tool}-pre.md` | - |
| `PostToolUse` | `{tool}-post.md` | - |
| `Stop` | `agent-stop.md` | - |
| `Notification` | `notification-receive.md` | - |

**Note:** SessionStart fires at the beginning of each Claude Code session and injects context from `session-start.md`.

## Context Injection

**Zero-config content injection** via file naming convention.

### Naming Convention

```
Pattern: .claude/context/{name}-{stage}.md

Examples:
  /code-review starts  → .claude/context/code-review-start.md
  /plan starts         → .claude/context/plan-start.md
  TDD skill loads      → .claude/context/test-driven-development-start.md
  SessionStart fires   → .claude/context/session-start.md
```

### Priority Order

1. **Project context** (`.claude/context/`) - highest priority
2. **Plugin context** (`${CLAUDE_PLUGIN_ROOT}/context/`) - fallback defaults

Projects can override any plugin-provided context by creating their own file.

### Complete Zero-Config Example

**Step 1: Create context file**

```bash
mkdir -p .claude/context
cat > .claude/context/code-review-start.md << 'EOF'
## Security Checklist

- [ ] Authentication on all endpoints
- [ ] Input validation for user data
- [ ] No secrets in logs
- [ ] HTTPS only
- [ ] Rate limiting configured
EOF
```

**Step 2: Run the command**

```bash
/code-review src/api/users.ts
```

**Step 3: Context auto-injects**

The security checklist appears in the conversation automatically. **No configuration files needed!**

**This works with ANY slash command, skill, or agent.** Just follow the naming pattern: `.claude/context/{name}-{stage}.md`

### Hook-to-File Mapping

| Hook Type | File Pattern | Example |
|-----------|--------------|---------|
| `SessionStart` | `session-start.md` | Session begins |
| `UserPromptSubmit` | `prompt-submit.md` | User sends message |
| `SlashCommandStart` | `{command}-start.md` | `/code-review-start.md` |
| `SlashCommandEnd` | `{command}-end.md` | `/code-review-end.md` |
| `SkillStart` | `{skill}-start.md` | `test-driven-development-start.md` |
| `SkillEnd` | `{skill}-end.md` | `test-driven-development-end.md` |
| `SubagentStop` | `{agent}-end.md` | `rust-agent-end.md` |
| `PreToolUse` | `{tool}-pre.md` | `Edit-pre.md` |
| `PostToolUse` | `{tool}-post.md` | `Edit-post.md` |

See **[CONVENTIONS.md](./CONVENTIONS.md)** for full documentation.

## Gate Configuration (Optional)

**Most users only need context files.** Gates are for optional quality enforcement and custom commands.

Gates are defined in `gates.json` and can be:

### Monorepo Support

Configure different gates for different packages using file pattern filtering:

```json
{
  "gates": {
    "backend:check": {
      "description": "Backend quality checks",
      "command": "npm run check:backend",
      "file_patterns": ["packages/backend/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "frontend:check": {
      "description": "Frontend quality checks",
      "command": "npm run check:frontend",
      "file_patterns": ["packages/frontend/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["backend:check", "frontend:check"]
    }
  }
}
```

Only the relevant package's checks run based on which files you edit.

## Plugin Gate References

Reference gates defined in other plugins:

```json
{
  "gates": {
    "plan-compliance": {
      "plugin": "cipherpowers",
      "gate": "plan-compliance"
    },
    "check": {
      "command": "npm run lint"
    }
  },
  "hooks": {
    "SubagentStop": {
      "gates": ["plan-compliance", "check"]
    }
  }
}
```

The `plugin` field uses sibling convention - assumes plugins are installed in the same directory (e.g., `~/.claude/plugins/`). The gate's command runs in the plugin's directory context.

### Shell Command Gates

```json
{
  "gates": {
    "check": {
      "command": "npm run lint",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  }
}
```

### TypeScript Gates

Gates without `command` field are TypeScript modules in `src/gates/`:

```json
{
  "gates": {
    "plugin-path": {
      "description": "Verify plugin path resolution in subagents",
      "on_pass": "CONTINUE",
      "on_fail": "CONTINUE"
    }
  }
}
```

See **[TYPESCRIPT.md](./TYPESCRIPT.md)** for creating TypeScript gates.

### Keyword-Triggered Gates

Gates can define `keywords` to only run when the user message contains matching terms:

```json
{
  "gates": {
    "test": {
      "description": "Run project test suite",
      "keywords": ["test", "testing", "spec", "verify"],
      "command": "npm test",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "UserPromptSubmit": {
      "gates": ["test"]
    }
  }
}
```

**Behavior:**
- Gates with `keywords` only run if any keyword is found in the user message
- Gates without `keywords` always run (backwards compatible)
- Keyword matching is case-insensitive

**Important:** The `keywords` field only applies to the `UserPromptSubmit` hook. Keywords are ignored for all other hook types (PostToolUse, SubagentStop, etc.).

### Agent Filtering for SubagentStop

**Important:** Without `enabled_agents`, SubagentStop triggers for ALL agents - including verification-only agents that don't modify code.

```json
{
  "hooks": {
    "SubagentStop": {
      "enabled_agents": ["rust-agent", "code-agent", "commit-agent"],
      "gates": ["check", "test"]
    }
  }
}
```

**Why this matters:**
- Verification agents (technical-writer in VERIFICATION mode, research-agent) only read files
- Running `check` and `test` gates after read-only verification is unnecessary
- Gate failures for verification agents confuse the workflow (false positives)

**Recommended pattern:** Only include agents that modify code:
- `rust-agent`, `code-agent` - write/edit code
- `commit-agent` - makes git commits
- Exclude: `technical-writer` (verification mode), `research-agent`, `plan-review-agent`

**Note:** `enabled_tools` works the same way for PostToolUse hooks.

## Configuration Merging

The system merges plugin and project configurations:

```
plugin/hooks/gates.json     (defaults)
        ↓ merged with
.claude/gates.json          (project overrides)
        ↓
Merged Configuration        (project takes precedence)
```

**Plugin provides defaults. Projects override what they need.**

## Multi-Plugin Best Practices

When using turboshovel alongside other Claude Code plugins:

**✅ DO:**
- Enable plugins in `.claude/settings.local.json` using `enabledPlugins`
- Let Claude Code handle `${CLAUDE_PLUGIN_ROOT}` automatically per-plugin
- Reference cross-plugin gates using the `plugin` field in gates.json

**❌ DON'T:**
- Set `CLAUDE_PLUGIN_ROOT` in project-level `env` configuration
- Hardcode plugin paths in your project settings
- Override automatic plugin path resolution

**Example correct configuration:**
```json
{
  "enabledPlugins": {
    "turboshovel@turboshovel": true,
    "cipherpowers@cipherpowers-dev": true
  }
}
```

Claude Code automatically sets the correct `${CLAUDE_PLUGIN_ROOT}` for each plugin during hook execution. Project-level environment variable overrides break this mechanism.

See **[SETUP.md](./SETUP.md#hooks-not-running-in-multi-plugin-projects)** for troubleshooting multi-plugin issues.

## Debugging

Logs are written to `$TMPDIR/turboshovel/hooks-YYYY-MM-DD.log`:

```bash
# View logs in real-time
tail -f $(node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js log-path)

# Or find the log file
ls $TMPDIR/turboshovel/hooks-*.log
```

**What gets logged:**
- Hook event received
- Config files loaded
- Context files discovered
- Gates executed
- Actions taken

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and data flow
- **[CONVENTIONS.md](./CONVENTIONS.md)** - Context file naming conventions
- **[SETUP.md](./SETUP.md)** - Detailed configuration guide
- **[TYPESCRIPT.md](./TYPESCRIPT.md)** - Creating TypeScript gates
- **[INTEGRATION_TESTS.md](./INTEGRATION_TESTS.md)** - Testing procedures

## Workflow System

Turboshovel includes an executable workflow system that makes skills enforceable. Workflows provide structured, repeatable processes with state tracking, conditional logic, and task management.

### Why Workflows?

Traditional skills and agents are guidance-only. Workflows enforce process:

- **State Persistence**: Survives context clears and session restarts
- **Conditional Logic**: PASS/FAIL branches, GOTO for loops, agent-controlled decisions
- **Task Tracking**: Monitor progress across multiple subtasks
- **Retry Management**: Automatic retry counts and limits
- **Variable Storage**: Pass data between workflow steps

### Execution Paradigm: Claude Executes, Workflow Tracks

**Critical concept:** Workflows are **state trackers**, not executors. Claude still does all the work using its normal tools.

| Component | Who/What | Role |
|-----------|----------|------|
| **Workflow file** | Markdown document | Instructions for Claude (like a skill) |
| **Workflow CLI** | Human/Claude control | Tracks state: current step, variables, retry count |
| **Claude** | AI agent | Executes steps using Task, Bash, Edit, etc. |

**What the workflow provides:**
- **Persistent state** - survives context clears, session restarts
- **Progress tracking** - current step, retry counts, variables
- **CLI control** - human can check status, jump steps, stop workflow
- **Context injection** - active workflow prompt auto-injects into conversation

**What the workflow does NOT do:**
- Execute bash commands automatically (Claude runs them)
- Dispatch agents automatically (Claude uses Task tool)
- Make decisions automatically (Claude interprets PASS/FAIL outcomes)

**Example flow:**
```
1. Human: workflow start execute.workflow.md
2. Workflow: Sets state to Step 1, injects prompt into conversation
3. Claude: Reads prompt, executes step using tools (Task, Bash, etc.)
4. Claude: Determines outcome (PASS/FAIL based on results)
5. Claude: Runs `workflow next` or `workflow next --step N`
6. Repeat until DONE
```

**Key insight:** A workflow is essentially a **skill with persistent state + CLI control**. The step text is guidance for Claude, just like skill instructions.

### Quick Start

```bash
# Start a workflow
workflow start execute.workflow.md

# Check status
workflow status

# Advance to next step
workflow next

# Jump to specific step
workflow next --step 3

# List all workflows
workflow list

# Stop workflow
workflow stop
```

### Complete Workflow Syntax Reference

#### Step Format

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

#### Code Blocks (Commands)

Bash code blocks execute as shell commands:

```markdown
## 1. Run tests

\`\`\`bash
npm test
\`\`\`
```

**Rules:**
- Only `bash` language supported
- One code block per step (multiple blocks rejected)
- Combine multiple commands with `&&` or `;`
- No code block means step is prompt-only

#### Prompts

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

#### Conditions (PASS/FAIL)

Define what happens based on command or agent outcome:

```markdown
## 1. Run tests

\`\`\`bash
npm test
\`\`\`

- PASS: CONTINUE
- FAIL: STOP "Tests failed"
```

**Condition patterns:**
- List items (`- PASS: action`)
- Paragraphs (`PASS: action`)
- Defaults if omitted: `PASS: CONTINUE`, `FAIL: STOP`

#### IF/ELSE Conditionals

> **⚠️ NOT YET IMPLEMENTED:** IF/ELSE conditionals are planned but not currently supported by the parser. The parser only handles PASS/FAIL conditions. Use the agent-controlled branching pattern below instead.

The planned syntax for variable-based conditional branching:

```markdown
## 6. Check progress

- IF: more_batches
  - GOTO: 3
- ELSE: CONTINUE
```

Variables would be set programmatically by agents or workflow logic.

##### Agent-Controlled Branching (Current Workaround)

Since IF/ELSE is not yet implemented, use agent-driven decisions with the `--step` flag to create loops and conditional branching:

```markdown
## 5. Check remaining tasks

**Prompt:** Check TodoWrite for remaining tasks.

If more tasks remain → `workflow next --step 3`
If all done → `workflow next`

- PASS: CONTINUE
```

**How it works:**
1. Agent reads the step guidance with decision instructions
2. Agent evaluates the condition (e.g., checks TodoWrite for remaining tasks)
3. Agent executes the appropriate CLI command:
   - **Loop back:** `workflow next --step 3` (jumps to step 3)
   - **Continue forward:** `workflow next` (proceeds to step 6)

**Advantages over parsed IF/ELSE:**
- Agent can apply contextual judgment
- More flexible than rigid conditionals
- Works with existing workflow infrastructure
- Supports complex multi-condition decisions

**Example patterns:**

```markdown
## 3. Execute batch

**Prompt:** Execute next 3 tasks from plan.

After batch completes, check remaining work:
- If more batches needed → `workflow next --step 2` (review + loop)
- If all tasks complete → `workflow next` (continue to finalization)

- PASS: CONTINUE
- FAIL: RETRY 3
```

This pattern is the **recommended approach** until native IF/ELSE support is implemented.

#### Actions Reference

| Action | Syntax | Description |
|--------|--------|-------------|
| `CONTINUE` | `PASS: CONTINUE` | Proceed to next step |
| `STOP` | `FAIL: STOP` | End workflow with failure |
| `STOP` with message | `FAIL: STOP "Tests failed"` | End workflow with error message |
| `DONE` | `PASS: DONE` | End workflow with success |
| `GOTO` | `FAIL: GOTO 1` | Jump to specific step number |
| `RETRY` | `FAIL: RETRY` | Retry current step (default max 3) |
| `RETRY` with max | `FAIL: RETRY 5` | Retry with custom max attempts |

**Action validation:**
- GOTO targets must exist (validated at parse time)
- GOTO self creates infinite loop (rejected)
- Step numbers 1-indexed (not zero-based)

#### Complete Example

This example demonstrates agent-controlled branching for loops (the current workaround pattern):

```markdown
# Execute Workflow

Execute implementation plans in controlled batches.

## 1. Load plan

**Prompt:** Load plan from path or discover in `.work/` directory. Read plan file and review critically for questions or concerns.

- PASS: CONTINUE
- FAIL: STOP "No plan file found."

## 2. Create tracking

**Prompt:** Create TodoWrite tracking items for plan tasks.

- PASS: CONTINUE
- FAIL: STOP "Could not create task tracking."

## 3. Execute batch

**Prompt:** Execute next batch of tasks (3 tasks per batch). Dispatch subagent for each task with embedded following-plans skill.

- PASS: CONTINUE
- FAIL: RETRY 3

## 4. Review batch

**Prompt:** Dispatch code-review-agent to review batch implementation.

- PASS: CONTINUE
- FAIL: STOP "BLOCKING issues found. Fix before continuing."

## 5. Report progress

**Prompt:** Show what was implemented. Say: "Ready for feedback."

- PASS: CONTINUE

## 6. Check remaining work

**Prompt:** Check TodoWrite for remaining tasks.

If more batches needed → `workflow next --step 3`
If all tasks complete → `workflow next`

- PASS: CONTINUE

## 7. Complete

**Prompt:** Verify tests pass. Present completion options.

- PASS: DONE
- FAIL: STOP "Tests failing. Fix before completing."
```

### State Management

#### Persistence

Workflow state persists to `.claude/turboshovel/workflows/{id}.json`:

```json
{
  "id": "wf-2025-01-15-abc123",
  "workflow": "execute.workflow.md",
  "step": 3,
  "stepName": "Execute batch",
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

#### Active Workflow Tracking

The active workflow ID is stored in `.claude/turboshovel/session.json`. This survives context clears and session restarts.

#### Variables

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
- Agent logic during step execution
- Manual updates via CLI (future)

#### Task Tracking

Tasks represent parallel work items within a workflow step:

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
- Suggests next action (`workflow next`)

### CLI Commands

#### `workflow start <file>`

Start a new workflow from a markdown file.

```bash
# Start from relative path
workflow start execute.workflow.md

# Start from absolute path
workflow start /path/to/workflow.md

# Start from examples
workflow start plugin/hooks/examples/code-review.workflow.md
```

**Behavior:**
- Parses workflow markdown
- Validates syntax (numbering, GOTO targets)
- Creates state file
- Sets as active workflow
- Displays Step 1 guidance

#### `workflow next`

Advance to the next step (step + 1).

```bash
workflow next
```

**Behavior:**
- Loads active workflow
- Increments step number
- Resets retry count
- Displays step guidance
- Auto-completes if past final step

#### `workflow next --step N`

Jump to a specific step (for GOTO actions).

```bash
workflow next --step 3
```

**Use cases:**
- GOTO action execution
- Manual navigation for debugging
- Skipping optional steps

#### `workflow status`

Show current workflow state.

```bash
workflow status
```

**Output:**
```
Workflow: execute.workflow.md
ID: wf-2025-01-15-abc123
Step 3: Execute batch
Retry: 0/3
Variables: {
  "more_batches": true
}
Tasks: 3
  - task-001: complete
  - task-002: running
  - task-003: pending
```

#### `workflow stop`

Abort the current workflow.

```bash
workflow stop
```

**Behavior:**
- Deletes workflow state file
- Clears active workflow
- Cannot be undone

#### `workflow list`

List all workflows (active and inactive).

```bash
workflow list
```

**Output:**
```
wf-2025-01-15-abc123 (active): execute.workflow.md - Step 3
wf-2025-01-14-def456: code-review.workflow.md - Step 2
```

### Writing Workflows for Agents

#### Agent Interpretation

Agents should:
1. **Read step description** - Understand the goal
2. **Execute command** (if present) - Run bash block
3. **Follow prompt** (if present) - Agent-driven task
4. **Evaluate outcome** - Determine PASS/FAIL
5. **Apply action** - CONTINUE, STOP, GOTO, etc.

#### Variable Usage

Set variables during step execution:

```markdown
## 3. Execute batch

Execute next batch of tasks (3 tasks per batch).

**Prompt:** After completing batch, set `more_batches` variable based on remaining tasks.
```

Access variables in conditionals:

```markdown
## 6. Check progress

- IF: more_batches
  - GOTO: 3
- ELSE: CONTINUE
```

#### Integration with Cipherpowers Skills

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

#### Example: Code Review Workflow

```markdown
# Code Review Workflow

Dispatch code-review-agent to review implementation.

## 1. Dispatch reviewer

\`\`\`bash
echo "Dispatching code-review-agent..."
\`\`\`

**Prompt:** Dispatch code-review-agent subagent with current changes.

- PASS: CONTINUE
- FAIL: RETRY 1

## 2. Categorize issues

**Prompt:** Categorize feedback as BLOCKING or NON-BLOCKING.

- PASS: CONTINUE
- FAIL: STOP "Could not categorize issues."

## 3. Handle blocking issues

- IF: has_blocking_issues
  - STOP "BLOCKING issues found. Fix before continuing."
- ELSE: CONTINUE

## 4. Address feedback

**Prompt:** Address NON-BLOCKING feedback or defer with justification.

- PASS: DONE
```

#### Example: Execute Workflow with Batch Processing

```markdown
# Execute Workflow

Execute implementation plans in controlled batches with review checkpoints.

## 1. Load plan

**Prompt:** Load plan from path or discover in `.work/` directory. Read plan file and review critically for questions or concerns.

- PASS: CONTINUE
- FAIL: STOP "No plan file found."

## 2. Create tracking

**Prompt:** Create TodoWrite tracking items for plan tasks.

- PASS: CONTINUE
- FAIL: STOP "Could not create task tracking."

## 3. Execute batch

**Prompt:** Execute next batch of tasks (3 tasks per batch). Dispatch subagent for each task with embedded following-plans skill.

- PASS: CONTINUE
- FAIL: RETRY 3

## 4. Review batch

**Prompt:** Dispatch code-review-agent to review batch implementation.

- PASS: CONTINUE
- FAIL: STOP "BLOCKING issues found. Fix before continuing."

## 5. Report progress

**Prompt:** Show what was implemented. Say: "Ready for feedback."

- PASS: CONTINUE

## 6. Check remaining work

**Prompt:** Check TodoWrite for remaining tasks.

If more batches needed → `workflow next --step 3`
If all tasks complete → `workflow next`

- PASS: CONTINUE

## 7. Complete

**Prompt:** Verify tests pass. Present completion options.

- PASS: DONE
- FAIL: STOP "Tests failing. Fix before completing."
```

### Best Practices

#### When to Use Workflows vs Gates

**Use workflows when:**
- Multi-step processes with branching
- State must persist across sessions
- Retry logic needed
- Progress tracking important
- Agent-driven execution

**Use gates when:**
- Single quality check (lint, test, build)
- Immediate enforcement needed
- No state tracking required
- Triggered by file edits or keywords

#### Workflow Composition Patterns

**Sequential steps** (most common):
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

If more items → `workflow next --step 1`
If complete → `workflow next`

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

#### Error Recovery with RETRY

```markdown
## 3. Run integration tests

\`\`\`bash
npm run test:integration
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 3
```

**Retry behavior:**
- Increments `retryCount` on each failure
- Stops after `retryMax` attempts (default 3)
- Resets to 0 on step change
- State persists between retries

#### Agent-Controlled Loops

**Safe loop pattern** (agent evaluates condition):

```markdown
## 1. Process item

**Prompt:** Process next item from queue.

- PASS: CONTINUE
- FAIL: RETRY 3

## 2. Check queue

**Prompt:** Check if queue has more items.

If queue not empty → `workflow next --step 1`
If queue empty → `workflow next`

- PASS: CONTINUE
```

**Loop safety:**
- Agent applies judgment to exit conditions
- More flexible than rigid GOTO conditionals
- Can handle complex multi-condition decisions
- Works with current workflow infrastructure

### Migration Guide for Cipherpowers Agents

#### Converting Skills to Workflows

**Before (skill):**
```markdown
# /cipherpowers:execute

Execute implementation plans in batches.

1. Load plan
2. Execute batch
3. Review batch
4. Repeat until done
```

**After (workflow):**
```markdown
# Execute Workflow

## 1. Load plan

**Prompt:** Load plan from `.work/` directory.

- PASS: CONTINUE
- FAIL: STOP "No plan found"

## 2. Execute batch

**Prompt:** Execute 3 tasks.

- PASS: CONTINUE
- FAIL: RETRY 3

## 3. Review batch

**Prompt:** Dispatch code-review-agent.

- PASS: CONTINUE
- FAIL: STOP "BLOCKING issues"

## 4. Check remaining tasks

**Prompt:** Check if more batches remain.

If more batches → `workflow next --step 2`
If complete → `workflow next`

- PASS: CONTINUE

## 5. Complete

**Prompt:** All batches complete.

- PASS: DONE
```

**Advantages gained:**
- State survives context clears
- Retry logic built-in
- Progress visible via `workflow status`
- Can resume after interruption

#### Workflow Hooks Integration

Workflows automatically integrate with hook system:

**SubagentStop hook:**
- Detects task completion
- Updates task status
- Sets variables (`has_blocked_task`)
- Suggests `workflow next`

**SessionStart hook:**
- Auto-injects active workflow context
- Shows current step and progress
- Displays variables and tasks

**No configuration needed** - works automatically when workflow is active.

### Examples

Full workflow examples in `plugin/hooks/examples/`:

- **`execute.workflow.md`** - Batch execution with review checkpoints (7 steps)
- **`code-review.workflow.md`** - Code review dispatch and triage (4 steps)

See these files for complete, production-ready workflow patterns.

## Examples

See `plugin/hooks/examples/` for ready-to-use configurations:

- `strict.json` - Block on all failures
- `permissive.json` - Warn only
- `pipeline.json` - Gate chaining
- `context/` - Example context files
- `execute.workflow.md` - Batch execution workflow
- `code-review.workflow.md` - Code review workflow
