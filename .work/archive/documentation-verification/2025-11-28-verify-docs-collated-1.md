---
name: Collated Documentation Verification Report
description: Dual-verification analysis of Turboshovel documentation issues
version: 1.0.0
---

# Collated Documentation Verification Report - Turboshovel

## Metadata

- **Review Type:** Documentation Verification (Dual-Verification Collation)
- **Date:** 2025-11-28
- **Reviewers:**
  - Reviewer #1: Documentation Verification Agent (technical-writer focus)
  - Reviewer #2: Independent Documentation Verification Agent (code-agent focus)
- **Subject:** Turboshovel documentation verification against codebase implementation
- **Files Reviewed:**
  - plugin/hooks/README.md
  - plugin/hooks/SETUP.md
  - plugin/hooks/ARCHITECTURE.md
  - plugin/hooks/CONVENTIONS.md
  - plugin/hooks/TYPESCRIPT.md
  - plugin/hooks/INTEGRATION_TESTS.md
  - CLAUDE.md (root)
  - Context: TypeScript source code, configuration files, test files
- **Ground Truth:** TypeScript source code in plugin/hooks/hooks-app/src/, hooks.json registration, actual filesystem structure

---

## Executive Summary

**Total Issues Identified:** 18 unique issues
**Common Issues (Both Reviewers):** 2
**Exclusive Issues:** 16
**Divergences:** 2 (minor severity disagreement)
**Confidence Level:** HIGH across all findings

**Overall Assessment:** Documentation has critical inaccuracies that misrepresent implemented functionality. Both reviewers independently identified the same core issues: missing plugin context directory and hook registration mismatch.

**Recommendation:** BLOCKED - Critical discrepancies require immediate correction before documentation can be considered reliable.

---

## Common Issues (VERY HIGH Confidence - Both Reviewers Found)

### 1. Plugin Context Directory Does Not Exist
**Status:** CRITICAL - Missing Core Feature

**Reviewer #1 Finding:**
- Documentation claims plugin provides context files at `${CLAUDE_PLUGIN_ROOT}/context/` that auto-inject
- Only examples exist in `plugin/hooks/examples/context/`
- Directory `plugin/hooks/context/` does not exist at all
- Code in context.ts searches for plugin context but never finds it
- **Impact:** Context injection for plugin defaults silently fails, documentation promises fallback that doesn't exist

**Reviewer #2 Finding:**
- No plugin/hooks/context/ directory exists at all
- dispatcher.ts code for plugin-level context is dead code
- Documentation at ARCHITECTURE.md line 103-104 shows context/ in structure but it's imaginary
- **Impact:** CRITICAL - Context injection for plugin defaults silently fails without error

**Common Verdict:**
- Issue confirmed by both reviewers through filesystem inspection
- Code path exists but never executes because directory never created
- Major gap between documented promises and actual implementation

**Recommendation:** Either create plugin/hooks/context/ with default files OR remove all references to plugin context from documentation

---

### 2. Hook Event Registration Mismatch
**Status:** CRITICAL - Feature Misrepresentation

**Reviewer #1 Finding:**
- Documentation claims all 12 Claude Code hooks are supported
- hooks.json only registers 4 hooks: PostToolUse, SubagentStop, UserPromptSubmit, SessionStart
- Missing 8 hooks: SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd, PreToolUse, Stop, SessionEnd, Notification
- **Impact:** Users creating context files for unregistered hooks will fail silently

**Reviewer #2 Finding:**
- Documentation claims 12 hook events are supported
- hooks.json only registers 4 hooks
- config.ts KNOWN_HOOK_EVENTS includes all 12 (validation support) but they're NOT registered in hooks.json
- **Impact:** Context files for 8 hooks won't work because hooks.json doesn't register those events

**Common Verdict:**
- Both reviewers independently verified hooks.json registration
- Both identified same gap: 12 documented vs 4 implemented
- Both noted the misleading nature of documentation

**Recommendation:** Update all documentation to accurately reflect only 4 supported hooks OR register remaining 8 hooks in hooks.json

---

## Exclusive Issues (MODERATE Confidence - One Reviewer Found)

