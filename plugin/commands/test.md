# Turboshovel Plugin Test

Interactive test command for verifying plugin integration and gate configuration.

## Instructions

Run these diagnostic steps to verify the Turboshovel plugin is working correctly:

### 1. Check Plugin Status

First, verify the plugin loaded without errors:
- Run `/plugin` and check for any turboshovel errors in "Installation Errors"
- If errors exist, check `~/.claude/debug/latest` for details

### 2. Check Logging

Check if logging is enabled and view recent log entries:

```bash
# Show log file path
mise run logs:path

# Or directly:
node plugin/hooks/hooks-app/dist/cli.js log-path
```

If no logs exist, enable logging:
```bash
export TURBOSHOVEL_LOG=1
```

Then tail the logs in a separate terminal:
```bash
mise run logs
# or: mise run logs:pretty
```

### 3. Test Hook Invocation

To verify hooks are firing, perform these actions and watch the logs:

**Test PostToolUse hook:**
- Edit any file (triggers PostToolUse)
- Check logs for `HOOK_INVOKED` with `hook_event_name: "PostToolUse"`

**Test UserPromptSubmit hook:**
- Submit any prompt (this one counts!)
- Check logs for `hook_event_name: "UserPromptSubmit"`

### 4. Check Gates Configuration

Verify gates.json exists and is valid:

```bash
# Check project gates
cat .claude/gates.json 2>/dev/null || echo "No project gates.json"

# Check plugin default gates
cat plugin/hooks/gates.json 2>/dev/null || echo "No plugin gates.json"
```

### 5. Test a Gate Manually

Test the CLI directly with simulated hook input:

```bash
# Test SessionStart (should return context injection)
echo '{"hook_event_name":"SessionStart","cwd":"'$(pwd)'"}' | \
  TURBOSHOVEL_LOG=1 node plugin/hooks/hooks-app/dist/cli.js

# Test PostToolUse with Edit tool
echo '{"hook_event_name":"PostToolUse","tool_name":"Edit","cwd":"'$(pwd)'"}' | \
  TURBOSHOVEL_LOG=1 node plugin/hooks/hooks-app/dist/cli.js

# Test UserPromptSubmit with keyword matching
echo '{"hook_event_name":"UserPromptSubmit","user_message":"please run lint","cwd":"'$(pwd)'"}' | \
  TURBOSHOVEL_LOG=1 node plugin/hooks/hooks-app/dist/cli.js
```

### 6. Session State

Check current session state:

```bash
node plugin/hooks/hooks-app/dist/cli.js session get edited_files .
node plugin/hooks/hooks-app/dist/cli.js session get file_extensions .
```

Clear session state:
```bash
node plugin/hooks/hooks-app/dist/cli.js session clear .
```

## Expected Results

When working correctly, you should see:

1. **SessionStart**: Returns `additionalContext` with Turboshovel welcome message
2. **PostToolUse (Edit)**: May trigger gates based on your `gates.json` configuration
3. **UserPromptSubmit**: May inject context or trigger keyword-matched gates
4. **Logs**: Show `HOOK_INVOKED` entries for each hook event

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No log entries | Logging disabled | `export TURBOSHOVEL_LOG=1` |
| Plugin errors on load | Invalid hooks.json | Check for unsupported hook types |
| Gates not firing | No gates.json | Create `.claude/gates.json` |
| Wrong cwd in logs | Plugin path issue | Check `CLAUDE_PLUGIN_ROOT` resolution |

## Arguments

$ARGUMENTS

If arguments provided, interpret as specific test to run:
- `hooks` - Focus on hook invocation testing
- `gates` - Focus on gate configuration testing
- `logs` - Focus on logging setup
- `session` - Focus on session state testing
