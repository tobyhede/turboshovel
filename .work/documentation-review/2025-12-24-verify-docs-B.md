# Review - 2025-12-24

## Metadata
- **Reviewer:** technical-writer
- **Date:** 2025-12-24 15:50:00
- **Subject:** Turboshovel project documentation files (CLAUDE.md, README.md, plugin/hooks/*.md)
- **Ground Truth:** Actual codebase implementation in plugin/hooks/hooks-app/
- **Context:** Independent review #2 for dual-verification
- **Mode:** Review

## Summary
- **Subject:** Complete Turboshovel documentation verification against codebase implementation
- **Scope:** All 8 documentation files reviewed for accuracy against TypeScript source code

---

## Status: BLOCKED

## BLOCKING (Must Address)

**1. Missing Hook Events in Documentation:**
- Description: Documentation claims 12 hook types are supported but only lists specific ones. The actual `hooks.json` shows 11 hooks registered (missing SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd). However, the code in `context.ts` handles all 12 events listed.
- Location: plugin/hooks/README.md lines 78-96, plugin/hooks/ARCHITECTURE.md lines 212-230
- Impact: Users expect all 12 hooks to work but only 11 are registered in hooks.json. SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd are NOT in hooks.json.
- Action: Either add the missing hooks to hooks.json OR update documentation to reflect which hooks are actually registered vs which are only handled in code.

**2. Session State File Path Inconsistency:**
- Description: ARCHITECTURE.md claims session state is stored at `$TMPDIR/turboshovel/session-{cwd-hash}.json` but actual implementation in `session.ts` stores it at `.claude/session/state.json`
- Location: plugin/hooks/ARCHITECTURE.md line 322
- Impact: Users looking for session state will look in wrong location
- Action: Update ARCHITECTURE.md line 322 to state: "State persists in `.claude/session/state.json` relative to the project directory."

**3. Context Directory Does Not Exist:**
- Description: Documentation references `plugin/hooks/context/` but this directory does not exist. The plugin-level context files are at `plugin/context/` (one level up from hooks).
- Location: plugin/hooks/README.md line 66 ("plugin/context/"), plugin/hooks/ARCHITECTURE.md lines 103-104, plugin/hooks/CONVENTIONS.md lines 98-100
- Impact: Users cannot find plugin default context files; context.ts code correctly uses `${CLAUDE_PLUGIN_ROOT}/context/` which points to `plugin/context/`
- Action: Update documentation to clarify that plugin context is at `${CLAUDE_PLUGIN_ROOT}/context/` which resolves to `plugin/context/` (NOT `plugin/hooks/context/`)

**4. Debugging Command Log Path Mismatch:**
- Description: CONVENTIONS.md shows debug command with wrong log file naming pattern
- Location: plugin/hooks/CONVENTIONS.md lines 337-339
- Impact: Users cannot find logs using documented command
- Action: Update from `tail -f $TMPDIR/turboshovel-hooks-$(date +%Y%m%d).log` to `tail -f $TMPDIR/turboshovel/hooks-$(date +%Y-%m-%d).log` (note: directory structure and date format differ)

**5. Workflow CLI Documentation Incomplete:**
- Description: CLAUDE.md documents 4 workflow commands but implementation has 8 commands. Missing: `complete`, `list`, `stash`, `pop`
- Location: CLAUDE.md lines 91-97
- Impact: Users unaware of important workflow management commands
- Action: Add documentation for: `workflow complete [--status ok|blocked]`, `workflow list`, `workflow stash`, `workflow pop`

**6. Workflow State Path Partially Incorrect:**
- Description: README.md claims workflow state in `.claude/turboshovel/workflows/` which is correct for workflow states, but the active workflow ID is tracked in `.claude/turboshovel/session.json` - this is NOT the same as the session state in `.claude/session/state.json`
- Location: plugin/hooks/README.md line 703, CLAUDE.md line 99
- Impact: Confusing because two different session files exist: `.claude/session/state.json` (hook session) and `.claude/turboshovel/session.json` (workflow session)
- Action: Clarify that there are two separate session tracking mechanisms in the documentation

**7. IF/ELSE Documentation Claims Feature Not Implemented:**
- Description: README.md documents IF/ELSE conditional syntax (lines 563-576) with a note that it's not implemented, but this adds confusion to the documentation
- Location: plugin/hooks/README.md lines 563-620
- Impact: Documentation describes planned but unimplemented syntax mixed with working features
- Action: Move unimplemented features to a "Planned Features" or "Future Work" section, or remove entirely until implemented

---

## SUGGESTIONS (Would Improve Quality)

**1. Document SubagentStart Hook:**
- Description: hooks.json includes SubagentStart but documentation tables do not list it
- Location: plugin/hooks/README.md line 82, plugin/hooks/ARCHITECTURE.md
- Benefit: Complete documentation of all available hooks
- Action: Add `SubagentStart` to hook event tables with context pattern `{agent}-start.md`

**2. Document PreCompact and PermissionRequest Hooks:**
- Description: hooks.json includes PreCompact and PermissionRequest but documentation does not mention them
- Location: hooks.json lines 66-79
- Benefit: Users aware of all hook capabilities
- Action: Add these hooks to documentation tables

**3. Clarify Gate Configuration vs Context Injection:**
- Description: Documentation repeatedly emphasizes "no configuration needed" for context injection but then shows gates.json examples. This can confuse users about what is truly zero-config.
- Location: plugin/hooks/README.md introduction, SETUP.md
- Benefit: Clearer separation of context injection (zero-config) vs gate execution (requires gates.json)
- Action: Add a clear diagram or summary table showing which features need configuration and which don't

**4. Remove Obsolete Shell Script References:**
- Description: Testing documentation references shell scripts and shared-functions.sh that don't exist
- Location: plugin/hooks/SETUP.md lines 383-394, plugin/hooks/INTEGRATION_TESTS.md line 246
- Benefit: Remove references to obsolete implementation
- Action: Update testing instructions to use TypeScript CLI directly: `echo '...' | node dist/cli.js`

**5. Inconsistent Example File Paths:**
- Description: Examples reference `plugin/hooks/examples/` but some workflow examples were removed (collate.workflow.md, verify-code.workflow.md, etc. per git status)
- Location: plugin/hooks/README.md line 1220-1222
- Benefit: Accurate example references
- Action: Update example list to only reference files that exist: code-review.workflow.md

**6. Document Workflow CLI Entry Point:**
- Description: package.json shows `"workflow": "dist/cli/workflow-cli.js"` as bin entry but documentation doesn't explain how to invoke it
- Location: No current documentation
- Benefit: Users know how to run workflow commands
- Action: Add section explaining: "After npm install, run `npx workflow <command>` or add to PATH"

**7. TYPESCRIPT.md References Wrong Directory Structure:**
- Description: States TypeScript gates are in `src/gates/` but full path is `hooks-app/src/gates/`
- Location: plugin/hooks/TYPESCRIPT.md line 7
- Benefit: Clearer for users navigating codebase
- Action: Use consistent relative paths from hooks directory

**8. Environment Variable Documentation Accuracy:**
- Description: CLAUDE.md says `TURBOSHOVEL_LOG=0` disables logging. Code confirms this is correct, but logger.ts comments suggest it was previously `TURBOSHOVEL_LOG=1` to enable.
- Location: CLAUDE.md lines 62-63, logger.ts lines 43-47
- Benefit: Accurate environment variable documentation
- Action: Verify and ensure documentation matches current behavior (currently correct)

---

## Assessment

**Conclusion:**
The documentation has several significant discrepancies with the actual codebase implementation. The most critical issues are:

1. Hook registration gaps (some documented hooks not in hooks.json)
2. Session state path mismatch between docs and implementation
3. Missing workflow CLI commands in documentation
4. Plugin context directory path confusion

The documentation quality is generally good with detailed examples and explanations, but the accuracy issues would cause real problems for users trying to use the documented features.

**Confidence in findings:**
HIGH - All issues verified against actual source code. Some edge cases in hook behavior may require runtime testing to fully confirm, but file paths, configurations, and code structure have been definitively verified.
