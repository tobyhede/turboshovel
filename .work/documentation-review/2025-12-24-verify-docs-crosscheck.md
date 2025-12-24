# Cross-Check Report - Exclusive Issues Validation

## Metadata
- **Date:** 2025-12-24
- **Type:** Cross-check validation of exclusive issues
- **Source:** `.work/documentation-review/2025-12-24-verify-docs-collated.md`
- **Validator:** Cross-check agent

## Summary

| Exclusive Issues | VALIDATED | INVALIDATED | UNCERTAIN |
|------------------|-----------|-------------|-----------|
| Agent A (6)      | 5         | 1           | 0         |
| Agent B (3)      | 3         | 0           | 0         |
| **Total (9)**    | **8**     | **1**       | **0**     |

---

## Agent A Exclusive Issues

### Issue 1: Workflow CLI --step vs --task Flag (BLOCKING)

**Issue:** README.md:811-823 documents `workflow next --task N` for jumping but workflow-cli.ts:121-123 implements `--step <n>`. The `--task` flag is used for parallel task identification, not jumping.

**Source:** Agent A

**Validation:** VALIDATED

**Evidence:**
From `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli/workflow-cli.ts` lines 119-126:
```typescript
program
  .command('next')
  .description('Advance to the next step or mark task complete')
  .option('--step <n>', 'Jump to specific step (for GOTO)')
  .option('--pass', 'Mark task as passed')
  .option('--fail', 'Mark task as failed/blocked')
  .option('--task <taskId>', 'Specify which task (for parallel tasks)')
```

From README.md line 449 and 811-816:
```markdown
# Jump to specific task
workflow next --task 3
```

The implementation uses `--step <n>` for jumping to a specific step, while `--task <taskId>` is for specifying parallel task identification. The documentation incorrectly shows `--task 3` for jumping.

**Recommendation:** Update README.md to use `workflow next --step 3` for jumping, and clarify that `--task` is for parallel task binding.

---

### Issue 2: Hooks Table Count Mismatch (NON-BLOCKING)

**Issue:** Documentation says "All 12 Claude Code hook types" but only 11-12 are listed in tables.

**Source:** Agent A

**Validation:** VALIDATED

**Evidence:**
From `hooks.json`, there are exactly **11 hooks registered**:
1. SessionStart
2. SessionEnd
3. UserPromptSubmit
4. SubagentStart
5. SubagentStop
6. PreToolUse
7. PostToolUse
8. Stop
9. Notification
10. PreCompact
11. PermissionRequest

CONVENTIONS.md lists 12 hooks:
1. SessionStart
2. SessionEnd
3. UserPromptSubmit
4. SlashCommandStart
5. SlashCommandEnd
6. SkillStart
7. SkillEnd
8. SubagentStop
9. PreToolUse
10. PostToolUse
11. Stop
12. Notification

The documentation claims 12 hooks but hooks.json only registers 11. Some hooks are documented but not registered (SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd) while others are registered but not documented (PreCompact, PermissionRequest, SubagentStart).

**Recommendation:** Align hook counts across documentation and hooks.json registration.

---

### Issue 3: Debug Environment Variable Wrong (NON-BLOCKING)

**Issue:** Debug section references `TURBOSHOVEL_HOOK_DEBUG=true` but logger.ts uses `TURBOSHOVEL_LOG` and `TURBOSHOVEL_LOG_LEVEL`.

**Source:** Agent A

**Validation:** VALIDATED

**Evidence:**
From CONVENTIONS.md lines 337-338:
```bash
export TURBOSHOVEL_HOOK_DEBUG=true
tail -f $TMPDIR/turboshovel-hooks-$(date +%Y%m%d).log
```

From `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/logger.ts` lines 43-58:
```typescript
function isLoggingEnabled(): boolean {
  return process.env.TURBOSHOVEL_LOG !== '0';
}

function getMinLogLevel(): LogLevel {
  const level = process.env.TURBOSHOVEL_LOG_LEVEL as LogLevel;
  if (level && LOG_LEVELS[level] !== undefined) {
    return level;
  }
  return 'info';
}
```

