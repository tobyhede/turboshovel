# Quality Hooks

Automated quality enforcement and context injection via Claude Code's hook system. A **self-referential TypeScript application** that uses its own configuration format.

> **💡 CONTEXT INJECTION IS AUTOMATIC**
>
> Just create `.claude/context/{name}-{stage}.md` files - they auto-inject at the right time.
> **No configuration files needed.** No turboshovel.json. No setup.
>
> The `turboshovel.json` file is ONLY for optional quality enforcement (lint, test, build checks).

## Installation

### Plugin (Claude Code)

```bash
# Add turboshovel marketplace
claude plugin marketplace add tobyhede/turboshovel

# Install the plugin
claude plugin install turboshovel@turboshovel
```

### CLI (optional, for workflows)

```bash
npm install -g @turboshovel/cli
```

### Verify

Start a new Claude Code session. The plugin will be active and context injection will work automatically.

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

**Need to enforce quality checks?** Add `turboshovel.json` configuration:

```bash
mkdir -p .claude
cat > .claude/turboshovel.json << 'EOF'
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

See **[SETUP.md](SETUP.md)** for detailed gate configuration.

## How It Works

```
Hook Event → Context Injection (AUTOMATIC) → [OPTIONAL: turboshovel.json Gates] → Action
                 ↓                                        ↓
          .claude/context/                         Quality checks
          (zero config!)                           Custom commands
                                                   (requires turboshovel.json)
```

1. **Context Injection** (AUTOMATIC): Always runs first, discovers `.claude/context/{name}-{stage}.md` files
2. **Gate Execution** (OPTIONAL): If `turboshovel.json` configured, runs quality checks/custom commands
3. **Action Handling**: CONTINUE, BLOCK, STOP, or chain to another gate

**Context injection works standalone - turboshovel.json is only for optional quality enforcement.**

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for detailed system design.

## Supported Events

Turboshovel handles **15 events**: 10 real Claude Code hooks + 5 synthetic events.

### Real Claude Code Events (10)

These are fired directly by Claude Code:

| Event | Context Pattern | Context Injection | Notes |
|-------|----------------|-------------------|-------|
| `SessionStart` | `session-start.md` | ✅ Supported | Plugin provides environment context |
| `SessionEnd` | `session-end.md` | ✅ Supported | - |
| `UserPromptSubmit` | `prompt-submit.md` | ✅ Supported | Also triggers SlashCommandStart |
| `SubagentStop` | `{agent}-end.md` | ✅ Supported | - |
| `PreToolUse` | `{tool}-pre.md` | ✅ Supported | Also triggers SkillStart |
| `PostToolUse` | `{tool}-post.md` | ✅ Supported | Also triggers SkillEnd, SubagentStart |
| `Stop` | `agent-stop.md` | ✅ Supported | Also triggers SlashCommandEnd |
| `Notification` | `notification-receive.md` | ✅ Supported | - |
| `PreCompact` | `pre-compact.md` | ❌ Not implemented | Gates only |
| `PermissionRequest` | `permission-request.md` | ❌ Not implemented | Gates only |

### Synthetic Events (5)

These are derived from real events and run through the full dispatch pipeline (session state, context injection, gates):

| Synthetic Event | Triggered By | Context Pattern | Session State |
|-----------------|--------------|-----------------|---------------|
| `SkillStart` | PreToolUse with `tool_name='Skill'` | `{skill}-start.md` | Sets `active_skill` |
| `SkillEnd` | PostToolUse with `tool_name='Skill'` | `{skill}-end.md` | Clears `active_skill` |
| `SlashCommandStart` | UserPromptSubmit with `/command` | `{command}-start.md` | Sets `active_command` |
| `SlashCommandEnd` | Stop (if active_command set) | `{command}-end.md` | Clears `active_command` |
| `SubagentStart` | PostToolUse with `tool_name='Step'` | `{agent}-start.md` | Stores correlation mapping |

**Key points:**
- Synthetic events are first-class citizens with full context injection and gate support
- Namespaces are preserved in session state (e.g., `cipherpowers:verify`)
- Context files use short names without namespace (e.g., `verify-start.md`)
- SlashCommandEnd only fires if a command was active (prevents spurious events)

### Event Detection Flow

```
Claude Code Event
    │
    ├─→ dispatch(realEvent)
    │       ├─→ updateSessionState
    │       ├─→ injectContext
    │       ├─→ run gates
    │       │
    │       └─→ detectSyntheticEvents()
    │               │
    │               └─→ For each synthetic:
    │                       └─→ dispatch(syntheticEvent)  ← recursive
    │                               ├─→ updateSessionState
    │                               ├─→ injectContext
    │                               └─→ run gates