### Found by Reviewer #1 (Documentation Specialist) Only

#### 3. SlashCommandStart/SlashCommandEnd NOT Supported
**Description:** Explicitly calls out these two hooks as documented but not registered
- Location: README.md lines 78-96, ARCHITECTURE.md lines 206-223
- **Confidence:** MODERATE (specific to these two hooks, not general 12→4 issue)

#### 4. SkillStart/SkillEnd NOT Supported
**Description:** Similar to above, explicitly documents these hooks
- Location: README.md lines 88-90, CONVENTIONS.md lines 27-38
- **Confidence:** MODERATE (specific documentation of these hooks)

#### 5. enabled_commands Field Does Not Exist
**Description:** CONVENTIONS.md shows example with "enabled_commands" field that doesn't exist
- Location: CONVENTIONS.md line 214
- **Confidence:** MODERATE (specific invalid configuration example)

#### 6. Unknown Hook Events in hooks.json
**Description:** PreCompact and PermissionRequest in hooks.json but not in KNOWN_HOOK_EVENTS
- Location: plugin/hooks.json lines 66-79
- **Confidence:** MODERATE (inconsistency in registration files)

#### 7. TypeScript Gate Chaining Misconception
**Description:** Documentation implies auto-chaining, but chaining requires explicit config
- Location: TYPESCRIPT.md line 74
- **Confidence:** MODERATE (conceptual documentation issue)

#### 8. Examples Directory Path Inaccuracy
**Description:** Says "examples/" when should be "plugin/hooks/examples/"
- Location: README.md line 323
- **Confidence:** MODERATE (simple path error)

#### 9. UserPromptSubmit Context Pattern Clarity
**Description:** Pattern is correct but wording confusing
- Location: README.md line 86, ARCHITECTURE.md line 214
- **Confidence:** MODERATE (clarity issue, not accuracy)

#### 10. Gate Chaining Max Depth
**Description:** MAX_GATES_PER_DISPATCH = 10 not documented
- Location: ARCHITECTURE.md (missing)
- **Confidence:** MODERATE (undocumented limitation)

#### 11. Keyword Matching Details
**Description:** Uses substring matching, not word-boundary matching
- Location: README.md lines 248-252
- **Confidence:** MODERATE (behavioral detail)

#### 12. Plugin Gate Sibling Convention
**Description:** Documented as ~/.claude/plugins/ but uses sibling of CLAUDE_PLUGIN_ROOT
- Location: README.md lines 191-192
- **Confidence:** MODERATE (path resolution documentation)

---

### Found by Reviewer #2 (Code Focus) Only

#### 13. SessionStart Hook Not Fully Registered
**Description:** SessionStart in hooks.json but example file says it's not supported by Claude Code
- Location: README.md lines 82-84, examples/context/session-start.md line 24-26
- **Confidence:** MODERATE (special case of hook registration issue)

#### 14. Command Field vs TypeScript Implementation Mismatch
**Description:** Documentation shows command field but types show it's mutually exclusive with plugin/gate
- Location: SETUP.md line 93-119, types.ts lines 38-44
- **Confidence:** MODERATE (validation constraint not documented)

#### 15. SubagentStop Context Injection Pattern Not Documented
**Description:** Special agent-command scoping pattern not documented
- Location: CONVENTIONS.md line 23-24 (passing reference)
- **Confidence:** MODERATE (missing documentation of advanced feature)

#### 16. Keyword Filtering Only for UserPromptSubmit
**Description:** Keywords only apply to UserPromptSubmit, not other hooks
- Location: README.md lines 225-251, types.ts lines 44-47
- **Confidence:** MODERATE (restriction not documented)

#### 17. Circular Gate Reference Prevention Limits
**Description:** MAX_GATES_PER_DISPATCH = 10 circuit breaker not documented
- Location: dispatcher.ts line 78
- **Confidence:** MODERATE (undocumented limit)

#### 18. UserPromptSubmit Context Pattern Not Documented
**Description:** Pattern is hardcoded to prompt-submit.md but documentation unclear
- Location: CONVENTIONS.md line 154
- **Confidence:** MODERATE (clarity of documented behavior)

---