The documented `TURBOSHOVEL_HOOK_DEBUG` environment variable does not exist in the implementation. The actual variables are `TURBOSHOVEL_LOG` (set to `0` to disable) and `TURBOSHOVEL_LOG_LEVEL`.

**Recommendation:** Update CONVENTIONS.md debugging section to use correct environment variables.

---

### Issue 4: Missing convention-based.json in Examples List (NON-BLOCKING)

**Issue:** Examples directory contains `convention-based.json` but documentation doesn't list it.

**Source:** Agent A

**Validation:** VALIDATED

**Evidence:**
From `ls` of `/Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/`:
```
convention-based.json
permissive.json
pipeline.json
strict.json
context/
code-review.workflow.md
```

The file `convention-based.json` exists but is not listed in README.md examples section.

**Recommendation:** Add `convention-based.json` to the examples documentation in README.md.

---

### Issue 5: ARCHITECTURE.md Directory Structure Lists Non-Existent File (NON-BLOCKING)

**Issue:** Diagram shows `context/session-start.md` but no `plugin/hooks/context/` directory exists.

**Source:** Agent A

**Validation:** INVALIDATED

**Evidence:**
From ARCHITECTURE.md lines 103-104:
```
├── context/                    # Plugin-level context files (NEW)
│   └── session-start.md        # Injects on SessionStart
```

