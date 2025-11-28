# Tool Use Context

This context can auto-inject after tool usage (PostToolUse hook).

## Quality Enforcement

PostToolUse is commonly used to enforce quality checks after file modifications:

```json
{
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["check"]
    }
  }
}
```

## Tool Filtering

Use `enabled_tools` to target specific tools:
- `Edit` - File editing operations
- `Write` - File writing operations
- `Read` - File reading operations
- `Bash` - Shell command execution

## Usage

Override this file in your project by creating `.claude/context/tool-use.md` or use tool-specific patterns like `.claude/context/Edit-post.md`.
