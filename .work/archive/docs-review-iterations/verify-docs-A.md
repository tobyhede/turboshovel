# Documentation Review - 2024-12-24

## Metadata
- **Reviewer:** technical-writer
- **Date:** 2024-12-24 16:30:00
- **Subject:** Turboshovel documentation verification
- **Ground Truth:** Current codebase implementation
- **Context:** Independent review #1 for dual-verification
- **Mode:** Review

## Summary
- **Subject:** Complete documentation audit
- **Scope:** All .md files in project (CLAUDE.md, README.md, SETUP.md, CONVENTIONS.md, TYPESCRIPT.md, ARCHITECTURE.md, INTEGRATION_TESTS.md)

## Status: APPROVED WITH SUGGESTIONS

---

## BLOCKING (Must Address)

### 1. Context File Naming for UserPromptSubmit is Incorrect

**Location:** `plugin/hooks/CONVENTIONS.md` lines 157-158, `plugin/hooks/README.md` lines 86, 158

**Description:** Documentation claims UserPromptSubmit context pattern is `prompt-submit.md` but the implementation in `context.ts` line 199 maps UserPromptSubmit to `{ name: 'prompt', stage: 'submit' }`, which would look for `prompt-submit.md`. This is correct. However, the README.md table on line 86 and 158 shows `prompt-submit.md` which IS correct.

**Verification:** Code confirms `prompt-submit.md` is correct. Documentation IS accurate here.

**Impact:** None - false alarm on review.

**Action:** No action needed - documentation is accurate.

### 2. SubagentStart Hook Context Pattern Missing from Documentation

**Location:** `plugin/hooks/README.md` lines 87, 159, `plugin/hooks/CONVENTIONS.md` lines 27-32

**Description:** Documentation mentions SubagentStart hook with pattern `{agent}-start.md`, but the implementation in `context.ts` does NOT have a handler for SubagentStart in `extractNameAndStage()`. Only SubagentStop has special handling.

**Verification:** `context.ts` lines 167-215 shows extractNameAndStage() returns null for SubagentStart since there's no case for it in the switch statement.

**Impact:** MEDIUM - Users may create `{agent}-start.md` files expecting them to be injected at SubagentStart, but they won't be discovered.

**Action:** Either:
1. Add SubagentStart handling to context.ts, OR
2. Update documentation to clarify SubagentStart context injection is NOT implemented

### 3. PreCompact Context Pattern Not Documented Correctly

**Location:** `plugin/hooks/README.md` line 93, 165

**Description:** Documentation shows PreCompact pattern as `pre-compact.md`, but implementation in `context.ts` has no case for PreCompact in `extractNameAndStage()`.

**Verification:** PreCompact is not in the switch statement in context.ts, so no context file will be discovered for it.

**Impact:** MEDIUM - Users may create pre-compact.md expecting injection that won't happen.

**Action:** Either add PreCompact to context.ts or document that it's not implemented.

### 4. PermissionRequest Context Pattern Not Documented Correctly

**Location:** `plugin/hooks/README.md` line 94, 166

**Description:** Documentation shows PermissionRequest pattern as `permission-request.md`, but implementation in `context.ts` has no case for PermissionRequest.

**Verification:** PermissionRequest is not in the switch statement in context.ts.

**Impact:** MEDIUM - Users may create permission-request.md expecting injection that won't happen.

**Action:** Either add PermissionRequest to context.ts or document that it's not implemented.

---

## SUGGESTIONS (Would Improve Quality)

### 1. Clarify Workflow State Directory Path

**Location:** `CLAUDE.md` line 103

**Description:** States "State persists in `.claude/turboshovel/workflows/`" which is correct per `state.ts` line 7. However, the README.md mentions `.claude/turboshovel/session.json` for active workflow tracking separately from workflow state files. The CLAUDE.md could be more complete.

**Action:** Consider adding mention of session.json for completeness.

### 2. Hook Session vs Workflow Session Distinction

**Location:** `plugin/hooks/ARCHITECTURE.md` lines 319-354