```

### Example: Skill Context Injection

```bash
# Create context file for verify skill
mkdir -p .claude/context
cat > .claude/context/verify-start.md << 'EOF'
## Verification Guidelines
- Check for false positives
- Cross-reference findings
- Report confidence levels
EOF

# When /cipherpowers:verify runs, context auto-injects!
```

The context file uses the short name `verify` (namespace stripped for file discovery).

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

Context files are discovered from **project context** (`.claude/context/`) directory.

Create context files in your project's `.claude/context/` directory following the naming convention.

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
| `SessionEnd` | `session-end.md` | Session ends |
| `UserPromptSubmit` | `prompt-submit.md` | User sends message |
| `SubagentStart` | `{agent}-start.md` | `rust-agent-start.md` |
| `SubagentStop` | `{agent}-end.md` | `rust-agent-end.md` |
| `PreToolUse` | `{tool}-pre.md` | `edit-pre.md` |
| `PostToolUse` | `{tool}-post.md` | `edit-post.md` |
| `Stop` | `agent-stop.md` | Agent stops |
| `Notification` | `notification-receive.md` | Notification received |
| `PreCompact` | `pre-compact.md` | Before context compaction |
| `PermissionRequest` | `permission-request.md` | Permission dialog |

See **[CONVENTIONS.md](CONVENTIONS.md)** for full documentation.

## Gate Configuration (Optional)

**Most users only need context files.** Gates are for optional quality enforcement and custom commands.

Gates are defined in `turboshovel.json` and can be:

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

See **[TYPESCRIPT.md](TYPESCRIPT.md)** for creating TypeScript gates.

### Default Shell Gates

The plugin provides placeholder shell gates that you can override with your project's actual commands:

| Gate | Description | Keywords | Default Command |
|------|-------------|----------|-----------------|
| `check` | Quality checks (lint, format, types) | lint, check, format, quality, clippy, typecheck | Placeholder (configure) |
| `test` | Run test suite | test, testing, spec, verify | Placeholder (configure) |
| `build` | Build project | build, compile, package | Placeholder (configure) |

**To configure:** Override in your `.claude/turboshovel.json`:

```json
{
  "gates": {
    "check": { "command": "npm run lint && npm run typecheck" },
    "test": { "command": "npm test" },
    "build": { "command": "npm run build" }
  }
}
```

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
plugin/core/turboshovel.json     (defaults)
        ↓ merged with
.claude/turboshovel.json          (project overrides)
        ↓
Merged Configuration        (project takes precedence)
```

**Plugin provides defaults. Projects override what they need.**

## Multi-Plugin Best Practices

When using turboshovel alongside other Claude Code plugins:

**✅ DO:**
- Enable plugins in `.claude/settings.local.json` using `enabledPlugins`
- Let Claude Code handle `${CLAUDE_PLUGIN_ROOT}` automatically per-plugin
- Reference cross-plugin gates using the `plugin` field in turboshovel.json

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

