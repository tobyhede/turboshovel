# Collated Review Report - Documentation Review

## Metadata
- **Review Type:** Documentation Review
- **Date:** 2025-12-24 17:15:00
- **Reviewers:** technical-writer (Agent A), technical-writer (Agent B)
- **Subject:** Turboshovel project documentation (CLAUDE.md, README.md, ARCHITECTURE.md, CONVENTIONS.md, INTEGRATION_TESTS.md, SETUP.md, TYPESCRIPT.md)
- **Review Files:**
  - Review #1: `/Users/tobyhede/psrc/turboshovel/.work/documentation-review/2025-12-24-verify-docs-A.md`
  - Review #2: `/Users/tobyhede/psrc/turboshovel/.work/documentation-review/2025-12-24-verify-docs-B-125431.md`
- **Cross-check Status:** COMPLETE (divergences verified during collation)
- **Cross-check File:** N/A (inline verification performed)

## Executive Summary
- **Total unique issues identified:** 14
- **Common issues (VERY HIGH confidence):** 3
- **Exclusive issues (pending cross-check):** 11
  - VALIDATED: 8 (confirmed)
  - INVALIDATED: 1 (can skip)
  - UNCERTAIN: 2 (user decides)
- **Divergences (resolved during collation):** 2

**Overall Status:** APPROVED WITH CHANGES
**Revise Ready:** all (cross-check complete)

---

## Common Issues (High Confidence)
Both reviewers independently found these issues.

**Confidence: VERY HIGH** - Both reviewers found these issues independently, making them very likely to be real problems.

### BLOCKING / CRITICAL

None - Both agents classified common issues as NON-BLOCKING/SUGGESTIONS

### NON-BLOCKING / LOWER PRIORITY

**[C1] ARCHITECTURE.md references non-existent "commands" gate**
- **Reviewer #1 finding:** BLOCKING-2 - Lines 69-84 show "commands" gate that doesn't exist in gates.json. Impact: users confused.
- **Reviewer #2 finding:** S1 - Example references "commands" gate which does not exist. Demonstrative but misleading.
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** NON-BLOCKING (documentation example issue, not functional)
- **Location:** ARCHITECTURE.md lines 69-84, 191-193, 264
- **Action required:** Update example to use actual `plugin-path` gate:
  ```json
  {
    "gates": {
      "plugin-path": {
        "description": "Verify plugin path resolution",
        "on_pass": "CONTINUE",
        "on_fail": "CONTINUE"
      }
    }
  }
  ```

**[C2] TYPESCRIPT.md HookInput interface is incomplete**
- **Reviewer #1 finding:** SUGGESTION-1 - Missing fields from actual schemas.ts implementation
- **Reviewer #2 finding:** S2 - Interface documented differs from actual implementation
- **Confidence:** VERY HIGH (both found independently)
- **Benefit:** More accurate API documentation for gate developers
- **Location:** TYPESCRIPT.md lines 104-127
- **Action required:** Add missing fields:
  ```typescript
  agent_id?: string;
  agent_transcript_path?: string;
  tool_input?: {
    description?: string;
    subagent_type?: string;
    prompt?: string;
  };
  ```

**[C3] README.md workflow examples: --step vs --task flag confusion**
- **Reviewer #1 finding:** SUGGESTION-2 - Distinction between --step and --task could be clearer
- **Reviewer #2 finding:** S3 - Examples at lines 1087, 1149, 1206 use --task where --step should be used
- **Confidence:** VERY HIGH (both identified related issues)
- **Benefit:** Users can correctly use CLI for step jumps
- **Action required:**
  1. Fix incorrect `--task` to `--step` in workflow examples
  2. Add explicit clarification: "--step N jumps to workflow step N. --task is for parallel subtask IDs like 3.A, 3.B"

---

## Exclusive Issues (Pending Cross-check)
Only one reviewer found these issues. Cross-check validates against ground truth.

**Confidence: MODERATE** - One reviewer found these. Cross-check validates whether they actually apply.

**Cross-check Status:** COMPLETE

### Found by Reviewer #1 Only

#### BLOCKING / CRITICAL

**[E1-A] config.ts KNOWN_HOOK_EVENTS missing registered hooks**
- **Found by:** Reviewer #1 (BLOCKING-1)
- **Description:** config.ts missing SubagentStart, PreCompact, PermissionRequest from KNOWN_HOOK_EVENTS array, though they ARE registered in hooks.json
- **Severity:** BLOCKING (as classified by Agent A)
- **Reasoning:** Configuration validation will reject valid hook events
- **Confidence:** MODERATE -> VALIDATED with caveat
- **Cross-check:** VALIDATED (but reclassified as CODE BUG, not DOCUMENTATION issue)
- **Evidence:**
  - hooks.json registers 11 hooks including SubagentStart (line 24), PreCompact (line 66), PermissionRequest (line 73)
  - config.ts KNOWN_HOOK_EVENTS (lines 8-21) has 12 entries but is missing these 3
  - config.ts includes SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd which are NOT in hooks.json
  - **IMPORTANT:** ARCHITECTURE.md (lines 217-231) correctly documents all 11 hooks - the documentation is CORRECT
  - This is a CODE BUG in config.ts, not a documentation inaccuracy
