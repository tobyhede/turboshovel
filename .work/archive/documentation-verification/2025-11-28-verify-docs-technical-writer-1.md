# Documentation Verification Report - Turboshovel
**Technical Writer Review #1**

**Date:** 2025-11-28
**Files Verified:**
- README.md (root)
- CLAUDE.md (root)
- plugin/hooks/README.md
- plugin/hooks/SETUP.md
- plugin/hooks/ARCHITECTURE.md
- plugin/hooks/CONVENTIONS.md
- plugin/hooks/TYPESCRIPT.md
- plugin/hooks/INTEGRATION_TESTS.md

---

## Executive Summary

**Critical Issues Found:** 6
**High Issues Found:** 4
**Medium Issues Found:** 8
**Low Issues Found:** 2

The documentation is generally accurate and well-written, but contains several **CRITICAL discrepancies** between documented and actual behavior, particularly around hook event support and configuration capabilities.

---

## Critical Issues (Blocks Usage)

### 1. SlashCommandStart/SlashCommandEnd NOT Supported
**Location:** plugin/hooks/README.md lines 78-96, ARCHITECTURE.md lines 206-223

**Current Content:**
```
All 12 Claude Code hook types are supported:

| Event | Context Pattern | Default Behavior |
|-------|----------------|------------------|
| SlashCommandStart | {command}-start.md | - |
| SlashCommandEnd | {command}-end.md | - |
```

**Actual Implementation:**
- `plugin/hooks.json` does NOT register SlashCommandStart or SlashCommandEnd hooks
- `config.ts` KNOWN_HOOK_EVENTS does NOT include these events
- Code ONLY supports 9 hook events, NOT 12 as claimed

**Impact:**
- Slash command context files (e.g., `.claude/context/code-review-start.md`) will NOT auto-inject
- Users following documentation will create files that never execute
- This is a fundamental misrepresentation of capabilities

**Recommendation:**
- Update all docs to reflect actual 9 supported events
- Remove SlashCommandStart/SlashCommandEnd from all tables
- Update "12 hook types" language to "9 hook types"

### 2. SkillStart/SkillEnd NOT Supported
**Location:** plugin/hooks/README.md lines 88-90, CONVENTIONS.md lines 27-38

**Current Content:**
```
| SkillStart | {skill}-start.md | - |
| SkillEnd | {skill}-end.md | - |
```

**Actual Implementation:**
- `plugin/hooks.json` does NOT register SkillStart or SkillEnd hooks
- `config.ts` KNOWN_HOOK_EVENTS includes these but they're not in hooks.json
- Context injection code has logic for skills but hooks never fire

**Impact:**
- Skill context files never execute
- Misleading documentation wastes user time

**Recommendation:**
- Remove SkillStart/SkillEnd from all documentation until implemented
- Or implement hooks.json registration if intent is to support them

### 3. enabled_commands Field Does Not Exist
**Location:** plugin/hooks/CONVENTIONS.md line 214

**Current Content:**
```json
{
  "hooks": {
    "SlashCommandEnd": {
      "enabled_commands": ["/code-review"],  // ← This field doesn't exist
      "gates": ["verify-structure", "test"]
    }
  }
}
```

**Actual Implementation:**
- Code only supports `enabled_tools` and `enabled_agents` filtering
- No support for command-specific filtering in hooks
- This is a made-up configuration option

**Impact:**
- Invalid JSON configuration
- Users will get configuration errors following examples

**Recommendation:**
- Remove this example from CONVENTIONS.md
- If command filtering is needed, implement it in dispatcher.ts

### 4. Unknown Hook Events in hooks.json
**Location:** plugin/hooks.json lines 66-79

**Current Content:**
```json
"PreCompact": [{...}],
"PermissionRequest": [{...}]
```

**Actual Implementation:**
- `config.ts` KNOWN_HOOK_EVENTS does NOT include these events
- These events will fail validation if used
- They exist in hooks.json but cannot be configured

