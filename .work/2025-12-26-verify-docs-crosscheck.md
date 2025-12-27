# Cross-Check Report - Documentation Verification

## Metadata
- **Date:** 2025-12-26
- **Cross-check Type:** Exclusive Issue Validation
- **Source:** /Users/tobyhede/psrc/turboshovel/.work/2025-12-26-verify-docs-collated.md

---

## Exclusive Issues from Reviewer #1

### Issue 1: Session state file path discrepancy (README.md lines 849-851)

- **Issue:** README.md claims hook session is at `.claude/session/state.json` but this directory does not exist in the project.
- **Source:** Reviewer #1
- **Validation:** **INVALIDATED**
- **Evidence:**
  - The code in `plugin/core/src/session.ts` line 17 confirms the path: `this.stateFile = join(cwd, '.claude', 'session', 'state.json');`
  - The comment at line 11 states: "State is stored in .claude/session/state.json relative to the project directory."
  - The directory is created on first use (line 165 in `save()`: `await fs.mkdir(dirname(this.stateFile), { recursive: true });`)
  - This is expected behavior for runtime-created files. The documentation is accurate.
- **Recommendation:** Skip. Documentation is correct - the directory is created at runtime when first needed.

---

### Issue 2: HookInput interface documentation incomplete (TYPESCRIPT.md lines 104-133)

- **Issue:** HookInput interface documentation is missing some fields that exist in actual schemas.ts
- **Source:** Reviewer #1
- **Validation:** **INVALIDATED**
- **Evidence:**
  - Compared TYPESCRIPT.md lines 104-133 with `plugin/core/src/schemas.ts` lines 17-39
  - TYPESCRIPT.md documents: `hook_event_name`, `cwd`, `tool_name`, `file_path`, `tool_input` (with subfields), `agent_id`, `agent_name`, `subagent_name`, `output`, `agent_transcript_path`, `user_message`, `command`, `skill`
  - schemas.ts defines: `hook_event_name`, `cwd`, `tool_name`, `file_path`, `tool_input` (with subfields), `agent_id`, `agent_name`, `subagent_name`, `output`, `agent_transcript_path`, `user_message`, `command`, `skill`
  - All fields in schemas.ts are documented in TYPESCRIPT.md. The documentation is complete.
- **Recommendation:** Skip. Documentation matches implementation.

---

### Issue 3: Workflow CLI --pass flag not documented (CLAUDE.md lines 104-114)

- **Issue:** CLAUDE.md shows `tsv next --fail` but does not mention `--pass` flag which exists in cli.ts line 129
- **Source:** Reviewer #1
- **Validation:** **VALIDATED**
- **Evidence:**
  - CLAUDE.md lines 104-114 shows: `tsv next`, `tsv next --fail`
  - `packages/cli/src/cli.ts` line 128-129 shows: `.option('--pass', 'Mark task as passed')` and `.option('--fail', 'Mark task as failed/blocked')`
  - The `--pass` flag exists but is not documented in CLAUDE.md
- **Recommendation:** Add `--pass` flag documentation to CLAUDE.md. However, this is low priority since `--pass` is typically the default behavior (passing without --fail).

---

### Issue 4: package.json bin field confusion (plugin/core/package.json)

- **Issue:** plugin/core/package.json has bin entry `"workflow": "dist/cli/workflow-cli.js"` but packages/cli is the actual CLI package
- **Source:** Reviewer #1
- **Validation:** **VALIDATED**
- **Evidence:**
  - `plugin/core/package.json` line 7: `"workflow": "dist/cli/workflow-cli.js"`
  - `packages/cli/` exists as a separate npm package with its own CLI implementation
  - The `packages/cli/README.md` documents `tsv` and `turboshovel` as command names
  - Having `workflow` as a bin entry in plugin/core while packages/cli is the published CLI creates confusion
- **Recommendation:** Remove or update the `bin` entry in `plugin/core/package.json` to avoid confusion with the published `@turboshovel/cli` package. LOW PRIORITY - this is internal organization, not user-facing documentation.

---

### Issue 5: CONVENTIONS.md pre/post stage naming inconsistency (CONVENTIONS.md lines 165-168)

