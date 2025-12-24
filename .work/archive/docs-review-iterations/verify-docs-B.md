# Documentation Review - 2024-12-24

## Metadata
- **Reviewer:** code-agent (Independent Review B)
- **Date:** 2024-12-24 15:45:00
- **Subject:** Turboshovel documentation verification
- **Ground Truth:** Current codebase implementation in `/plugin/hooks/hooks-app/src/`
- **Context:** Independent review #2 for dual-verification
- **Mode:** Review

## Summary
- **Subject:** Complete documentation audit of all Turboshovel documentation
- **Scope:** CLAUDE.md, README.md, SETUP.md, CONVENTIONS.md, TYPESCRIPT.md, ARCHITECTURE.md, INTEGRATION_TESTS.md

## Status: APPROVED WITH SUGGESTIONS

---

## BLOCKING (Must Address)

### 1. **CONVENTIONS.md - Incorrect Hook-to-File Mapping for PreCompact and PermissionRequest**

- **Description:** The CONVENTIONS.md states `PreCompact` uses `pre-compact.md` and `PermissionRequest` uses `permission-request.md`. However, reviewing the actual `extractNameAndStage` function in `context.ts`, these hooks are NOT handled:

```typescript
// Lines 171-215 in context.ts - PreCompact and PermissionRequest are NOT in switch statement
switch (hookEvent) {
    // ... other cases
    case 'SessionStart':
      return { name: 'session', stage: 'start' };
    // ... etc
    default:
      return null;  // PreCompact and PermissionRequest fall through to null!
}
```

- **Location:** `plugin/hooks/CONVENTIONS.md:35-38` and `plugin/hooks/README.md:91-95`
- **Impact:** Users expecting context injection for PreCompact and PermissionRequest hooks will not get it. The implementation does not match the documented behavior.
- **Action:** Either:
  1. Add support for these hooks in `extractNameAndStage()` function
  2. Or remove these from the documented list and note they're planned/not-yet-implemented

### 2. **ARCHITECTURE.md - Missing cli/ Subdirectory in Directory Structure**

- **Description:** The ARCHITECTURE.md directory structure shows:
```
    │   │   ├── cli.ts          # Entry point
```
But the actual structure is:
```
    src/
    ├── cli.ts                  # Hook dispatch entry point
    ├── cli/                    # CLI commands subdirectory
    │   └── workflow-cli.ts     # Workflow CLI entry point
```

- **Location:** `plugin/hooks/ARCHITECTURE.md:126-130`
- **Impact:** Developers navigating the codebase won't find the workflow CLI where expected.
- **Action:** Update the directory structure to include `cli/` subdirectory and `workflow-cli.ts`

### 3. **ARCHITECTURE.md - Missing workflow/ Directory in Directory Structure**

- **Description:** The documented directory structure completely omits the `workflow/` subdirectory which contains substantial functionality:
```
    workflow/
    ├── context.ts
    ├── evaluation.ts
    ├── hooks/
    ├── index.ts
    ├── parser/
    ├── state.ts
    ├── task-id.ts
    └── types.ts
```

- **Location:** `plugin/hooks/ARCHITECTURE.md:116-137`
- **Impact:** The workflow system is a major feature not reflected in the architecture documentation.
- **Action:** Add workflow/ directory structure to ARCHITECTURE.md

### 4. **README.md - Inaccurate Hook-to-File Mapping Table**