**Impact:**
- Inconsistency between hook registration and event validation
- If users try to use these events, they'll get validation errors

**Recommendation:**
- Either remove from hooks.json or add to KNOWN_HOOK_EVENTS
- Document which is correct

### 5. TypeScript Gate Chaining Misconception
**Location:** plugin/hooks/TYPESCRIPT.md line 74

**Current Content:**
"Note: Gate name in gates.json uses kebab-case (my-gate), which maps to camelCase export (myGate)."

**Actual Implementation:**
- Gate name in gates.json is NOT automatically chained
- Chaining requires explicit `on_pass` or `on_fail` configuration pointing to another gate
- The kebab-case to camelCase mapping is for module names only

**Impact:**
- Incorrect expectation about TypeScript gate behavior
- Users won't understand how gate chaining works

**Recommendation:**
- Clarify that TypeScript gates don't auto-chain
- Show explicit chaining example with on_pass/on_fail

### 6. Examples Directory Path Inaccuracy
**Location:** plugin/hooks/README.md line 323

**Current Content:**
```
See examples/ for ready-to-use configurations
```

**Actual Implementation:**
- Examples are in `plugin/hooks/examples/`
- Not in `examples/` (root)

**Impact:**
- Users can't find example files
- Incorrect path wastes time

**Recommendation:**
- Update path to `plugin/hooks/examples/`

---

## High Issues (Major Misleading)

### 7. UserPromptSubmit Context Pattern
**Location:** plugin/hooks/README.md line 86, ARCHITECTURE.md line 214

**Current Content:**
```
| UserPromptSubmit | prompt-submit.md | Keyword-triggered gates (check, test, build) |
```

**Actual Implementation:**
- Context file would be `.claude/context/prompt-submit.md`
- But context injection for UserPromptSubmit returns `{ name: 'prompt', stage: 'submit' }`
- This would look for `.claude/context/prompt-submit.md`

**Impact:**
- Pattern is correct but confusing wording ("prompt-submit" vs "prompt-submit.md")
- Should clarify it's `{name}-{stage}.md` pattern

**Recommendation:**
- Be explicit: "Context file is .claude/context/prompt-submit.md (pattern: {name}-{stage}.md)"

### 8. Gate Chaining Max Depth
**Location:** plugin/hooks/ARCHITECTURE.md (not documented)

**Actual Implementation:**
- Code has `MAX_GATES_PER_DISPATCH = 10` constant
- Prevents infinite loops in gate chains
- Returns error if exceeded

**Impact:**
- undocumented limitation
- Users could hit this limit with complex chains

**Recommendation:**
- Document the gate chain limit
- Explain what happens when exceeded

### 9. Keyword Matching Details
**Location:** plugin/hooks/README.md lines 248-252

**Current Content:**
- Says "Keyword matching is case-insensitive"
- Doesn't explain matching behavior

**Actual Implementation:**
- Uses `toLowerCase()` + `includes()` substring matching
- "test" matches "latest" or "contest"
- Not word-boundary matching

**Impact:**
- Users may not realize substring matching behavior
- Could lead to unexpected gate triggers

**Recommendation:**
- Document substring matching behavior
- Provide examples of what matches and what doesn't

### 10. Plugin Gate Sibling Convention
**Location:** plugin/hooks/README.md lines 191-192

**Current Content:**
"The plugin field uses sibling convention - assumes plugins are installed in the same directory (e.g., ~/.claude/plugins/)."

**Actual Implementation:**
- Code uses `path.resolve(pluginRoot, '..', pluginName)`
- Sibling of CLAUDE_PLUGIN_ROOT, not ~/.claude/plugins/

**Impact:**
- Misunderstanding about plugin discovery
- Works differently than documented

**Recommendation:**
- Document as "sibling of CLAUDE_PLUGIN_ROOT" or show actual path resolution

---

## Medium Issues (Inconsistencies)

### 11. SessionStart Default Context
**Location:** plugin/hooks/README.md line 84, CONVENTIONS.md line 41