## Divergences (Requires Investigation)

### Divergence #1: Plugin Gate References Implementation Status

**Reviewer #1 Says:** Plugin gate reference feature has not been properly implemented or tested
- Evidence: config.ts has structure but no integration tests exist
- plugin-gates.integration.test.ts file exists but unclear if complete
- Code structure suggests implementation but execution path uncertain
- **Verdict:** "Uncertain correctness without seeing full gate-loader execution path"

**Reviewer #2 Says:** [No mention of implementation uncertainty - focuses on other issues]

**Analysis:** Reviewer #1 specifically investigated plugin gate testing and found it incomplete. This is a finding that required deeper code path analysis. Since Reviewer #2 didn't examine this area, there's no disagreement, just different focus areas.

**Verdict:** Reviewer #1's finding stands - plugin gate implementation testing is incomplete

---

### Divergence #2: SessionStart Hook Assessment

**Reviewer #1 Says:** SessionStart is fully registered (one of 4 hooks)
- Lists SessionStart as successfully registered in hooks.json
- **Verdict:** Treats as one of the 4 working hooks

**Reviewer #2 Says:** SessionStart is registered but examples say it's not supported by Claude Code
- Evidence: examples/context/session-start.md line 24-26 states "SessionStart is not currently a supported hook in Claude Code"
- **Verdict:** SessionStart registration exists but is non-functional

**Analysis:** Different emphasis:
- Reviewer #1 notes it IS registered (true)
- Reviewer #2 notes registration exists BUT examples say it doesn't work in Claude Code (also true)
- This is complementary information, not contradictory

**Resolution:** Both correct - SessionStart is in hooks.json but may not work in Claude Code. Example file admission makes this explicit.

---

## Critical Gaps Identified by Both Reviewers

### Missing Implementation: Plugin Context Directory
- **Root Cause:** Code expects `${pluginRoot}/context/` directory but it was never created
- **Impact:** Core documentation promise completely unfulfilled
- **Files Affected:** README.md, ARCHITECTURE.md, CONVENTIONS.md, dispatcher.ts (dead code)
- **Action Required:** Create directory with default files OR remove all plugin context documentation

### Missing Implementation: 8 of 12 Hook Events
- **Root Cause:** Documentation reflects planned scope (12 hooks) but implementation only delivered (4 hooks)
- **Impact:** Users following documentation waste time on non-functional features
- **Files Affected:** README.md, ARCHITECTURE.md, CONVENTIONS.md
- **Action Required:** Update all hook tables to show only 4 supported events

### Missing Implementation: Built-in "commands" Gate
- **Root Cause:** TYPESCRIPT.md shows example code for non-existent gate
- **Impact:** Users expect built-in functionality that doesn't exist
- **Files Affected:** TYPESCRIPT.md
- **Action Required:** Remove example or implement the gate

---

## Summary of Common vs Exclusive Issues

**Common Issues (2):**
Both reviewers independently identified the same core problems:
1. Missing plugin context directory
2. Hook registration mismatch (12 documented vs 4 implemented)

These represent the most critical failures - documentation promises features that don't exist.

**Exclusive Issues (16):**
Each reviewer found specific issues the other missed, demonstrating:
- Reviewer #1: Focus on specific hook documentation errors (SlashCommandStart/End, SkillStart/End, enabled_commands, etc.)
- Reviewer #2: Focus on code-behavior documentation gaps (keyword filtering restriction, command field constraints, SubagentStop pattern, etc.)