- **Recommendation:** Fix config.ts to match hooks.json. This is implementation work, not documentation work.

**[E2-A] ARCHITECTURE.md directory structure path notation confusing**
- **Found by:** Reviewer #1 (BLOCKING-3)
- **Description:** Directory structure at line 103 shows `../context/` which is unusual for a directory tree
- **Severity:** BLOCKING (as classified by Agent A)
- **Reasoning:** Users may not find context files at expected location
- **Confidence:** MODERATE -> UNCERTAIN
- **Cross-check:** UNCERTAIN
- **Evidence:**
  - The path `../context/` is technically correct from plugin/hooks/ perspective
  - Directory trees normally show full paths, not relative `../` notation
  - Presentation is unconventional but not incorrect
- **Recommendation:** User decides - this is a style/clarity preference. Could restructure tree to show full plugin/ directory.

#### NON-BLOCKING / LOWER PRIORITY

**[E3-A] CONVENTIONS.md SlashCommand/Skill hooks status unclear**
- **Found by:** Reviewer #1 (SUGGESTION-3)
- **Description:** Lines 40-43 say hooks are "planned (not yet registered)" but they ARE in config.ts KNOWN_HOOK_EVENTS
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> VALIDATED
- **Cross-check:** VALIDATED
- **Evidence:** SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd are in config.ts but NOT in hooks.json
- **Recommendation:** Reword to: "recognized by config validation but not yet registered in hooks.json for Claude Code routing"

**[E4-A] SETUP.md config loading behavior clarification**
- **Found by:** Reviewer #1 (SUGGESTION-4)
- **Description:** Lines 58-62 imply priority fallthrough, but only first project config found is loaded
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> VALIDATED
- **Cross-check:** VALIDATED
- **Evidence:** config.ts line 239 has `break;` - only first project config is loaded
- **Recommendation:** Clarify that only FIRST project config (.claude/gates.json OR gates.json, not both) is loaded

**[E5-A] README.md missing documentation of default shell gates**
- **Found by:** Reviewer #1 (SUGGESTION-5)
- **Description:** Built-in gates table only shows plugin-path; gates.json also has check, test, build
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> VALIDATED
- **Cross-check:** VALIDATED
- **Evidence:** gates.json lines 8-28 define check, test, build with placeholder commands
- **Recommendation:** Add section explaining default shell gates with placeholder commands

**[E6-A] ARCHITECTURE.md session state stashing not documented**
- **Found by:** Reviewer #1 (SUGGESTION-6)
- **Description:** types.ts SessionState has stashedWorkflowId, but ARCHITECTURE.md session section doesn't document it
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> VALIDATED
- **Cross-check:** VALIDATED
- **Evidence:** Workflow stash/pop commands exist in CLI
- **Recommendation:** Add note about workflow stashing capability

**[E7-A] INTEGRATION_TESTS.md test examples need update**
- **Found by:** Reviewer #1 (SUGGESTION-7)
- **Description:** Test examples assume specific gates.json structure that differs from actual
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> VALIDATED
- **Cross-check:** VALIDATED
- **Evidence:** gates.json line 39 shows `enabled_agents: []` not `["rust-agent"]`
- **Recommendation:** Update test setup examples to match actual configuration

**[E8-A] Context file naming uses lowercase, docs show capitalized**
- **Found by:** Reviewer #1 (SUGGESTION-8)
- **Description:** context.ts lowercases tool names (Edit -> edit), but CONVENTIONS.md shows Edit-pre.md
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> VALIDATED
- **Cross-check:** VALIDATED
- **Evidence:** context.ts lines 188-192 lowercase transformation
- **Recommendation:** Update CONVENTIONS.md examples to use lowercase: edit-pre.md, edit-post.md

**[E9-A] CLAUDE.md should document all 11 registered hooks**
- **Found by:** Reviewer #1 (SUGGESTION-9)
- **Description:** Features section mentions hooks but doesn't list all 11
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> UNCERTAIN
- **Cross-check:** UNCERTAIN
- **Evidence:** CLAUDE.md is meant to be concise; full list is in ARCHITECTURE.md
- **Recommendation:** User decides - may be intentionally brief