- **Issue:** Says stages are `start`/`pre` and `end`/`post` but examples use different conventions inconsistently
- **Source:** Reviewer #1
- **Validation:** **INVALIDATED**
- **Evidence:**
  - CONVENTIONS.md lines 165-168 clearly states: "Stage Names: `start` / `pre` - Before execution, `end` / `post` - After completion, Lowercase only"
  - This explicitly documents that BOTH `start`/`pre` and `end`/`post` are valid stage names
  - Examples throughout the documentation use both forms consistently for their intended purposes (e.g., `session-start.md`, `{tool}-pre.md`)
  - The dual naming is intentional to support different semantic contexts (session lifecycle vs tool execution)
- **Recommendation:** Skip. Documentation accurately describes the dual naming convention.

---

### Issue 6: Hook Events table verification needed (README.md lines 100-122)

- **Issue:** Hook event table should be verified against hooks.json - some "Not implemented" labels may need updating
- **Source:** Reviewer #1
- **Validation:** **VALIDATED**
- **Evidence:**
  - README.md lines 109-116 shows:
    - SubagentStart: "Not implemented" for context injection
    - PreCompact: "Not implemented" for context injection
    - PermissionRequest: "Not implemented" for context injection
  - `plugin/hooks.json` shows ALL hooks including SubagentStart, PreCompact, PermissionRequest are registered with the same command
  - Line 120 clarifies: "SubagentStart, PreCompact, and PermissionRequest are registered hooks but context injection is not yet implemented for them. Gates still work for these hooks."
  - The table is accurate - "Not implemented" refers to context injection, not hook registration
- **Recommendation:** Skip. The documentation is accurate; the clarifying note at line 120 explains the distinction.

---

## Exclusive Issues from Reviewer #2

### Issue 7: Incorrect gates.json path in ARCHITECTURE.md (ARCHITECTURE.md lines 60-65, 108)

- **Issue:** ARCHITECTURE.md references `plugin/core/gates.json` but actual file is at `plugin/gates.json`
- **Source:** Reviewer #2
- **Validation:** **VALIDATED**
- **Evidence:**
  - ARCHITECTURE.md line 60: `plugin/core/gates.json           <- Plugin defaults (TypeScript gates)`
  - ARCHITECTURE.md line 109: `gates.json              # Plugin default gates configuration` (under plugin/core/)
  - Actual location: `plugin/gates.json` (confirmed via `ls -la /Users/tobyhede/psrc/turboshovel/plugin/`)
  - There is NO `plugin/core/gates.json` file
- **Recommendation:** Update ARCHITECTURE.md to reference `plugin/gates.json` instead of `plugin/core/gates.json`.

---

### Issue 8: Incorrect hooks.json path in ARCHITECTURE.md (ARCHITECTURE.md line 108, 156-169)

- **Issue:** ARCHITECTURE.md shows hooks.json at `plugin/core/hooks.json` but actual location is `plugin/hooks.json`
- **Source:** Reviewer #2
- **Validation:** **VALIDATED**
- **Evidence:**
  - ARCHITECTURE.md line 108: `hooks.json              # Hook registration (routes to CLI)` (under plugin/core/)
  - Actual location: `plugin/hooks.json` (confirmed via `ls -la /Users/tobyhede/psrc/turboshovel/plugin/`)
  - There is NO `plugin/core/hooks.json` file
- **Recommendation:** Update ARCHITECTURE.md to reference `plugin/hooks.json` instead of `plugin/core/hooks.json`.

---

### Issue 9: Incorrect CLI path in ARCHITECTURE.md hook config (ARCHITECTURE.md line 163)

- **Issue:** Shows CLI command path as `plugin/hooks/hooks-app/dist/cli.js` but actual path is `plugin/core/dist/cli.js`
- **Source:** Reviewer #2
- **Validation:** **VALIDATED**
- **Evidence:**
  - ARCHITECTURE.md lines 159-168 shows example hook configuration with: `"command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js"`
  - Actual `plugin/hooks.json` uses: `"command": "node ${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js"`
  - The path `hooks/hooks-app/` does not exist - this is a legacy path that was never updated