**Description:** Architecture documentation excellently distinguishes between hook session (`.claude/session/state.json`) and workflow session (`.claude/turboshovel/session.json`). This important distinction could be highlighted more prominently in README.md or SETUP.md for users.

**Action:** Add a note in README.md about the two separate session mechanisms.

### 3. workflow-cli Binary Name in package.json

**Location:** `plugin/hooks/README.md` lines 466-476

**Description:** Documentation shows linking via `npm link` and using `workflow` command. The package.json confirms `bin.workflow: "dist/cli/workflow-cli.js"`. This is accurate.

**Verification:** package.json line 8 confirms `"workflow": "dist/cli/workflow-cli.js"`

**Action:** None needed - accurate.

### 4. Missing Context Hooks List Should Be Complete

**Location:** `plugin/hooks/README.md` lines 82-94

**Description:** The table shows 11 hook events, but only SessionStart, SessionEnd, UserPromptSubmit, SubagentStop, PreToolUse, PostToolUse, Stop, and Notification are actually implemented in `extractNameAndStage()`. SubagentStart, PreCompact, and PermissionRequest return null (no context discovery).

**Action:** Add a note indicating which hooks actually support context injection vs which are registered but don't have context discovery.

### 5. Example Files Directory Structure

**Location:** `plugin/hooks/README.md` lines 1277-1286

**Description:** Documentation mentions `plugin/hooks/examples/` contains several files including `code-review.workflow.md`. Verification confirms this file exists, along with:
- `code-review.workflow.md`
- `context/` directory with 4 example files
- `convention-based.json`
- `permissive.json`
- `pipeline.json`
- `strict.json`

**Verification:** All documented example files exist.

**Action:** None needed - accurate.

### 6. Plugin Context Directory Structure

**Location:** `plugin/hooks/ARCHITECTURE.md` lines 99-106

**Description:** Documentation shows plugin context files at `plugin/context/`. Verification confirms:
- `session-start.md`
- `prompt-submit.md`
- `subagent-stop.md`
- `tool-use.md`

However, documentation mentions `{tool}-pre.md`, `{tool}-post.md` patterns but `tool-use.md` exists as a general file, not tool-specific files.

**Action:** Consider clarifying that `plugin/context/tool-use.md` is general context, not a template.

### 7. IF/ELSE Conditionals Documentation Accuracy

**Location:** `plugin/hooks/README.md` lines 607-619

**Description:** Documentation correctly notes IF/ELSE conditionals are NOT YET IMPLEMENTED and directs users to use agent-controlled branching with `--step`. This is accurate - the parser in `parser.ts` only handles PASS/FAIL conditions per line 193.

**Verification:** Parser code confirms no IF/ELSE support.

**Action:** None needed - documentation accurately describes limitation.

### 8. TypeScript Gates Registry

**Location:** `plugin/hooks/TYPESCRIPT.md` lines 25-28

**Description:** Documentation shows only `plugin-path` as built-in gate. Verification of `gates/index.ts` confirms only `pluginPath` is exported.

**Verification:** `gates/index.ts` line 8 shows only `export * as pluginPath from './plugin-path'`.

**Action:** None needed - accurate.

### 9. Logging Configuration

**Location:** `CLAUDE.md` lines 62-63

**Description:** Documentation says `TURBOSHOVEL_LOG=0` to disable (enabled by default). Implementation in `logger.ts` line 46 confirms `process.env.TURBOSHOVEL_LOG !== '0'` means logging is enabled by default.

**Verification:** Implementation matches documentation.

**Action:** None needed - accurate.

### 10. HookInput Interface

**Location:** `plugin/hooks/TYPESCRIPT.md` lines 104-133

**Description:** HookInput interface documented matches `schemas.ts` implementation. All documented fields are present in the Zod schema.

**Verification:** schemas.ts lines 15-37 confirm all documented fields.

**Action:** None needed - accurate.

### 11. GateResult Interface

**Location:** `plugin/hooks/TYPESCRIPT.md` lines 138-151