Checked directory existence:
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/context/` - **Does NOT exist**
- `/Users/tobyhede/psrc/turboshovel/plugin/context/` - **EXISTS** with files: `session-start.md`, `prompt-submit.md`, `subagent-stop.md`, `tool-use.md`

The issue is valid regarding the diagram showing wrong path (`plugin/hooks/context/` vs `plugin/context/`), but this is essentially the same as Common Issue #2 (Plugin Context Directory Path Mismatch) which was already identified by both reviewers. This is not a separate issue but a duplicate of the common issue.

**Recommendation:** Already covered by Common Issue #2 - no separate action needed.

---

### Issue 6: Workflow Step/Task Nomenclature Inconsistent (NON-BLOCKING)

**Issue:** README.md:449 uses `workflow next --task 3` but CLI uses `--step`.

**Source:** Agent A

**Validation:** VALIDATED

**Evidence:** This is the same issue as Issue 1 above (--step vs --task flag). The README shows `workflow next --task 3` in multiple places but the implementation uses `--step <n>` for jumping.

Line 449:
```markdown
workflow next --task 3
```

This is a duplicate of Issue 1, just noting a different line number.

**Recommendation:** Already covered by Issue 1 validation above.

---

## Agent B Exclusive Issues

### Issue 7: Missing Workflow CLI Commands in CLAUDE.md (BLOCKING)

**Issue:** CLAUDE.md documents only 4 workflow commands but implementation has 8: missing `complete`, `list`, `stash`, `pop`.

**Source:** Agent B

**Validation:** VALIDATED

**Evidence:**
From CLAUDE.md lines 94-97:
```markdown
- `workflow start <file>` - Start workflow
- `workflow next` - Advance to next task
- `workflow status` - Show current state
- `workflow stop` - Abort workflow
```

From `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli/workflow-cli.ts`, the actual commands are:
1. `start` (line 24)
2. `next` (line 119)
3. `complete` (line 221)
4. `status` (line 251)
5. `stop` (line 313)
6. `list` (line 336)
7. `stash` (line 361)
8. `pop` (line 385)

CLAUDE.md is missing: `complete`, `list`, `stash`, `pop`

README.md does document `list`, `stash`, and `pop` (lines 451-477) but not `complete`.

**Recommendation:** Add missing workflow commands to CLAUDE.md. Consider whether README.md also needs `complete` added.

---

### Issue 8: PreCompact and PermissionRequest Hooks Not Documented (NON-BLOCKING)

**Issue:** hooks.json includes PreCompact and PermissionRequest hooks but documentation does not mention them.

**Source:** Agent B

**Validation:** VALIDATED

**Evidence:**
From `hooks.json` lines 66-79:
```json
"PreCompact": [{
  "matcher": ".*",
  "hooks": [{
    "type": "command",
    "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js"
  }]
}],
"PermissionRequest": [{
  "matcher": ".*",
  "hooks": [{
    "type": "command",
    "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js"
  }]
}]
```

CONVENTIONS.md (lines 27-39) lists 12 hooks but does NOT include:
- PreCompact
- PermissionRequest
- SubagentStart (also registered but not listed)

These hooks are registered in hooks.json but not documented in CONVENTIONS.md.

**Recommendation:** Add PreCompact, PermissionRequest, and SubagentStart to the hook documentation in CONVENTIONS.md and README.md.

---

### Issue 9: Missing Workflow CLI Entry Point Documentation (NON-BLOCKING)

**Issue:** package.json shows workflow bin entry but no documentation on how to invoke it.

**Source:** Agent B

**Validation:** VALIDATED

**Evidence:**
From `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/package.json` lines 6-8:
```json
"bin": {
  "workflow": "dist/cli/workflow-cli.js"
},
```

This creates an executable `workflow` command when the package is installed. However, the documentation (CLAUDE.md, README.md) shows commands like `workflow start` but does not explain:
1. How to install/link the package to get the `workflow` command
2. Alternative ways to invoke it (e.g., `npx workflow`, `node dist/cli/workflow-cli.js`)

README.md line 440 shows `workflow start my-workflow.md` but no setup instructions for the workflow CLI.

**Recommendation:** Add section explaining how to install or invoke the workflow CLI (e.g., `npm link` in hooks-app, or direct node invocation).

---

## Summary of Validated Issues

### Must Address (BLOCKING)

1. **--step vs --task flag** (Agent A): README uses `--task N` for jumping but implementation uses `--step <n>`
2. **Missing workflow commands in CLAUDE.md** (Agent B): Missing `complete`, `list`, `stash`, `pop`

### Should Address (NON-BLOCKING)

1. **Hooks count mismatch** (Agent A): 11 registered vs 12 documented, with different hooks in each
2. **Debug env var wrong** (Agent A): `TURBOSHOVEL_HOOK_DEBUG` should be `TURBOSHOVEL_LOG`
3. **Missing convention-based.json docs** (Agent A): File exists but not documented
4. **PreCompact/PermissionRequest undocumented** (Agent B): Registered hooks not in docs
5. **Workflow CLI entry point** (Agent B): No docs on how to invoke workflow command

### Invalidated (Skip)

1. **ARCHITECTURE.md directory structure** (Agent A): Duplicate of Common Issue #2

---

## Updated Recommendations

### Add to `/revise exclusive` List

- [ ] **--step vs --task flag:** Change all `workflow next --task N` to `workflow next --step N` in README.md
- [ ] **Missing workflow CLI commands:** Add `complete`, `list`, `stash`, `pop` to CLAUDE.md workflow section
- [ ] **Debug environment variable:** Change `TURBOSHOVEL_HOOK_DEBUG=true` to `TURBOSHOVEL_LOG=1` in CONVENTIONS.md
- [ ] **Missing hooks in docs:** Add PreCompact, PermissionRequest, SubagentStart to CONVENTIONS.md hook list
- [ ] **convention-based.json:** Add to examples list in README.md
- [ ] **Workflow CLI invocation:** Add setup/invocation instructions for workflow CLI

### Skip (Already Covered or Invalid)

- [ ] ARCHITECTURE.md context directory - covered by Common Issue #2
- [ ] Workflow step/task nomenclature - duplicate of --step vs --task issue

---

## Cross-Check Status

**Status:** COMPLETE

All 9 exclusive issues have been validated against ground truth:
- **8 VALIDATED** - confirmed to exist, should be addressed
- **1 INVALIDATED** - duplicate of common issue, skip

The collation report can now be updated with these cross-check results.