- **Recommendation:** Update ARCHITECTURE.md example to use `${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js`.

---

### Issue 10: INTEGRATION_TESTS.md modifies plugin gates.json directly (INTEGRATION_TESTS.md tests 3, 4, 5, 6)

- **Issue:** Examples modify `plugin/core/gates.json` directly but docs say users should never modify plugin configuration directly
- **Source:** Reviewer #2
- **Validation:** **VALIDATED**
- **Evidence:**
  - INTEGRATION_TESTS.md tests 3-6 show commands like: `cat > plugin/core/gates.json <<'EOF'`
  - Best practice documented elsewhere is to use `.claude/gates.json` for project overrides
  - Test 2 correctly shows using `.claude/gates.json`
  - Tests 3-6 inconsistently modify plugin files directly
  - Additionally, the path `plugin/core/gates.json` doesn't exist - actual file is at `plugin/gates.json`
- **Recommendation:** Update INTEGRATION_TESTS.md tests 3-6 to use `.claude/gates.json` pattern for consistency and correctness.

---

### Issue 11: Inconsistent directory structure in ARCHITECTURE.md (ARCHITECTURE.md lines 97-150)

- **Issue:** Directory structure partially matches reality but has inaccuracies (examples/ is at root, not under plugin/core/)
- **Source:** Reviewer #2
- **Validation:** **VALIDATED**
- **Evidence:**
  - ARCHITECTURE.md lines 145-149 shows `examples/` under `plugin/core/` directory
  - Actual `examples/` directory is at project root: `/Users/tobyhede/psrc/turboshovel/examples/`
  - There is NO `plugin/core/examples/` directory
  - Also, lines 100-106 show `plugin/context/` which does not exist
- **Recommendation:** Update directory structure in ARCHITECTURE.md to reflect actual layout: `examples/` at root level, remove `plugin/context/` reference.

---

### Issue 12: CONVENTIONS.md references non-existent slash commands (CONVENTIONS.md lines 271-303)

- **Issue:** References `/turboshovel:code-review`, `/turboshovel:plan` as examples but these are not defined
- **Source:** Reviewer #2
- **Validation:** **INVALIDATED**
- **Evidence:**
  - CONVENTIONS.md lines 271-303 use these as EXAMPLE patterns showing how context injection WOULD work
  - Line 273: "**Triggered by:** `/turboshovel:code-review` command"
  - This is documentation of the naming convention pattern, not claiming these commands exist
  - The purpose is to illustrate how to create context files that would be triggered by such commands
  - The pattern documentation is valid even if specific commands aren't implemented yet
- **Recommendation:** Skip. The documentation correctly illustrates naming patterns. Could add a note that these are example patterns, but not required.

---

### Issue 13: Documentation emphasis on planned hooks may confuse users (README.md line 102, CONVENTIONS.md line 44)

- **Issue:** "Planned hooks" (SlashCommandStart, etc.) prominently mentioned but not available
- **Source:** Reviewer #2
- **Validation:** **INVALIDATED**
- **Evidence:**
  - README.md line 122: "**Planned hooks (not yet registered):** SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd - context patterns exist but hooks are not registered in `hooks.json`."
  - This clearly states they are "not yet registered" and explicitly notes hooks are not in hooks.json
  - The documentation is transparent about what's planned vs available
- **Recommendation:** Skip. Documentation clearly labels these as planned/unregistered.

---

### Issue 14: Missing `complete` command documentation (packages/cli/README.md)

- **Issue:** CLAUDE.md lists `tsv complete` but CLI README.md does not document what it does beyond "Mark complete"
- **Source:** Reviewer #2
- **Validation:** **VALIDATED**
- **Evidence:**
  - CLAUDE.md line 112: `tsv complete           # Mark complete`
  - packages/cli/README.md line 38: `| \`tsv complete\` | Mark complete |`
  - Neither explains what "Mark complete" means vs `tsv stop`
  - The actual implementation in `cli.ts` lines 351-379 shows:
    - `complete` can take `--status ok` (default) or `--status blocked`
    - With `ok`: clears active workflow (normal completion)
    - With `blocked`: sets blocked flag but keeps workflow (can resume?)
  - `stop` (lines 443-464): aborts and deletes workflow state
