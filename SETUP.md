# Quality Hooks Setup

## Simple Setup (Context Files Only)

**For most projects, context files are all you need.**

Context injection is AUTOMATIC - no configuration files required. Just create `.claude/context/` directory and add markdown files following the naming pattern.

### Quick Setup

```bash
# 1. Create context directory
mkdir -p .claude/context

# 2. Add context files for your commands/skills
# For /code-review command
cat > .claude/context/code-review-start.md << 'EOF'
## Security Requirements
- Authentication on all endpoints
- Input validation
- No secrets in logs
EOF

# For test-driven-development skill
cat > .claude/context/test-driven-development-start.md << 'EOF'
## TDD Standards
- Write failing test first
- Implement minimal code to pass
- Refactor with tests passing
EOF

# For session start
cat > .claude/context/session-start.md << 'EOF'
## Project Context
- TypeScript project using Vitest
- Follow functional programming style
- Use strict type checking
EOF
```

### That's It!

Context files auto-inject when commands/skills run. **No gates.json needed.**

**Need quality gates or custom commands?** Continue to "Advanced Setup" below.

---

## Advanced Setup (gates.json Configuration)

**Only needed for quality enforcement (lint, test, build checks) or custom commands.**

Quality hooks support optional **project-level** `gates.json` configuration for running quality checks.

### gates.json Search Priority

The hooks search for `gates.json` and use **only the first match found**:

1. **`.claude/gates.json`** - Project-specific configuration (recommended)
2. **`gates.json`** - Project root configuration
3. **`${CLAUDE_PLUGIN_ROOT}/gates.json`** - Plugin default (fallback)

**Note:** If `.claude/gates.json` exists, `gates.json` in project root is NOT loaded. The plugin default is always merged as a base, with the first project config found as overrides.

### Quick gates.json Setup

### Option 1: Recommended (.claude/gates.json)

```bash
# Create .claude directory
mkdir -p .claude

# Copy example configuration
cp examples/strict.json .claude/gates.json

# Customize for your project
vim .claude/gates.json
```

### Option 2: Project Root (gates.json)

```bash
# Copy example configuration
cp examples/strict.json gates.json

# Customize for your project
vim gates.json
```

## Customizing Gates

Edit your project's `gates.json` to match your build tooling:

```json
{
  "gates": {
    "check": {
      "description": "Run quality checks",
      "command": "npm run lint",  // ← Change to your command
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "test": {
      "description": "Run tests",
      "keywords": ["test", "testing"],  // ← Optional: only for UserPromptSubmit
      "command": "npm test",  // ← Change to your command
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["check"]
    },
    "SubagentStop": {
      "enabled_agents": ["rust-agent"],
      "gates": ["check", "test"]
    }
  }
}
```

**Gate Configuration Notes:**
- **keywords**: Optional array of trigger words. Only applies to `UserPromptSubmit` hook - ignored for other hooks. Gates with keywords only run when user message contains matching terms.
- **command**: Shell command to execute. Mutually exclusive with `plugin`/`gate` fields (use one or the other, not both).

### File Pattern Filtering

Gates can be configured to run only for specific files or directories using the `file_patterns` field. This is especially useful for monorepo projects where different packages have different tasks.

**Configuration:**

```json
{
  "gates": {
    "backend:test": {
      "description": "Run backend tests",
      "command": "npm run test:backend",
      "file_patterns": ["packages/backend/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "frontend:lint": {
      "description": "Lint frontend code",
      "command": "npm run lint:frontend",
      "file_patterns": ["packages/frontend/**", "shared/ui/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["backend:test", "frontend:lint"]
    }
  }
}
```

**Pattern Syntax:**

File patterns use glob syntax (similar to `.gitignore`, but with some differences):

- `**` - Matches zero or more directories (e.g., `src/**/*.ts` matches both `src/file.ts` and `src/nested/deep/file.ts`)
- `*` - Matches any characters except `/`
- `?` - Matches a single character
- `[abc]` - Matches any character in brackets

**Pattern Examples:**

| Pattern | Matches | Doesn't Match |
|---------|---------|---------------|
| `packages/cts/**` | `packages/cts/src/index.ts`<br>`packages/cts/lib/utils.ts` | `packages/shared/index.ts`<br>`src/index.ts` |
| `src/**/*.ts` | `src/index.ts`<br>`src/lib/utils.ts` | `src/index.js`<br>`tests/index.ts` |
| `*.json` | `package.json`<br>`tsconfig.json` | `src/config.json`<br>`lib/data.json` |
| `.config/**` | `.config/settings.json`<br>`.config/app/theme.json` | `config/settings.json` |
| `lib/*/index.ts` | `lib/utils/index.ts`<br>`lib/core/index.ts` | `lib/index.ts`<br>`lib/utils/helper.ts` |

**Behavior:**

- **Multiple patterns:** OR logic - gate runs if file matches ANY pattern
- **No patterns:** Gate always runs (backwards compatible)
- **Path matching:** Patterns are matched against relative paths from project root
- **Hook scope:** Only applies to `PostToolUse` hook (which has `file_path`)
- **Dotfiles:** Patterns can match dotfiles (e.g., `.config/**`)

