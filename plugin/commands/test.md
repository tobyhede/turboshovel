# Turboshovel Plugin Test

If you're reading this, the plugin is working. This command triggered the `SessionStart` hook.

## Verify in Logs

Check the turboshovel log to confirm:

```bash
# Tail logs (in a separate terminal)
mise run logs
# or: tail -f ~/.turboshovel/turboshovel.log
```

You should see a `SessionStart` entry from when this session started.

## Quick Checks

| Check | How |
|-------|-----|
| Plugin loaded | Run `/plugin` - no turboshovel errors |
| Hooks firing | Check logs for `HOOK_INVOKED` entries |
| Gates config | `cat .claude/gates.json` |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Plugin errors | Check `~/.claude/debug/latest` |
| No log entries | Ensure `TURBOSHOVEL_LOG` is not set to `0` |
| Gates not firing | Create `.claude/gates.json` |
