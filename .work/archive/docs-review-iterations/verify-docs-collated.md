# Collated Review Report - Documentation Review

## Metadata
- **Review Type:** Documentation Review
- **Date:** 2024-12-24 17:30:00
- **Reviewers:** technical-writer (Review A), code-agent (Review B)
- **Subject:** Complete Turboshovel documentation audit (CLAUDE.md, README.md, SETUP.md, CONVENTIONS.md, TYPESCRIPT.md, ARCHITECTURE.md, INTEGRATION_TESTS.md)
- **Review Files:**
  - Review #1: `.work/documentation-review-II/verify-docs-A.md`
  - Review #2: `.work/documentation-review-II/verify-docs-B.md`
- **Cross-check Status:** PENDING
- **Cross-check File:** N/A (awaiting cross-check execution)

## Executive Summary
- **Total unique issues identified:** 10
- **Common issues (VERY HIGH confidence):** 3 → `/revise common`
- **Exclusive issues (pending cross-check):** 7
  - VALIDATED: 0 (cross-check not yet run)
  - INVALIDATED: 0 (cross-check not yet run)
  - UNCERTAIN: 0 (cross-check not yet run)
- **Divergences (resolved during collation):** 0

**Overall Status:** APPROVED WITH CHANGES
**Revise Ready:** common (3 issues with VERY HIGH confidence can be addressed immediately)

## Common Issues (High Confidence)
Both reviewers independently found these issues.

**Confidence: VERY HIGH** - Both reviewers found these issues independently, making them very likely to be real problems.

### BLOCKING / CRITICAL

**1. PreCompact Hook Context Pattern Not Implemented**
- **Location:** `plugin/hooks/README.md` lines 91-95, 165; `plugin/hooks/CONVENTIONS.md` lines 35-38
- **Reviewer #1 finding:** Documentation shows PreCompact pattern as `pre-compact.md`, but implementation in `context.ts` has no case for PreCompact in `extractNameAndStage()`. PreCompact is not in the switch statement in context.ts, so no context file will be discovered for it. (BLOCKING - Issue #3)
- **Reviewer #2 finding:** The CONVENTIONS.md states `PreCompact` uses `pre-compact.md`. However, reviewing the actual `extractNameAndStage` function in `context.ts`, this hook is NOT handled - it falls through to null in the default case. Users expecting context injection for PreCompact hooks will not get it. (BLOCKING - Issue #1)
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Either add PreCompact handling to `context.ts` extractNameAndStage() function, OR update documentation to clarify PreCompact context injection is NOT implemented

**2. PermissionRequest Hook Context Pattern Not Implemented**
- **Location:** `plugin/hooks/README.md` lines 91-95, 166; `plugin/hooks/CONVENTIONS.md` lines 35-38
- **Reviewer #1 finding:** Documentation shows PermissionRequest pattern as `permission-request.md`, but implementation in `context.ts` has no case for PermissionRequest. PermissionRequest is not in the switch statement in context.ts. Users may create permission-request.md expecting injection that won't happen. (BLOCKING - Issue #4)
- **Reviewer #2 finding:** The CONVENTIONS.md states `PermissionRequest` uses `permission-request.md`. However, reviewing the actual `extractNameAndStage` function in `context.ts`, this hook is NOT handled - it falls through to null. Users expecting context injection for PermissionRequest hooks will not get it. (BLOCKING - Issue #1)
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Either add PermissionRequest handling to `context.ts` extractNameAndStage() function, OR update documentation to clarify PermissionRequest context injection is NOT implemented