**Description:** GateResult interface documented matches `types.ts` lines 9-20.

**Verification:** types.ts confirms interface structure.

**Action:** None needed - accurate.

### 12. Configuration Merging

**Location:** `plugin/hooks/SETUP.md` lines 57-63

**Description:** Documentation correctly describes priority: `.claude/gates.json` > `gates.json` > plugin default. Implementation in `config.ts` lines 227-243 confirms this order.

**Verification:** config.ts loads plugin first, then merges with first project config found.

**Action:** None needed - accurate.

### 13. File Pattern Matching

**Location:** `plugin/hooks/SETUP.md` lines 129-186

**Description:** Documentation describes file pattern matching using glob syntax with minimatch. Implementation in `dispatcher.ts` lines 90-147 confirms minimatch usage with documented options (`matchBase: false`, `dot: true`).

**Verification:** Implementation matches documentation.

**Action:** None needed - accurate.

### 14. MAX_GATES_PER_DISPATCH Circuit Breaker

**Location:** `plugin/hooks/ARCHITECTURE.md` lines 216-220

**Description:** Documentation mentions 10-gate limit for circuit breaker. Implementation in `dispatcher.ts` line 46 confirms `MAX_GATES_PER_DISPATCH = 10`.

**Verification:** Implementation matches documentation.

**Action:** None needed - accurate.

### 15. Known Hook Events

**Location:** `plugin/hooks/ARCHITECTURE.md` lines 224-242

**Description:** Documentation lists 11 registered hooks. Implementation in `config.ts` lines 8-24 confirms these exact events in KNOWN_HOOK_EVENTS array.

**Verification:** config.ts shows SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd ARE in KNOWN_HOOK_EVENTS (for validation), but README notes they're "not yet registered" in hooks.json. This is consistent - they're validated but hooks.json doesn't route them.

**Action:** None needed - accurate.

---

## VERIFIED ITEMS (No Issues Found)

1. **Directory Structure** - `ARCHITECTURE.md` directory tree matches actual codebase
2. **Hook Registration** - `hooks.json` routes all 11 events to CLI as documented
3. **Gate Configuration Schema** - `types.ts` GateConfig matches documentation
4. **Session State Interface** - `types.ts` SessionState matches documentation
5. **Workflow CLI Commands** - All documented commands exist in `workflow-cli.ts`
6. **Workflow State Structure** - `types.ts` WorkflowState matches documentation
7. **Task Parsing** - Parser validates sequential numbering, GOTO targets as documented
8. **Environment Variables** - TURBOSHOVEL_LOG, TURBOSHOVEL_LOG_LEVEL work as documented
9. **Log File Location** - `$TMPDIR/turboshovel/hooks-YYYY-MM-DD.log` confirmed in `logger.ts`
10. **Plugin Gate References** - Sibling convention documented and implemented in `config.ts`

---

## Assessment

**Conclusion:**
The documentation is largely accurate and comprehensive. The main issues found are:
1. Three hook events (SubagentStart, PreCompact, PermissionRequest) are documented as having context file patterns but don't have implementations in `extractNameAndStage()` - users may expect context injection that won't happen.

The workflow system documentation is particularly well-done, accurately describing the execution paradigm, CLI commands, and state management.

**Confidence in findings:**
- HIGH confidence on context injection findings - directly verified against source code
- HIGH confidence on configuration and schema verification - directly matched types and implementation
- HIGH confidence on workflow system - CLI implementation matches documentation exactly

**Files verified:**
- `/Users/tobyhede/psrc/turboshovel/CLAUDE.md`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/SETUP.md`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/CONVENTIONS.md`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/TYPESCRIPT.md`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/ARCHITECTURE.md`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/INTEGRATION_TESTS.md`

**Implementation files verified:**
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/types.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/schemas.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/config.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/dispatcher.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/context.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/session.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/logger.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/gate-loader.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/gates/index.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli/workflow-cli.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/workflow/state.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/workflow/types.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/workflow/parser/parser.ts`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks.json`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/gates.json`