**[E10-A] README.md workflow CLI path clarification**
- **Found by:** Reviewer #1 (SUGGESTION-10)
- **Description:** Shows full node path but after npm link, just `workflow` works
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> VALIDATED
- **Cross-check:** VALIDATED
- **Evidence:** package.json defines bin.workflow
- **Recommendation:** Clarify that after `npm link`, command is simply `workflow start <file>`

### Found by Reviewer #2 Only

#### BLOCKING / CRITICAL

None

#### NON-BLOCKING / LOWER PRIORITY

**[E1-B] CONVENTIONS.md example uses unregistered SlashCommandEnd hook**
- **Found by:** Reviewer #2 (S4)
- **Description:** Example at lines 217-224 uses SlashCommandEnd which is marked as "not yet registered"
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> VALIDATED
- **Cross-check:** VALIDATED
- **Evidence:** SlashCommandEnd is in config.ts but not in hooks.json
- **Recommendation:** Use SubagentStop or PostToolUse in example, or add note that this is planned feature

**[E2-B] Logger source code JSDoc is outdated**
- **Found by:** Reviewer #2 (S5)
- **Description:** Logger.ts JSDoc says "Enable logging: TURBOSHOVEL_LOG=1" but default is enabled
- **Severity:** NON-BLOCKING
- **Confidence:** MODERATE -> INVALIDATED
- **Cross-check:** INVALIDATED
- **Evidence:** This is a source code comment issue, not a documentation file issue. Out of scope for documentation review.
- **Recommendation:** Skip (code comment, not documentation)

---

## Divergences (Requires Investigation)
Reviewers disagree or have contradictory findings.

**Confidence: INVESTIGATE** - Reviewers have different conclusions. Verification analysis included.

**[D1] Severity of "commands" gate issue**
- **Reviewer #1 perspective:** BLOCKING-2 - Users will be confused when following documentation
- **Reviewer #2 perspective:** S1 (NON-BLOCKING) - Demonstrative but misleading, just update example
- **Verification Analysis:**
  - **Verifying agent:** Collator inline verification
  - **Correct perspective:** Reviewer #2 (NON-BLOCKING)
  - **Reasoning:** The "commands" gate is an example in architecture documentation. Users won't configure gates by copying examples verbatim - they configure based on their needs. The confusion is limited to understanding the example, not using the system.
  - **Recommendation:** Classify as NON-BLOCKING, update example to use actual gate
- **Confidence:** RESOLVED
- **Action required:** Update ARCHITECTURE.md example (NON-BLOCKING)

**[D2] config.ts hook validation issue: documentation or code bug?**
- **Reviewer #1 perspective:** BLOCKING-1 - Documentation/code mismatch, config.ts needs updating
- **Reviewer #2 perspective:** Did not flag (verified hooks.json has all 11 hooks correctly)
- **Verification Analysis:**
  - **Verifying agent:** Collator inline verification against ground truth
  - **Correct perspective:** Agent A found a real issue, but it's a CODE BUG not a DOCUMENTATION issue
  - **Reasoning:**
    - ARCHITECTURE.md (lines 217-231) correctly lists all 11 hooks
    - hooks.json correctly registers all 11 hooks
    - config.ts KNOWN_HOOK_EVENTS is the only place with the mismatch
    - The DOCUMENTATION is accurate; the CODE has a bug
    - This is out of scope for documentation review
  - **Recommendation:** Escalate as code fix task, not documentation fix
- **Confidence:** RESOLVED
- **Action required:** Create separate code fix task for config.ts (out of scope for doc review)

---

## Recommendations

### Immediate Actions -> `/revise common`
Common issues - both reviewers found them with VERY HIGH confidence. Can start immediately.

- [ ] **[C1] ARCHITECTURE.md "commands" gate:** Replace with `plugin-path` gate example
- [ ] **[C2] TYPESCRIPT.md HookInput:** Add missing interface fields from schemas.ts
- [ ] **[C3] README.md --step/--task:** Fix incorrect flag usage in workflow examples

### After Cross-check -> `/revise exclusive`
Exclusive issues - cross-check validation complete.