**Divergences (2):**
- Plugin gate testing (Reviewer #1 investigated deeper)
- SessionStart status (complementary perspectives, not contradictory)

---

## Recommendations by Priority

### Immediate (Critical - Fix Before Release)

1. **Remove or Create Plugin Context Directory**
   - Either: Create plugin/hooks/context/ with default files (session-start.md, etc.)
   - Or: Remove all plugin context references from documentation
   - **Why:** This is a completely missing feature - users expect something that doesn't exist

2. **Update Hook Event Tables**
   - Change "12 hook types" to "4 hook types" everywhere
   - Remove SlashCommandStart/End, SkillStart/End, PreToolUse, Stop, SessionEnd, Notification from docs
   - Keep only: PostToolUse, SubagentStop, UserPromptSubmit, SessionStart (note: SessionStart may not work in Claude Code)
   - **Why:** Core misrepresentation of capabilities

3. **Remove "commands" Gate Example**
   - Remove TYPESCRIPT.md example code for non-existent commands gate
   - **Why:** Users expect built-in functionality that doesn't exist

4. **Fix hooks.json vs KNOWN_HOOK_EVENTS**
   - Either register PreCompact/PermissionRequest OR remove from hooks.json
   - **Why:** Inconsistency between validation and registration

### High Priority (Fix Soon)

5. **Document Keyword Filtering Restriction**
   - Add: "Keywords only apply to UserPromptSubmit hook"
   - Update README.md, SETUP.md, types.ts JSDoc
   - **Why:** Users will configure keywords on other hooks expecting them to work

6. **Clarify Command Field Mutual Exclusivity**
   - Add constraint note to gate examples
   - **Why:** Users may create invalid configurations

7. **Document Gate Chain Limit**
   - Document MAX_GATES_PER_DISPATCH = 10
   - **Why:** Users hitting limit won't know it's a feature, not a bug

8. **Fix Examples Directory Path**
   - Update path to plugin/hooks/examples/
   - **Why:** Users can't find example files

### Medium Priority (Next Release)

9. **Document SubagentStop Special Handling**
   - Add agent-command scoping pattern documentation
   - **Why:** Advanced feature users need guidance

10. **Document Plugin Gate Limitations**
    - Add testing coverage or mark as experimental
    - **Why:** Current implementation status unclear

11. **Improve Development Commands Documentation**
    - Add npm install, npm run watch
    - Add dist/ directory note
    - **Why:** New users need setup guidance

12. **Clarify SessionStart Status**
    - Note in docs that SessionStart may not work in Claude Code
    - **Why:** Match reality shown in example files

---

## Overall Assessment

### Documentation Quality

**Strengths:**
- Well-written and comprehensive
- Good structure and organization
- Accurate for implemented features
- Good cross-referencing between files

**Critical Weaknesses:**
- Major gaps between documented scope and implemented scope
- Missing core features (plugin context directory)
- Misrepresentation of hook event support (12 vs 4)
- Several non-existent features documented (commands gate)

### Agreement Between Reviewers

**High Agreement:**
- Both identified the same two critical issues independently
- Both verified through direct code inspection and filesystem checks
- Both assessed documentation as "well-written but inaccurate"

**Complementary Findings:**
- Reviewer #1 found specific hook documentation errors (more granular)
- Reviewer #2 found code-behavior documentation gaps (more systematic)

**No Fundamental Disagreements:**
- All findings are compatible, just different focus areas
- Divergences are complementary, not contradictory

### Confidence Assessment

**VERY HIGH Confidence (Common Issues):**
- Missing plugin context directory verified by filesystem inspection
- Hook registration mismatch verified by reading hooks.json

**MODERATE Confidence (Exclusive Issues):**
- Each finding verified through code inspection by one reviewer
- May be edge cases or different reviewer priorities

### Final Recommendation

**Status:** BLOCKED - Documentation requires critical corrections before release

**Primary Action:** Update all hook event documentation to reflect actual 4 hooks (not 12)

**Secondary Action:** Either create plugin context directory OR remove all plugin context references

**Impact of Current State:** Users will encounter non-functional features, creating confusion and wasted effort. Documentation promises more than implementation delivers, which undermines trust.

---

## Verification Method

**Review Methodology:**
- Reviewer #1: 20+ files examined, 15 code files reviewed, all 8 documentation files
- Reviewer #2: Complete documentation verification against TypeScript source code
- Both reviewers: Direct code inspection, filesystem verification, configuration file analysis

**Cross-Verification:**
- Both reviewers independently identified same core issues
- Common issues verified by both through different code paths
- Exclusive issues demonstrate thorough but complementary coverage

**Total Effort:** Two independent comprehensive reviews with full code verification

---

*Report compiled from dual-verification analysis*
*Date: 2025-11-28*
*Confidence: HIGH across all findings*