See **[SETUP.md](#hooks-not-running-in-multi-plugin-projects)** for troubleshooting multi-plugin issues.

## Debugging

Logs are written to `$TMPDIR/turboshovel/hooks-YYYY-MM-DD.log`:

```bash
# Find and view the log file (works anywhere)
ls $TMPDIR/turboshovel/hooks-*.log
tail -f $TMPDIR/turboshovel/hooks-$(date +%Y-%m-%d).log

# Alternative: Use the CLI to get log path (only works during hook execution)
# tail -f $(node ${CLAUDE_PLUGIN_ROOT}/core/hooks-app/dist/cli.js log-path)
```

**What gets logged:**
- Hook event received
- Config files loaded
- Context files discovered
- Gates executed
- Actions taken

## N-Verification

Dispatch N independent agents to review, collate by consensus, cross-check exclusive findings.

### Usage

```bash
/turboshovel:verify                    # Default: 2 agents
/turboshovel:verify --count 3          # Use 3 agents
/turboshovel:verify --agents "Explore,Plan"  # Specify agents
```

### Phases

1. **Dispatch** - N agents review independently in parallel
2. **Collate** - Compare findings:
   - Common (N/N): All agree → implement immediately
   - Exclusive (<N/N): Some found → pending cross-check
3. **Cross-check** - Validate all exclusive findings
4. **Present** - Summary with confidence levels

### Output

Files saved to `.work/`:
- `{date}-verify-{index}-{time}.md` - Individual reviews
- `{date}-verify-collated-{time}.md` - Collation report
- `{date}-verify-crosscheck-{time}.md` - Cross-check results

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design and data flow
- **[CONVENTIONS.md](CONVENTIONS.md)** - Context file naming conventions
- **[SETUP.md](SETUP.md)** - Detailed configuration guide
- **[TYPESCRIPT.md](TYPESCRIPT.md)** - Creating TypeScript gates
- **[INTEGRATION_TESTS.md](INTEGRATION_TESTS.md)** - Testing procedures

## Workflow System

Turboshovel includes an executable workflow system that makes skills enforceable. Workflows provide structured, repeatable processes with state tracking, conditional logic, and task management.

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

**Example flow:**
```
1. Human: tsv start my-workflow.md
2. Workflow: Sets state to Step 1, injects prompt into conversation
3. Claude: Reads prompt, executes step using tools (Step, Bash, Edit, etc.)
4. Claude: Determines outcome (PASS/FAIL based on results)
5. Claude: Runs `tsv pass` or `tsv goto N` (to jump to step N)
6. Repeat until DONE
```

**Key insight:** A workflow is essentially a **skill with persistent state + CLI control**. The step text is guidance for Claude, just like skill instructions.

### Workflow CLI Setup

The workflow CLI is available via npm:

```bash
# Install globally (recommended)
npm install -g @turboshovel/cli

# Verify installation
tsv --help
# Should show available commands

# After installing, use the simple command:
tsv start my-workflow.md
tsv status
tsv pass
```

**For development (without npm install):**

```bash
# Clone and build
cd turboshovel/packages/cli
npm install
npm run build
npm link

# Or direct invocation
node packages/cli/dist/cli.js <command>
```

**Troubleshooting:** If `tsv` command not found after install:
1. Ensure npm's global bin directory is in your PATH: `npm config get prefix`
2. On macOS/Linux, add `$(npm config get prefix)/bin` to your PATH

### Workflow Commands

```bash
# Start a workflow
tsv start my-workflow.md

# Check status
tsv status

# Mark step as passed (advance to next step)
tsv pass

# Jump to specific step
tsv goto 3

# List all workflows
tsv list

# Stop workflow
tsv stop
```

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
- One code block per task (multiple blocks rejected)
- Combine multiple commands with `&&` or `;`
- No code block means task is prompt-only

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

**Example patterns:**

```markdown
## 3. Execute batch

**Prompt:** Execute next 3 steps from plan.

After batch completes, check remaining work:
- If more batches needed → `tsv goto 2` (review + loop)
- If all steps complete → `tsv pass` (continue to finalization)

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
| `RETRY` | `FAIL: RETRY` | Retry current task (default: 1 attempt, then STOP) |
| `RETRY` with max | `FAIL: RETRY 3` | Retry up to 3 times before STOP |
| `RETRY` with action | `FAIL: RETRY 3 GOTO 2` | Retry up to 3 times, then GOTO 2 |
| `RETRY` with message | `FAIL: RETRY "error msg"` | Retry once, then STOP with message |

**Action validation:**
- GOTO targets must exist (validated at parse time)
- GOTO self creates infinite loop (rejected)
- Task numbers 1-indexed (not zero-based)

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

If more batches needed → `tsv goto 3`
If all tasks complete → `tsv pass`

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

#### Active Workflow Tracking

The active workflow ID is stored in `.claude/turboshovel/session.json`. This survives context clears and session restarts.

**Note on dual session architecture:** The plugin maintains two separate session mechanisms:
- **Hook session** (`.claude/session/state.json`) - Tracks hook execution state, modified files, and gate results within a Claude Code session
- **Workflow session** (`.claude/turboshovel/session.json`) - Tracks active workflow and persists across sessions

See ARCHITECTURE.md for detailed session architecture.

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
- Agent logic during task execution
- Manual updates via CLI (future)

#### Task Tracking

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

### CLI Commands

#### `tsv start <file>`

Start a new workflow from a markdown file.

```bash
# Start from relative path
tsv start my-workflow.md

# Start from absolute path
tsv start /path/to/workflow.md

# Start from examples
tsv start examples/implementation.workflow.md
```

**Behavior:**
- Parses workflow markdown
- Validates syntax (numbering, GOTO targets)
- Creates state file
- Sets as active workflow
- Displays Step 1 guidance

#### `tsv pass`

Mark current step as passed (evaluates PASS condition).

```bash
tsv pass
```

**Behavior:**
- Loads active workflow
- Evaluates PASS condition (typically CONTINUE to next step)
- Resets retry count
- Displays next step guidance
- Auto-completes if workflow done

#### `tsv fail`

Mark current step as failed (evaluates FAIL condition).

```bash
tsv fail
```

**Behavior:**
- Loads active workflow
- Evaluates FAIL condition (e.g., RETRY, STOP, GOTO)
- Increments retry count if applicable
- Takes appropriate action based on FAIL condition
- May stop or jump to different step

#### `tsv goto <n>`

Jump to a specific step (for GOTO actions).

```bash
tsv goto 3
```

**Use cases:**
- GOTO action execution
- Manual navigation for debugging
- Skipping optional steps

**Argument:**
- `<n>` is the step number to jump to
- `--step <id>` specifies which parallel substep (e.g., 3.1, 3.2) when multiple steps run concurrently

#### `tsv status`

Show current workflow state.

```bash
tsv status
```

**Output:**
```
Workflow: my-workflow.md
ID: wf-2025-01-15-abc123
Step 3: Execute batch
Retry: 0/3
Variables: {
  "more_batches": true
}
```

#### `tsv stop`

Abort the current workflow.

```bash
tsv stop
```

**Behavior:**
- Deletes workflow state file
- Clears active workflow
- Cannot be undone

#### `tsv list`

List all workflows (active and inactive).

```bash
tsv list
```

**Output:**
```
wf-2025-01-15-abc123 (active): my-workflow.md - Step 3
wf-2025-01-14-def456: implementation.workflow.md - Step 2
```

### Writing Workflows for Agents

#### Agent Interpretation

Agents should:
1. **Read task description** - Understand the goal
2. **Execute command** (if present) - Run bash block
3. **Follow prompt** (if present) - Agent-driven task
4. **Evaluate outcome** - Determine PASS/FAIL
5. **Apply action** - CONTINUE, STOP, GOTO, etc.

#### Variable Usage

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

**Prompt:** Check if blocking issues were found.

If blocking issues → `tsv stop "BLOCKING issues found"`
If no blocking issues → `tsv next`

- PASS: CONTINUE

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

If more batches needed → `tsv goto 3`
If all tasks complete → `tsv pass`

- PASS: CONTINUE

## 7. Complete

**Prompt:** Verify tests pass. Present completion options.

- PASS: DONE
- FAIL: STOP "Tests failing. Fix before completing."
```

### Best Practices

#### When to Use Workflows vs Gates

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

#### Workflow Composition Patterns

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

#### Error Recovery with RETRY

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

\`\`\`bash
npm run test:integration
\`\`\`

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

#### Agent-Controlled Loops

**Safe loop pattern** (agent evaluates condition):

```markdown
## 1. Process item

**Prompt:** Process next item from queue.

- PASS: CONTINUE
- FAIL: RETRY 3

## 2. Check queue

**Prompt:** Check if queue has more items.

If queue not empty → `tsv goto 1`
If queue empty → `tsv pass`

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

If more batches remain → `tsv goto 2`
If complete → `tsv pass`

- PASS: CONTINUE

## 5. Complete

**Prompt:** All batches complete.

- PASS: DONE
```

**Advantages gained:**
- State survives context clears
- Retry logic built-in
- Progress visible via `tsv status`
- Can resume after interruption

#### Workflow Hooks Integration

Workflows automatically integrate with hook system:

**SubagentStop hook:**
- Detects step completion
- Updates step status
- Sets variables (`has_blocked_task`)
- Suggests `tsv next`

**SessionStart hook:**
- Auto-injects active workflow context
- Shows current step and progress
- Displays variables and substeps

**No configuration needed** - works automatically when workflow is active.

### Examples

Full workflow examples in `examples/`:

- **`implementation.workflow.md`** - Task implementation with quality gates (5 steps)
- **`build-and-deploy.workflow.md`** - Build and deployment pipeline

See these files for complete, production-ready workflow patterns.

## Development

For contributors working on turboshovel itself:

```bash
# Clone the repository
git clone https://github.com/tobyhede/turboshovel.git
cd turboshovel

# Build the plugin core
cd plugin/core
npm install
npm run build

# Run tests
npm test

# Link CLI for local development
cd ../../packages/cli
npm install
npm run build
npm link
```

After linking, the `tsv` and `turboshovel` commands are available globally.

## Examples

See `examples/` for ready-to-use configurations:

- `strict.json` - Block on all failures
- `permissive.json` - Warn only
- `pipeline.json` - Gate chaining
- `context/` - Example context files
- `implementation.workflow.md` - Implementation workflow with quality gates