**Monorepo Example:**

For a monorepo with separate test suites per package:

```json
{
  "gates": {
    "cts:test": {
      "description": "Run CTS tests",
      "command": "npm run test:cts",
      "file_patterns": ["packages/cts/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "api:test": {
      "description": "Run API tests",
      "command": "npm run test:api",
      "file_patterns": ["packages/api/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "shared:test": {
      "description": "Run shared tests",
      "command": "npm run test:shared",
      "file_patterns": ["packages/shared/**"],
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["cts:test", "api:test", "shared:test"]
    }
  }
}
```

When you edit `packages/cts/src/index.ts`, only the `cts:test` gate runs.
When you edit `packages/shared/utils.ts`, only the `shared:test` gate runs.

**Pattern Library:**

Patterns use the [minimatch library](https://www.npmjs.com/package/minimatch) (same as npm/glob). Supports advanced features:
- Brace expansion: `{a,b,c}` matches any of a, b, or c
- Extglob patterns: `@(pattern)`, `!(pattern)`, etc.
- See minimatch docs for full syntax reference

**Performance Considerations:**

Pattern matching uses O(n*m) complexity where n=number of patterns, m=pattern complexity. For large monorepos:
- Use early-exit optimization (patterns checked in order, stops at first match)
- Consider consolidating gates if you have >100 patterns across all gates that run on a single PostToolUse event
- Keep patterns simple where possible

**Debugging:**

Enable debug logging to see which patterns are matching:

```bash
TURBOSHOVEL_LOG_LEVEL=debug npx claude-code
```

Debug logs will show:
- Which gate was evaluated
- File path (absolute and relative)
- Pattern that matched
- Whether gate was skipped

### Common Command Patterns

**Node.js/TypeScript:**
```json
{
  "gates": {
    "check": {"command": "npm run lint"},
    "test": {"command": "npm test"},
    "build": {"command": "npm run build"}
  }
}
```

**Rust:**
```json
{
  "gates": {
    "check": {"command": "cargo clippy"},
    "test": {"command": "cargo test"},
    "build": {"command": "cargo build"}
  }
}
```

**Python:**
```json
{
  "gates": {
    "check": {"command": "ruff check ."},
    "test": {"command": "pytest"},
    "build": {"command": "python -m build"}
  }
}
```

**mise tasks:**
```json
{
  "gates": {
    "check": {"command": "mise run check"},
    "test": {"command": "mise run test"},
    "build": {"command": "mise run build"}
  }
}
```

**Make:**
```json
{
  "gates": {
    "check": {"command": "make lint"},
    "test": {"command": "make test"},
    "build": {"command": "make build"}
  }
}
```

## Example Configurations

The plugin provides three example configurations:

### Strict Mode (Block on Failures)
```bash
cp examples/strict.json .claude/gates.json
```

Best for: Production code, established projects

### Permissive Mode (Warn Only)
```bash
cp examples/permissive.json .claude/gates.json
```

Best for: Prototyping, learning, experimental work

### Pipeline Mode (Chained Gates)
```bash
cp examples/pipeline.json .claude/gates.json
```

Best for: Complex workflows, auto-formatting before checks

## Enabling/Disabling Hooks

### Disable Quality Hooks Entirely

Remove or rename your project's `gates.json`:

```bash
mv .claude/gates.json .claude/gates.json.disabled
```

### Disable Specific Hooks

Edit `gates.json` to remove hooks:

```json
{
  "hooks": {
    "PostToolUse": {
      "enabled_tools": [],  // ← Empty = disabled
      "gates": []
    },
    "SubagentStop": {
      "enabled_agents": ["rust-agent"],  // ← Keep enabled
      "gates": ["check", "test"]
    }
  }
}
```

### Disable Specific Tools/Agents

Remove from enabled lists:

```json
{
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit"],  // ← Removed "Write"
      "gates": ["check"]
    }
  }
}
```

## Testing Your Configuration

```bash
# Verify JSON is valid
jq . .claude/gates.json

# Test with mock hook input via TypeScript CLI
export CLAUDE_PLUGIN_ROOT=/path/to/plugin
echo '{"hook_event_name": "PostToolUse", "tool_name": "Edit", "cwd": "'$(pwd)'"}' | \
  node ${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js

# View logs for debugging
tail -f $TMPDIR/turboshovel/hooks-$(date +%Y-%m-%d).log
```

## Version Control

### Recommended: Commit gates.json

```bash
git add .claude/gates.json
git commit -m "chore: configure quality gates"
```

This ensures all team members use the same quality standards.

### Optional: Per-Developer Override

Developers can override with local configuration:

```bash
# Team config
.claude/gates.json  ← committed

# Personal override (gitignored)
gates.json  ← takes priority, not committed
```

Add to `.gitignore`:
```
/gates.json
```

## Troubleshooting

### Hooks Not Running

1. Check configuration exists:
   ```bash
   ls -la .claude/gates.json
   ```

2. Verify plugin root is set:
   ```bash
   echo $CLAUDE_PLUGIN_ROOT
   ```

3. Check tool/agent is enabled:
   ```bash
   jq '.hooks.PostToolUse.enabled_tools' .claude/gates.json
   ```

### Hooks Not Running in Multi-Plugin Projects

**Symptom:** Hooks don't execute when multiple plugins are installed.

**Cause:** Project-level `CLAUDE_PLUGIN_ROOT` environment variable override in `.claude/settings.local.json`.

**Example of problematic configuration:**
```json
{
  "env": {
    "CLAUDE_PLUGIN_ROOT": "/Users/username/src/some-plugin"
  },
  "enabledPlugins": {
    "plugin-a": true,
    "plugin-b": true
  }
}
```

**Solution:** Remove `env.CLAUDE_PLUGIN_ROOT` from `.claude/settings.local.json`. Claude Code sets this automatically per-plugin during hook execution.

**Why:** Setting `CLAUDE_PLUGIN_ROOT` at the project level overrides Claude Code's automatic per-plugin path resolution. Each plugin needs its own path when hooks execute, but the project-level override forces all plugins to use the same path, breaking any plugin that doesn't match the hardcoded path.

**Correct configuration:**
```json
{
  "enabledPlugins": {
    "plugin-a": true,
    "plugin-b": true
  }
}
```

Let Claude Code handle `${CLAUDE_PLUGIN_ROOT}` dynamically - it will set the correct path for each plugin automatically.

### Gate Fails for Verification-Only Agents

**Symptom:** SubagentStop gates fail for agents that only read files (technical-writer in verification mode, research-agent).

**Cause:** Missing `enabled_agents` filter - gates run for ALL agents.

**Solution:** Add `enabled_agents` to only include code-modifying agents:

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

**Why:** Verification agents don't modify code, so check/test gates are unnecessary and produce false positive failures.

### Commands Failing

1. Test command manually:
   ```bash
   npm run lint  # or whatever your check command is
   ```

2. Check command exists:
   ```bash
   which npm
   ```

3. Verify working directory:
   - Commands run from project root (where gates.json lives)
   - Use absolute paths if needed

### JSON Syntax Errors

```bash
# Validate JSON
jq . .claude/gates.json

# Common errors:
# - Missing commas between items
# - Trailing commas in arrays/objects
# - Unescaped quotes in strings
```

## Plugin Gate References

You can reference gates defined in other plugins to reuse quality checks across projects.

### Configuration

Use the `plugin` and `gate` fields to reference external gates:

```json
{
  "gates": {
    "plan-compliance": {
      "plugin": "cipherpowers",
      "gate": "plan-compliance",
      "description": "Verify implementation matches plan"
    },
    "check": {
      "command": "npm run lint",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "SubagentStop": {
      "gates": ["plan-compliance", "check"]
    }
  }
}
```

### How Plugin Gates Work

**Plugin Discovery:**
- The `plugin` field uses **sibling convention**
- Assumes plugins are installed in the same parent directory
- Example: If your plugin is in `~/.claude/plugins/turboshovel/`, it looks for `~/.claude/plugins/cipherpowers/`

**Execution Context:**
- Plugin gate commands run in the **plugin's directory**
- This allows plugin gates to access their own tools and configurations
- Your project's working directory is still available via environment variables

**Required Fields:**
- `plugin`: Name of the plugin containing the gate
- `gate`: Name of the gate defined in the plugin's `gates.json`

**Optional Fields:**
- `description`: Override the plugin's gate description
- Other gate fields (like `on_pass`, `on_fail`) use the plugin's defaults

### Mixing Local and Plugin Gates

You can combine local gates (with `command` field) and plugin gates (with `plugin` field) in the same configuration:

```json
{
  "gates": {
    "plan-compliance": {
      "plugin": "cipherpowers",
      "gate": "plan-compliance"
    },
    "code-review": {
      "plugin": "cipherpowers",
      "gate": "code-review"
    },
    "check": {
      "command": "npm run lint"
    },
    "test": {
      "command": "npm test"
    }
  },
  "hooks": {
    "SubagentStop": {
      "gates": ["plan-compliance", "check", "test"]
    },
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["check"]
    }
  }
}
```

### Troubleshooting Plugin Gates

**Plugin not found:**
- Verify plugin is installed in sibling directory
- Check plugin name matches directory name
- Example: `"plugin": "cipherpowers"` requires `../cipherpowers/` directory

**Gate not found in plugin:**
- Verify gate name matches plugin's `gates.json`
- Check plugin's `gates.json` for available gates
- Gate names are case-sensitive

**Plugin gate fails:**
- Plugin gates run in plugin's directory context
- Check plugin's own configuration and dependencies
- Review logs for plugin-specific error messages

## Migration from Plugin Default

If you were using the plugin's default `gates.json`, migrate to project-level:

```bash
# Copy current config
cp examples/strict.json .claude/gates.json

# Customize for this project
vim .claude/gates.json
```

The plugin default now serves as a fallback template only.
