# Walkthrough Issues

Issues discovered during `/turboshovel:walkthrough` debugging session on 2025-12-25.

## Issue 1: CLI Not in PATH

**Status:** Documentation
**Severity:** Low
**Location:** `plugin/core/package.json`

The `workflow` command is defined as a bin entry but not globally accessible. Users must invoke via:
```bash
node /path/to/plugin/core/dist/cli/workflow-cli.js <command>
```

**Resolution:** Document the requirement to either:
- Use full path to the CLI
- Run `npm link` in the plugin/core directory
- Add an alias

---

## Issue 2: TaskID Uses Letters Instead of Numbers

**Status:** ✅ FIXED
**Severity:** High
**Location:** Multiple files

The TaskID system used letters (A, B, C) for subtask identifiers, but the walkthrough and verification expect numbers (1, 2, 3).

**Resolution:** Refactored TaskID to use numeric subtasks:
- `src/workflow/task-id.ts` - Regex changed from `[A-Za-z]` to `\d+`
- `src/workflow/parser/helpers.ts` - Updated subtask pattern matching
- `src/workflow/types.ts` - Updated type comments
- `src/cli/workflow-cli.ts` - Updated help text and error messages
- All test files updated to use numeric subtasks

### Format
```
3.1 - First reviewer
3.2 - Second reviewer
```

---

## Issue 3: Retry Count Not Auto-Incremented

**Status:** Design Gap
**Severity:** Medium
**Location:** `src/cli/workflow-cli.ts`, hook system

When a task fails with `FAIL: RETRY N`, the workflow state's `retryCount` is not automatically incremented. The orchestrator must manually track retries.

**Current behavior:**
- Task fails -> FAIL condition triggers RETRY action
- `workflow status` shows `Retry: 0/3` (unchanged)
- No automatic retry loop

**Expected behavior (unclear):**
- Should the CLI auto-retry commands?
- Should it just increment the counter for agent awareness?
- Is manual orchestration by main agent intentional?

**Resolution:** Clarify design intent. If auto-increment desired, add to `workflow next` when previous task failed.

---

## Issue 4: Variable Substitution Not Implemented

**Status:** ✅ FIXED
**Severity:** High
**Location:** `src/workflow/hooks/subagent-start.ts`, `src/workflow/hooks/substitute.ts`

The `$n` placeholder in prompt templates is now substituted with actual values when dispatching agents.

**Resolution:** Implemented in SubagentStart hook:
1. `substituteVariables()` - Replaces `$n` with subtask number
2. `getTaskPrompt()` - Extracts prompt from parsed workflow tasks
3. `loadAndSubstitutePrompt()` - Loads workflow, finds prompt, substitutes variables
4. Context injection includes substituted prompt under `## Task Prompt` section

### Example

Workflow prompt:
```
You are agent $n in the walkthrough.
1. Append "agent-$n-started" to .work/walkthrough.log
```

Agent receives (for subtask 1):
```
## Task Prompt

You are agent 1 in the walkthrough.
1. Append "agent-1-started" to .work/walkthrough.log
```

---

## Issue 5: Dynamic Subtask `{n}` Semantics Unclear

**Status:** Documentation
**Severity:** Medium
**Location:** `src/workflow/parser/helpers.ts`

The `### N.{n}` syntax marks a subtask as "dynamic" (spawned at runtime), but:
- How many agents to spawn is not specified in the workflow
- The orchestrator must decide the count
- No clear API to "expand" `{n}` into `1, 2, 3...`

**Current understanding:**
- `{n}` is a template marker, not a literal ID
- Main agent decides how many subtasks to create
- Each gets sequential number 1, 2, 3...

**Resolution:** Document the orchestration contract clearly in SKILL.md.

---

## Summary

| # | Issue | Priority | Status |
|---|-------|----------|--------|
| 1 | CLI not in PATH | Low | Document |
| 2 | TaskID letters vs numbers | High | ✅ FIXED |
| 3 | Retry count not auto-incremented | Medium | Clarify design |
| 4 | Variable substitution missing | High | ✅ FIXED |
| 5 | Dynamic subtask semantics | Medium | Document |

## Next Steps

1. ~~**Fix Issue 2 first** - Refactor TaskID to use numbers~~ ✅
2. ~~**Fix Issue 4** - Implement or document variable substitution~~ ✅
3. **Document** Issues 1, 3, 5 in relevant docs