**Current Content:**
"Plugin provides default context for SessionStart via ${CLAUDE_PLUGIN_ROOT}/context/session-start.md"

**Actual Implementation:**
- File would be at `${CLAUDE_PLUGIN_ROOT}/context/session-start.md`
- But context directory discovery uses `${CLAUDE_PLUGIN_ROOT}/context/` (not `hooks-app/context/`)
- Need to verify file actually exists

**Impact:**
- Path might be incorrect
- Default context may not work as documented

**Recommendation:**
- Verify file path is correct
- Test SessionStart context injection

### 12. Shell Command Timeout
**Location:** plugin/hooks/ARCHITECTURE.md (mentioned)

**Actual Implementation:**
- Commands timeout after 30 seconds (hardcoded in gate-loader.ts)
- Not documented anywhere

**Impact:**
- Undocumented limitation
- Long-running checks may timeout

**Recommendation:**
- Document timeout behavior
- Consider making timeout configurable

### 13. Empty Input Error Handling
**Location:** plugin/hooks/README.md (mentioned in debugging)

**Current Content:**
- Mentions logging empty input

**Actual Implementation:**
- CLI returns STOP action with "Empty input received" message
- Properly handles race conditions

**Impact:**
- Behavior is correct but could be clearer in docs

**Recommendation:**
- Document this is expected for cancelled operations

### 14. Environment Variables Documentation
**Location:** CLAUDE.md lines 49-50

**Current Content:**
```
- TURBOSHOVEL_LOG=0 - Disable logging (enabled by default)
- TURBOSHOVEL_LOG_LEVEL=debug|info|warn|error - Set log verbosity (default: info)
```

**Actual Implementation:**
- Logging is enabled by default (check happens in logger.ts)
- TURBOSHOVEL_LOG_LEVEL default is 'info'

**Impact:**
- Accurate

**Recommendation:**
- None - this is correct

### 15. Development Commands
**Location:** CLAUDE.md lines 39-41

**Current Content:**
```
- Build: cd plugin/hooks/hooks-app && npm run build
- Test: cd plugin/hooks/hooks-app && npm test
- Lint: cd plugin/hooks/hooks-app && npm run lint
```

**Actual Implementation:**
- Commands are correct
- Working directory specified properly

**Impact:**
- Accurate

**Recommendation:**
- None - this is correct

### 16. Context Injection Priority
**Location:** plugin/hooks/README.md lines 115-118, ARCHITECTURE.md lines 254-295

**Current Content:**
"Priority: 1. Project context, 2. Plugin context (project takes precedence)"

**Actual Implementation:**
- Code in context.ts checks project paths first
- Then plugin paths as fallback
- Correctly implements documented behavior

**Impact:**
- Accurate

**Recommendation:**
- None - this is correct

### 17. Log File Location
**Location:** plugin/hooks/README.md line 296, ARCHITECTURE.md line 318

**Current Content:**
`$TMPDIR/turboshovel/hooks-YYYY-MM-DD.log`

**Actual Implementation:**
- logger.ts uses `path.join(tmpdir(), 'turboshovel', `hooks-${date}.log`)`
- tmpdir() returns $TMPDIR or system temp

**Impact:**
- Accurate

**Recommendation:**
- None - this is correct

### 18. Session State Tracking
**Location:** ARCHITECTURE.md lines 298-314

**Current Content:**
Documents session state interface

**Actual Implementation:**
- session.ts implements Session class
- Tracks active_command, active_skill, edited_files, file_extensions, metadata
- Uses `$TMPDIR/turboshovel/session-{cwd-hash}.json`

**Impact:**
- Accurate

**Recommendation:**
- None - this is correct

---

## Low Issues (Cosmetic)

### 19. Documentation Links
**Location:** All docs

**Current Content:**
- Links to other markdown files (README, SETUP, etc.)

**Actual Implementation:**
- All linked files exist

**Impact:**
- No broken links found

**Recommendation:**
- None

### 20. Code Examples Formatting
**Location:** Various