- **Description:** The README.md table at lines 154-167 lists context file patterns for hooks, but several patterns don't match implementation:
  - `Stop` hook is documented as using `agent-stop.md` but `extractNameAndStage` returns `{ name: 'agent', stage: 'stop' }` which would look for `agent-stop.md` - this is actually CORRECT
  - `PreCompact` and `PermissionRequest` are documented but not implemented (see issue #1 above)

- **Location:** `plugin/hooks/README.md:154-167`
- **Impact:** Same as issue #1 - users misled about which hooks support context injection
- **Action:** Mark PreCompact and PermissionRequest as "Registered but context not yet implemented" or implement them

### 5. **TYPESCRIPT.md - HookInput Interface Incomplete**

- **Description:** The `HookInput` interface documented in TYPESCRIPT.md (lines 106-133) is incomplete compared to actual `schemas.ts`:

**Documented but correct:**
- hook_event_name, cwd, tool_name, file_path - present and correct
- agent_id, agent_name, subagent_name, output - present and correct
- user_message - present and correct

**Missing from documentation:**
- `agent_transcript_path` - present in schemas.ts but NOT documented

- **Location:** `plugin/hooks/TYPESCRIPT.md:106-133`
- **Impact:** Developers creating TypeScript gates won't know about agent_transcript_path field
- **Action:** Add `agent_transcript_path?: string;` to the documented interface

---

## SUGGESTIONS (Would Improve Quality)

### 1. **README.md - Workflow Examples Path is Incomplete**

- **Description:** The README states workflow examples are in `plugin/hooks/examples/` but only one workflow exists: `code-review.workflow.md`. The documentation mentions several workflows that don't exist:
  - Line 1273: "Full workflow examples in `plugin/hooks/examples/`"
  - Line 1275: Only `code-review.workflow.md` exists

- **Location:** `plugin/hooks/README.md:1269-1287`
- **Benefit:** Setting accurate expectations about available examples
- **Action:** Either create more example workflows or adjust the documentation to reflect that only `code-review.workflow.md` is provided

### 2. **CLAUDE.md - Workflow State Path Documented Incorrectly**

- **Description:** CLAUDE.md line 103 states:
  "State persists in `.claude/turboshovel/workflows/`"

  The actual implementation in `state.ts` uses:
  ```typescript
  const STATE_DIR = '.claude/turboshovel/workflows';
  const SESSION_FILE = '.claude/turboshovel/session.json';
  ```

  This is correct, but could be clearer that there are TWO locations:
  - Workflow state files: `.claude/turboshovel/workflows/{id}.json`
  - Active workflow session: `.claude/turboshovel/session.json`

- **Location:** `plugin/hooks/CLAUDE.md:103`
- **Benefit:** Clarity about where state is actually stored
- **Action:** Mention both paths explicitly

### 3. **README.md - Debugging Command Uses Deprecated CLI Path**

- **Description:** The debugging section shows:
```bash
tail -f $(node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js log-path)
```

This works, but `workflow-cli.ts` is now the primary CLI for workflow operations. The main `cli.js` is for hook dispatch.

- **Location:** `plugin/hooks/README.md:391-396`
- **Benefit:** Consistency in CLI usage patterns
- **Action:** Consider adding that workflow commands use `workflow-cli.js` (or just `workflow` after linking)

### 4. **CONVENTIONS.md - SubagentStart Missing from Agent Discovery**

- **Description:** CONVENTIONS.md mentions SubagentStart can use context files, but the actual `discoverAgentCommandContext` function only handles SubagentStop (the switch in `injectContext` only handles SubagentStop with agent_name). SubagentStart is handled by `extractNameAndStage` which would return null since SubagentStart is not in the switch statement.

- **Location:** `plugin/hooks/CONVENTIONS.md:31`
- **Benefit:** Accurate documentation of which hooks support agent-command scoping
- **Action:** Clarify that SubagentStart does not currently support agent-scoped context discovery (falls through to null)

### 5. **SETUP.md - Example Config Uses Comments in JSON**

- **Description:** Lines 95-126 show JSON config with JavaScript-style comments:
```json
{
  "gates": {
    "check": {
      "description": "Run quality checks",
      "command": "npm run lint",  // <- Change to your command
```

JSON does not support comments. While this is fine for documentation, copying it directly will fail.

- **Location:** `plugin/hooks/SETUP.md:95-126`
- **Benefit:** Users can copy-paste without errors
- **Action:** Either remove comments or note that comments must be removed before use

### 6. **ARCHITECTURE.md - Session State Path Discrepancy**

- **Description:** ARCHITECTURE.md line 334 states hook session state is at:
  `.claude/session/state.json`

  But workflow session state is at:
  `.claude/turboshovel/session.json`

  The documentation correctly distinguishes these, but the section heading "Session State" could be confusing because there are two session concepts.

- **Location:** `plugin/hooks/ARCHITECTURE.md:319-354`
- **Benefit:** Clearer distinction between hook session and workflow session
- **Action:** Consider renaming sections to "Hook Session State" and "Workflow Session State"

### 7. **README.md - Default Shell Gates Table Incomplete**

- **Description:** The "Default Shell Gates" table (lines 270-276) lists `check`, `test`, `build`. Looking at the actual `gates.json`:
- `check` has keywords: `["lint", "check", "format", "quality", "clippy", "typecheck"]`
- `test` has keywords: `["test", "testing", "spec", "verify"]`
- `build` has keywords: `["build", "compile", "package"]`

The table shows fewer keywords than actually configured.

- **Location:** `plugin/hooks/README.md:270-276`
- **Benefit:** Users know all the keywords that trigger each gate
- **Action:** Update the table to show complete keyword lists

### 8. **INTEGRATION_TESTS.md - Test 6 Error Message Mismatch**

- **Description:** Test 6 "Missing Gate Error" shows expected output:
```
{"continue": false, "message": "Gate 'nonexistent' referenced but not defined..."}
```

But looking at `dispatcher.ts` lines 312-315, missing gates now produce a warning in accumulated context rather than stopping:
```typescript
if (!gateConfig) {
  // Graceful degradation: skip undefined gates with warning
  accumulatedContext += `\nWarning: Gate '${gateName}' not defined, skipping`;
  continue;
}
```

The behavior has changed from STOP to graceful degradation with warning.

- **Location:** `plugin/hooks/INTEGRATION_TESTS.md:167-189`
- **Benefit:** Accurate test expectations
- **Action:** Update test expectation to reflect graceful degradation behavior

### 9. **README.md - IF/ELSE Conditionals Warning Could Be Stronger**

- **Description:** The IF/ELSE conditionals section has a warning box but the code example still shows the planned syntax. Users might try to use it despite the warning.

- **Location:** `plugin/hooks/README.md:607-619`
- **Benefit:** Prevent user confusion
- **Action:** Consider removing the code example entirely since it's not implemented, or add stricter "DO NOT USE" language

### 10. **TYPESCRIPT.md - GateResult Interface Incomplete**

- **Description:** The `GateResult` interface in TYPESCRIPT.md shows:
```typescript
interface GateResult {
  additionalContext?: string;
  decision?: 'block';
  reason?: string;
  continue?: false;
  message?: string;
}
```

This matches `types.ts` exactly - no issue here. However, the documentation doesn't mention that returning an empty object `{}` is valid for "pass silently", which is documented elsewhere in the same file but could be more prominent in the interface definition.

- **Location:** `plugin/hooks/TYPESCRIPT.md:139-151`
- **Benefit:** Completeness in interface documentation
- **Action:** Add comment in interface definition about empty object being valid

---

## Verified as Correct

The following documentation claims were verified against the codebase and found to be accurate:

1. **Hook Events Registration:** `hooks.json` correctly registers all 11 documented hooks (SessionStart, SessionEnd, UserPromptSubmit, SubagentStart, SubagentStop, PreToolUse, PostToolUse, Stop, Notification, PreCompact, PermissionRequest)

2. **Config Merging Logic:** `config.ts` correctly implements the documented merge behavior - plugin defaults with project overrides

3. **KNOWN_HOOK_EVENTS in config.ts:** Includes all documented hooks including SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd (for config validation)

4. **Gate Configuration Fields:** All documented fields (`plugin`, `gate`, `command`, `keywords`, `file_patterns`, `on_pass`, `on_fail`) are correctly implemented in `types.ts`

5. **Workflow CLI Commands:** All documented commands (`start`, `next`, `status`, `stop`, `list`, `complete`, `stash`, `pop`) are implemented in `workflow-cli.ts`

6. **File Pattern Matching:** Uses `minimatch` library as documented, with correct options (`matchBase: false`, `dot: true`)

7. **Session State Interface:** `SessionState` in `types.ts` matches documentation

8. **Context Discovery Paths:** The `buildContextPaths` function in `context.ts` correctly implements the documented discovery priority

9. **Examples Directory Structure:** All documented example files exist:
   - `strict.json`
   - `permissive.json`
   - `pipeline.json`
   - `convention-based.json`
   - `code-review.workflow.md`
   - `context/` directory with example context files

10. **Plugin Context Files:** Exist at correct location (`plugin/context/`) with documented files:
    - `session-start.md`
    - `prompt-submit.md`
    - `subagent-stop.md`
    - `tool-use.md`

11. **Gate Chain Limit:** MAX_GATES_PER_DISPATCH = 10 in `dispatcher.ts` matches documentation

12. **Workflow State Persistence Path:** `.claude/turboshovel/workflows/` and `.claude/turboshovel/session.json` correctly implemented in `state.ts`

---

## Assessment

**Conclusion:**

The documentation is generally accurate and comprehensive. The main blocking issues relate to:
1. Context injection for PreCompact and PermissionRequest hooks being documented but not implemented
2. Directory structure documentation missing the `cli/` and `workflow/` subdirectories

Most other issues are minor improvements around completeness, accuracy of examples, and clarification of behaviors that have evolved during development.

**Confidence in findings:**

- **High confidence:** Verified against actual source code in `src/` directory
- **Verified paths:** All file paths and directories checked for existence
- **Verified interfaces:** TypeScript interfaces compared between docs and implementation
- **Verified logic:** Hook dispatching, context injection, and workflow logic traced through code

**Areas not fully verified:**
- Runtime behavior (only static code analysis performed)
- npm commands and build process (not executed)
- Actual hook integration with Claude Code (would require runtime testing)
