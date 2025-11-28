# Turboshovel Plugin Environment

This context auto-injects at the beginning of each Claude Code session.

## Plugin Root

**CLAUDE_PLUGIN_ROOT:** Path to the Turboshovel plugin installation

Use this variable when referencing plugin files:

```markdown
@${CLAUDE_PLUGIN_ROOT}/hooks/examples/context/session-start.md
@${CLAUDE_PLUGIN_ROOT}/hooks/README.md
```

## Hook System Features

- **Context Injection**: Auto-inject `.claude/context/{name}-{stage}.md` files
- **Quality Gates**: Optional enforcement of check, test, build commands
- **Keyword Triggers**: Gates can fire based on conversation keywords (UserPromptSubmit only)
- **Session State**: State persists across hook invocations

## Configuration

Create `.claude/gates.json` for quality enforcement:

```json
{
  "gates": {
    "check": {"command": "npm run lint", "on_fail": "BLOCK"}
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["check"]
    }
  }
}
```

See [plugin/hooks/README.md](${CLAUDE_PLUGIN_ROOT}/hooks/README.md) for full documentation.