**VALIDATED (implement):**
- [ ] **[E3-A] CONVENTIONS.md hooks status** (Reviewer #1): Clarify SlashCommand/Skill hooks are recognized but not registered
- [ ] **[E4-A] SETUP.md config loading** (Reviewer #1): Clarify only first project config is loaded
- [ ] **[E5-A] README.md default gates** (Reviewer #1): Document check, test, build placeholder gates
- [ ] **[E6-A] ARCHITECTURE.md stashing** (Reviewer #1): Document workflow stash capability
- [ ] **[E7-A] INTEGRATION_TESTS.md examples** (Reviewer #1): Update to match actual configuration
- [ ] **[E8-A] CONVENTIONS.md lowercase** (Reviewer #1): Use lowercase tool names in examples
- [ ] **[E10-A] README.md CLI path** (Reviewer #1): Clarify `workflow` command after npm link
- [ ] **[E1-B] CONVENTIONS.md SlashCommandEnd** (Reviewer #2): Use registered hook in example

**INVALIDATED (skip):**
- [ ] ~~**[E2-B] Logger JSDoc**~~ (Reviewer #2): Source code comment, not documentation file
  - Reason: Out of scope for documentation review

**UNCERTAIN (user decides):**
- [ ] **[E2-A] ARCHITECTURE.md directory path** (Reviewer #1): `../context/` notation unconventional but correct
  - Context: Style preference - could restructure to show full plugin/ directory
- [ ] **[E9-A] CLAUDE.md hook list** (Reviewer #1): May be intentionally brief
  - Context: Full list exists in ARCHITECTURE.md; CLAUDE.md is meant to be concise

### For Consideration (NON-BLOCKING)
All issues in this review are improvements for documentation clarity.

### Divergences (Resolved)
- [x] **[D1] "commands" gate severity:** Resolved as NON-BLOCKING
  - Resolution: Reviewer #2 perspective correct - update example, not blocking
- [x] **[D2] config.ts hook validation:** Resolved as OUT OF SCOPE
  - Resolution: This is a code bug, not documentation issue. Docs are correct.
  - Action: Create separate task to fix config.ts KNOWN_HOOK_EVENTS

---

## Overall Assessment

**Ready to proceed?** YES (WITH CHANGES)

**Reasoning:**
Both reviewers concluded APPROVED WITH SUGGESTIONS. The documentation is largely accurate and well-maintained. All identified issues are improvements for clarity and completeness rather than fundamental accuracy problems.

The only truly significant finding (config.ts KNOWN_HOOK_EVENTS mismatch) is a code bug, not a documentation issue. The documentation correctly describes the 11 hooks that should be supported.

**Critical items requiring attention:**
- [CODE BUG - separate task] config.ts KNOWN_HOOK_EVENTS missing SubagentStart, PreCompact, PermissionRequest
- [DOC FIX] ARCHITECTURE.md "commands" gate example should use actual gate

**Confidence level:**
- **High confidence issues (common):** 3 issues - both reviewers found independently, definitely address
- **Moderate confidence issues (exclusive):** 8 VALIDATED, 1 INVALIDATED, 2 UNCERTAIN
- **Investigation required (divergences):** 2 divergences - both resolved during collation

---

## Next Steps

### Parallel Workflow (Recommended)

1. **Now:** `/revise common` - Implement 3 common issues immediately
2. **Now:** `/revise exclusive` - Implement 8 validated exclusive issues
3. **Separate:** Create code fix task for config.ts KNOWN_HOOK_EVENTS bug
4. **User review:** Decide on 2 UNCERTAIN issues (directory path notation, CLAUDE.md brevity)

### Code Bug Task (Out of Scope for Doc Review)

```
Task: Fix config.ts KNOWN_HOOK_EVENTS array
Location: plugin/hooks/hooks-app/src/config.ts lines 8-21

Current KNOWN_HOOK_EVENTS:
- PreToolUse, PostToolUse, SubagentStop, UserPromptSubmit
- SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd
- SessionStart, SessionEnd, Stop, Notification

Should add (registered in hooks.json):
- SubagentStart
- PreCompact
- PermissionRequest

Should keep (planned, in config but not hooks.json):
- SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd
```

### Cross-check States Summary

| Issue | State | Action |
|-------|-------|--------|
| E1-A (config.ts) | VALIDATED but OUT OF SCOPE | Separate code task |
| E2-A (dir path) | UNCERTAIN | User decides |
| E3-A through E10-A | VALIDATED | Implement |
| E1-B (SlashCommandEnd) | VALIDATED | Implement |
| E2-B (logger JSDoc) | INVALIDATED | Skip |
| E9-A (CLAUDE.md hooks) | UNCERTAIN | User decides |

---

## Files Affected Summary

| File | Common Issues | Exclusive Issues | Total |
|------|--------------|------------------|-------|
| plugin/hooks/ARCHITECTURE.md | 1 | 2 | 3 |
| plugin/hooks/TYPESCRIPT.md | 1 | 0 | 1 |
| plugin/hooks/README.md | 1 | 2 | 3 |
| plugin/hooks/CONVENTIONS.md | 0 | 3 | 3 |
| plugin/hooks/SETUP.md | 0 | 1 | 1 |
| plugin/hooks/INTEGRATION_TESTS.md | 0 | 1 | 1 |
| CLAUDE.md | 0 | 1 | 1 |
| config.ts (code, not doc) | 0 | 1 | 1 |
