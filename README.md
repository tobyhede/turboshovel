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

### Usage

The workflow CLI is available via npm:

```bash
npm install -g @turboshovel/cli

# Start a workflow
tsv start my-workflow.md
```

**For complete documentation on Workflow syntax, orchestration, and CLI commands, see [packages/cli/README.md](packages/cli/README.md).**

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