**3. SubagentStart Hook Context Pattern Not Implemented**
- **Location:** `plugin/hooks/README.md` lines 87, 159; `plugin/hooks/CONVENTIONS.md` lines 27-32, line 31
- **Reviewer #1 finding:** Documentation mentions SubagentStart hook with pattern `{agent}-start.md`, but the implementation in `context.ts` does NOT have a handler for SubagentStart in `extractNameAndStage()`. Only SubagentStop has special handling. `context.ts` lines 167-215 shows extractNameAndStage() returns null for SubagentStart since there's no case for it in the switch statement. Users may create `{agent}-start.md` files expecting them to be injected at SubagentStart, but they won't be discovered. (BLOCKING - Issue #2)
- **Reviewer #2 finding:** CONVENTIONS.md mentions SubagentStart can use context files, but the actual `discoverAgentCommandContext` function only handles SubagentStop. SubagentStart is handled by `extractNameAndStage` which would return null since SubagentStart is not in the switch statement. (SUGGESTION #4)
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING (per Reviewer #1) / SUGGESTION (per Reviewer #2) - treating as BLOCKING given user expectations
- **Action required:** Either add SubagentStart handling to `context.ts` extractNameAndStage() function, OR update documentation to clarify SubagentStart context injection is NOT implemented

### NON-BLOCKING / LOWER PRIORITY

None - all common issues are blocking.

## Exclusive Issues (Pending Cross-check)
Only one reviewer found these issues. Cross-check will validate against ground truth.

**Confidence: MODERATE** - One reviewer found these. Cross-check validates whether they actually apply.

**Cross-check Status:** PENDING

### Found by Reviewer #1 (technical-writer) Only

#### BLOCKING / CRITICAL

None - Reviewer #1's blocking issues were all found by both reviewers.

#### NON-BLOCKING / LOWER PRIORITY

**1. Clarify Workflow State Directory Path**
- **Location:** `CLAUDE.md` line 103
- **Found by:** Reviewer #1 (SUGGESTION #1)
- **Description:** States "State persists in `.claude/turboshovel/workflows/`" which is correct per `state.ts` line 7. However, the README.md mentions `.claude/turboshovel/session.json` for active workflow tracking separately from workflow state files. The CLAUDE.md could be more complete.
- **Severity:** NON-BLOCKING
- **Benefit:** More complete documentation of workflow state persistence locations
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** N/A

**2. Hook Session vs Workflow Session Distinction**
- **Location:** `plugin/hooks/ARCHITECTURE.md` lines 319-354
- **Found by:** Reviewer #1 (SUGGESTION #2)
- **Description:** Architecture documentation excellently distinguishes between hook session (`.claude/session/state.json`) and workflow session (`.claude/turboshovel/session.json`). This important distinction could be highlighted more prominently in README.md or SETUP.md for users.
- **Severity:** NON-BLOCKING
- **Benefit:** Users would better understand the two separate session mechanisms
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** N/A

**3. Missing Context Hooks List Should Be Complete**
- **Location:** `plugin/hooks/README.md` lines 82-94
- **Found by:** Reviewer #1 (SUGGESTION #4)
- **Description:** The table shows 11 hook events, but only SessionStart, SessionEnd, UserPromptSubmit, SubagentStop, PreToolUse, PostToolUse, Stop, and Notification are actually implemented in `extractNameAndStage()`. SubagentStart, PreCompact, and PermissionRequest return null (no context discovery).
- **Severity:** NON-BLOCKING
- **Benefit:** Add a note indicating which hooks actually support context injection vs which are registered but don't have context discovery
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** N/A

### Found by Reviewer #2 (code-agent) Only

#### BLOCKING / CRITICAL

**1. Missing cli/ Subdirectory in Directory Structure**
- **Location:** `plugin/hooks/ARCHITECTURE.md` lines 126-130
- **Found by:** Reviewer #2 (BLOCKING - Issue #2)
- **Description:** The ARCHITECTURE.md directory structure shows `cli.ts` at root but the actual structure includes a `cli/` subdirectory containing `workflow-cli.ts`. Developers navigating the codebase won't find the workflow CLI where expected.
- **Severity:** BLOCKING
- **Reasoning:** Misleading architectural documentation can cause developer confusion
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** N/A

**2. Missing workflow/ Directory in Directory Structure**
- **Location:** `plugin/hooks/ARCHITECTURE.md` lines 116-137
- **Found by:** Reviewer #2 (BLOCKING - Issue #3)
- **Description:** The documented directory structure completely omits the `workflow/` subdirectory which contains substantial functionality including context.ts, evaluation.ts, hooks/, parser/, state.ts, task-id.ts, and types.ts.
- **Severity:** BLOCKING
- **Reasoning:** The workflow system is a major feature not reflected in the architecture documentation
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** N/A

**3. HookInput Interface Missing agent_transcript_path**
- **Location:** `plugin/hooks/TYPESCRIPT.md` lines 106-133
- **Found by:** Reviewer #2 (BLOCKING - Issue #5)
- **Description:** The `HookInput` interface documented in TYPESCRIPT.md is incomplete compared to actual `schemas.ts`. The field `agent_transcript_path` is present in schemas.ts but NOT documented. Developers creating TypeScript gates won't know about this field.
- **Severity:** BLOCKING
- **Reasoning:** Incomplete API documentation
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** N/A

#### NON-BLOCKING / LOWER PRIORITY

**1. Workflow Examples Path is Incomplete**
- **Location:** `plugin/hooks/README.md` lines 1269-1287
- **Found by:** Reviewer #2 (SUGGESTION #1)
- **Description:** The README states workflow examples are in `plugin/hooks/examples/` but only one workflow exists: `code-review.workflow.md`. The documentation mentions several workflows that don't exist.
- **Severity:** NON-BLOCKING
- **Benefit:** Setting accurate expectations about available examples
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** N/A

## Divergences (Requires Investigation)
Reviewers disagree or have contradictory findings.

**Confidence: INVESTIGATE** - Reviewers have different conclusions. Verification analysis included.

None - No contradictory findings between reviewers. All issues were either found by both reviewers (common issues) or by only one reviewer (exclusive issues).

## Recommendations

### Immediate Actions → `/revise common`
Common issues - both reviewers found them with VERY HIGH confidence. Can start immediately.

- [ ] **PreCompact Context Injection:** Either add PreCompact handling to `context.ts` extractNameAndStage() or document that it's not implemented
- [ ] **PermissionRequest Context Injection:** Either add PermissionRequest handling to `context.ts` extractNameAndStage() or document that it's not implemented
- [ ] **SubagentStart Context Injection:** Either add SubagentStart handling to `context.ts` extractNameAndStage() or document that it's not implemented

### After Cross-check → `/revise exclusive`
Exclusive issues pending cross-check validation

**VALIDATED (implement):**
- Cross-check not yet run

**INVALIDATED (skip):**
- Cross-check not yet run

**UNCERTAIN (user decides):**
- Cross-check not yet run

### For Consideration (NON-BLOCKING)
Improvement suggestions found by one or both reviewers

- [ ] **Clarify Workflow State Paths:** Add mention of session.json for completeness in CLAUDE.md
  - Benefit: Users understand both workflow state persistence locations
  - Found by: Reviewer #1
  - Cross-check: PENDING

- [ ] **Hook vs Workflow Session Distinction:** Highlight distinction more prominently in README.md or SETUP.md
  - Benefit: Users better understand the two separate session mechanisms
  - Found by: Reviewer #1
  - Cross-check: PENDING

- [ ] **Indicate Which Hooks Support Context:** Add note about which hooks actually support context injection vs registered but not implemented
  - Benefit: Clear expectations for users
  - Found by: Reviewer #1
  - Cross-check: PENDING

- [ ] **Workflow Examples Documentation:** Either create more example workflows or adjust documentation to reflect only code-review.workflow.md is provided
  - Benefit: Accurate expectations about available examples
  - Found by: Reviewer #2
  - Cross-check: PENDING

### Divergences (Resolved)
None

## Overall Assessment

**Ready to proceed?** WITH CHANGES

**Reasoning:**
Both reviewers independently identified the same three critical issues around context injection for PreCompact, PermissionRequest, and SubagentStart hooks. These hooks are documented as supporting context injection but the implementation does not handle them in `extractNameAndStage()`. This creates a mismatch between user expectations and actual behavior.

The exclusive issues identified by each reviewer require cross-check validation before implementation. Reviewer #2 identified structural documentation gaps (missing directories in ARCHITECTURE.md) and interface incompleteness (missing field in HookInput documentation), while Reviewer #1 identified documentation clarity improvements.

**Critical items requiring attention:**
1. Resolve PreCompact, PermissionRequest, and SubagentStart context injection documentation/implementation mismatch (common issues - VERY HIGH confidence)
2. After cross-check: Address validated exclusive issues from both reviewers

**Confidence level:**
- **High confidence issues (common):** 3 blocking issues with VERY HIGH confidence - both reviewers independently found the same context injection problems
- **Moderate confidence issues (exclusive):** 7 issues pending cross-check - 3 from Reviewer #1 (all non-blocking suggestions), 4 from Reviewer #2 (3 blocking, 1 non-blocking)
- **Investigation required (divergences):** 0 - no contradictory findings

## Next Steps

### Parallel Workflow (Recommended)

1. **Now:** `/revise common` - Start implementing the 3 common context injection issues immediately (VERY HIGH confidence)
2. **Background:** Cross-check validates the 7 exclusive issues
3. **When ready:** `/revise exclusive` - Implement validated exclusive issues
4. **Or:** `/revise all` - Implement everything actionable

### Sequential Workflow

**Given APPROVED WITH CHANGES status:**

1. `/revise common` - Address all 3 common BLOCKING issues (PreCompact, PermissionRequest, SubagentStart context injection)
2. Wait for cross-check to complete and validate the 7 exclusive issues
3. Review UNCERTAIN exclusive issues (user decides)
4. `/revise exclusive` - Address VALIDATED exclusive issues

**Recommended approach:**
Start with `/revise common` to fix the three context injection issues immediately (VERY HIGH confidence). These are clearly documented vs implementation mismatches found by both reviewers independently. Then await cross-check results for the 7 exclusive issues before addressing them.

### Cross-check States

| State | Meaning | Action |
|-------|---------|--------|
| VALIDATED | Cross-check confirmed issue exists | Implement via `/revise exclusive` |
| INVALIDATED | Cross-check found issue doesn't apply | Skip (auto-excluded from `/revise`) |
| UNCERTAIN | Cross-check couldn't determine | User reviews and decides |
