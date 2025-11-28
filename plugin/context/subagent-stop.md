# Subagent Completion Context

This context can auto-inject when subagents complete (SubagentStop hook).

## Agent Filtering

Use `enabled_agents` to target specific agents that modify code:

```json
{
  "hooks": {
    "SubagentStop": {
      "enabled_agents": ["rust-agent", "code-agent"],
      "gates": ["check", "test"]
    }
  }
}
```

**Important:** Exclude verification-only agents to avoid false positive gate failures.

## Agent-Command Scoping

Create agent-specific context using the pattern:
- `.claude/context/{agent}-end.md` - Any command using this agent
- `.claude/context/{agent}-{command}-end.md` - Specific agent+command combination

Examples:
- `.claude/context/rust-agent-end.md`
- `.claude/context/code-agent-execute-end.md`

## Usage

Override this file in your project by creating `.claude/context/subagent-stop.md` or agent-specific variants.