- **Recommendation:** Add brief explanation distinguishing `complete` from `stop` in CLI documentation.

---

### Issue 15: ARCHITECTURE.md session state path inconsistency (ARCHITECTURE.md line 349)

- **Issue:** Says hook session state is at `.claude/session/state.json` but may not match implementation
- **Source:** Reviewer #2
- **Validation:** **INVALIDATED**
- **Evidence:**
  - ARCHITECTURE.md line 349: "State persists in `.claude/session/state.json`."
  - Implementation in `plugin/core/src/session.ts` line 11: "State is stored in .claude/session/state.json"
  - Implementation line 17: `this.stateFile = join(cwd, '.claude', 'session', 'state.json');`
  - Documentation matches implementation exactly
- **Recommendation:** Skip. Documentation is accurate.

---

### Issue 16: Outdated comment in gates index.ts (plugin/core/src/gates/index.ts line 1)

- **Issue:** Comment references old path structure `plugin/hooks/hooks-app/src/gates/index.ts`
- **Source:** Reviewer #2
- **Validation:** **VALIDATED**
- **Evidence:**
  - `plugin/core/src/gates/index.ts` line 1: `// plugin/hooks/hooks-app/src/gates/index.ts`
  - Actual file path is `plugin/core/src/gates/index.ts`
  - The comment references an old directory structure that no longer exists
- **Recommendation:** Update comment to reflect current path: `// plugin/core/src/gates/index.ts`. LOW PRIORITY - this is code comment, not user-facing documentation.

---

## Summary

| Issue | Source | Validation | Priority |
|-------|--------|------------|----------|
| Session state file path discrepancy | #1 | INVALIDATED | Skip |
| HookInput interface documentation | #1 | INVALIDATED | Skip |
| --pass flag not documented | #1 | VALIDATED | Low |
| package.json bin confusion | #1 | VALIDATED | Low (internal) |
| pre/post naming inconsistency | #1 | INVALIDATED | Skip |
| Hook Events table verification | #1 | INVALIDATED | Skip |
| Incorrect gates.json path | #2 | VALIDATED | High |
| Incorrect hooks.json path | #2 | VALIDATED | High |
| Incorrect CLI path in hook config | #2 | VALIDATED | High |
| INTEGRATION_TESTS.md patterns | #2 | VALIDATED | Medium |
| Directory structure inaccuracy | #2 | VALIDATED | High |
| Non-existent slash commands | #2 | INVALIDATED | Skip |
| Planned hooks emphasis | #2 | INVALIDATED | Skip |
| Missing complete command docs | #2 | VALIDATED | Low |
| Session state path inconsistency | #2 | INVALIDATED | Skip |
| Outdated gates index.ts comment | #2 | VALIDATED | Low (code) |

### Final Counts

- **VALIDATED:** 9 issues (should be addressed)
  - High Priority (BLOCKING): 4 (gates.json path, hooks.json path, CLI path, directory structure)
  - Medium Priority: 1 (INTEGRATION_TESTS.md patterns)
  - Low Priority: 4 (--pass flag, package.json bin, complete docs, code comment)
- **INVALIDATED:** 7 issues (can be skipped)
- **UNCERTAIN:** 0 issues

### Recommendations for /revise exclusive

**High Priority (Address Immediately):**
1. Fix ARCHITECTURE.md `plugin/core/gates.json` -> `plugin/gates.json`
2. Fix ARCHITECTURE.md `plugin/core/hooks.json` -> `plugin/hooks.json`
3. Fix ARCHITECTURE.md hook config CLI path `hooks/hooks-app/` -> `core/`
4. Fix ARCHITECTURE.md directory structure (`examples/` at root, remove `plugin/context/`)

**Medium Priority:**
5. Update INTEGRATION_TESTS.md tests 3-6 to use `.claude/gates.json` and correct path

**Low Priority (Nice to have):**
6. Document `--pass` flag in CLAUDE.md
7. Document `complete` vs `stop` distinction
8. Update code comment in gates/index.ts
9. Consider removing/updating bin entry in plugin/core/package.json