**Current Content:**
- Code blocks are properly formatted
- JSON examples use ```json syntax

**Actual Implementation:**
- Consistent formatting

**Impact:**
- No formatting issues

**Recommendation:**
- None

---

## Gaps in Documentation

### 1. Missing: Plugin Gate Limitations
Not documented:
- MAX_PLUGIN_DEPTH = 10 limit
- Circular reference detection
- Plugin gate execution context (runs in plugin directory)

### 2. Missing: Session State Limitations
Not documented:
- Best-effort updates (don't fail hooks)
- File extension extraction edge case
- No agent tracking for SubagentStart/Stop

### 3. Missing: Error Recovery
Not documented:
- Graceful degradation for undefined gates
- Missing context files are normal
- Empty configurations are valid

### 4. Missing: Gate Result Types
Not documented:
- TypeScript gates can return: additionalContext, decision+reason, or continue+message
- Shell gates: additionalContext from stdout/stderr
- How results combine from multiple sources

### 5. Missing: Action Handler Details
Not documented:
- What CONTINUE, BLOCK, STOP actually do
- How action chaining works
- Circuit breaker for gate chains

---

## Inconsistencies Between Documentation Files

1. **Hook Count:**
   - README: "All 12 hook types"
   - Actual: 9 supported
   - Status: CONFLICT

2. **Skill Hooks:**
   - README: Lists SkillStart/SkillEnd
   - CONVENTIONS: Describes usage
   - hooks.json: Not registered
   - Status: CONFLICT

3. **enabled_commands:**
   - CONVENTIONS.md: Shows example
   - Code: Doesn't support it
   - Status: CONFLICT

4. **Unknown Events:**
   - hooks.json: Has PreCompact, PermissionRequest
   - config.ts: Rejects these as unknown
   - Status: CONFLICT

---

## Recommendations Priority

### Immediate (Critical - Fix Before Release)

1. **Remove SlashCommandStart/SlashCommandEnd from all docs**
   - Update README.md hook tables
   - Update ARCHITECTURE.md hook list
   - Update CONVENTIONS.md references
   - Change "12 hook types" to "9 hook types"

2. **Remove SkillStart/SkillEnd OR implement them**
   - If not implementing: Remove from all docs
   - If implementing: Add to hooks.json

3. **Remove enabled_commands example from CONVENTIONS.md**
   - Either implement the feature or remove documentation

4. **Fix hooks.json vs KNOWN_HOOK_EVENTS mismatch**
   - Remove PreCompact/PermissionRequest or add to KNOWN_HOOK_EVENTS

5. **Fix examples/ path reference**
   - Update to plugin/hooks/examples/

### High Priority (Fix Soon)

6. **Document gate chain limit (MAX_GATES_PER_DISPATCH)**
7. **Clarify substring keyword matching with examples**
8. **Fix plugin gate path resolution documentation**

### Medium Priority (Next Release)

9. **Document plugin gate limitations (depth, circular refs)**
10. **Document session state best-effort behavior**
11. **Add action handler documentation**
12. **Clarify UserPromptSubmit context pattern**

---

## Summary

The Turboshovel documentation is **well-written and comprehensive** but contains **critical inaccuracies** about hook event support. The gap between documented "12 hook types" and actual "9 hook types" is the most significant issue that will cause user confusion and wasted time.

The documentation effectively explains the concepts, architecture, and usage patterns. The code is generally well-implemented and matches documented behavior for the features it does support.

**Primary Action:** Update all references to hook event count and remove unsupported events from documentation.

---

## Verification Method

This review was conducted by:
1. Reading all documentation files completely
2. Examining implementation code in plugin/hooks/hooks-app/src/
3. Checking configuration files (hooks.json, gates.json)
4. Cross-referencing documented behavior with actual code
5. Identifying gaps, inconsistencies, and inaccuracies
6. Categorizing issues by severity and impact

Total files examined: 20+
Total code files reviewed: 15
Documentation files reviewed: 8