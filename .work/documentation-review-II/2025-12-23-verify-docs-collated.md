# Collated Review Report - Documentation Review

## Metadata
- **Review Type:** Documentation Review
- **Date:** 2025-12-23 11:15:00
- **Reviewers:** technical-writer (Agent #1), code-agent (Agent #2)
- **Subject:** `.work/workflow-orchestration/reference.workflow.md`
- **Review Files:**
  - Review #1: `/Users/tobyhede/psrc/turboshovel/.work/2025-12-23-verify-docs-A.md`
  - Review #2: `/Users/tobyhede/psrc/turboshovel/.work/2025-12-23-verify-docs-B.md`
- **Cross-check Status:** PENDING
- **Cross-check File:** N/A

## Executive Summary
- **Total unique issues identified:** 20
- **Common issues (VERY HIGH confidence):** 8 -> `/revise common`
- **Exclusive issues (pending cross-check):** 12
  - VALIDATED: 0 (pending)
  - INVALIDATED: 0 (pending)
  - UNCERTAIN: 12 (pending cross-check)
- **Divergences (resolved during collation):** 0

**Overall Status:** BLOCKED
**Revise Ready:** common (exclusive pending cross-check)

---

## Common Issues (High Confidence)
Both reviewers independently found these issues.

**Confidence: VERY HIGH** - Both reviewers found these issues independently, making them very likely to be real problems.

### BLOCKING / CRITICAL

**IF/ELSE Syntax Used in Example Despite Being Not Implemented** (`plugin/hooks/examples/code-review.workflow.md`)
- **Reviewer #1 finding:** Step 3 uses `- IF: has_blocking_issues` / `- ELSE: CONTINUE` syntax. README.md clearly states IF/ELSE not implemented. Severity: BLOCKING
- **Reviewer #2 finding:** Existing example uses IF/ELSE syntax (Step 3), but README states "IF/ELSE conditionals are planned but not currently supported by the parser." Creates inconsistency. Severity: BLOCKING
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Update `code-review.workflow.md` to use agent-controlled branching pattern instead of IF/ELSE

**Missing `workflow unbind` Command Documentation** (Reference workflow CLI section / design.md)
- **Reviewer #1 finding:** Design.md section 13 mentions `workflow unbind --agent <id>` but not shown in reference workflow CLI Commands Reference. Severity: BLOCKING
- **Reviewer #2 finding:** Design.md section 13 mentions unbind command but not documented in CLI Commands Reference section. Severity: BLOCKING
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Either add `workflow unbind` to CLI reference if implemented, or explicitly note as "not yet implemented"

**Parallel Task Subtask Notation Inconsistency** (Reference workflow steps 4, 6, 10)
- **Reviewer #1 finding:** Uses `### 4.A` notation with uppercase letters. Task binding examples use `6.1` (numeric) inconsistently. Design.md section 9 uses `3.A` format. Severity: BLOCKING
- **Reviewer #2 finding:** Reference uses `N.LETTER` format. Concern about parser expectations. Notation should be consistent and verified against implementation. Severity: BLOCKING
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Standardize subtask notation to letter format (e.g., `6.A` not `6.1`) throughout. Verify parser accepts format.

**Task Binding Flow Clarity** (Reference workflow step 6, lines 83-85)
- **Reviewer #1 finding:** Hook automations presented as if user would run them; needs clarification these are hook-triggered, not agent manual commands. Severity: NON-BLOCKING (suggestion S6)
- **Reviewer #2 finding:** The hook-driven vs. manual command distinction needs clearer documentation. Users may misunderstand whether hooks handle commands automatically. Severity: BLOCKING
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING (higher severity applies)
- **Action required:** Clarify that task binding commands are executed by hooks automatically, not manually by agents

**Missing Context Injection (AGENT_ID) Documentation** (Design.md section 8 / reference workflow)
- **Reviewer #1 finding:** Design.md specifies SubagentStart injects `AGENT_ID: xyz` into subagent context. Reference workflow doesn't show the injected format. Severity: NON-BLOCKING (suggestion S1)
- **Reviewer #2 finding:** Design.md section 8 specifies AGENT_ID injection. Not demonstrated in reference workflow. Severity: BLOCKING
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING (higher severity applies)
- **Action required:** Add Context Injection section showing: "AGENT_ID: xyz / If you need to run workflow commands, use --agent xyz"

**Missing Child Workflow State Fields** (Reference workflow Session State section)
- **Reviewer #1 finding:** Design.md section 6 specifies `agentId`, `parentWorkflowId`, `parentTaskId` fields for child workflows. Not shown in reference workflow session state. Severity: NON-BLOCKING (suggestion S2)
- **Reviewer #2 finding:** Design.md defines child workflow additions not demonstrated in reference workflow. Severity: BLOCKING
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING (higher severity applies)
- **Action required:** Add example of child workflow state in Session State section showing these fields

### NON-BLOCKING / LOWER PRIORITY

**Missing Enforcement Mode Documentation** (Reference workflow, missing section)
- **Reviewer #1 finding:** Design.md section 12 describes enforcement mode behavior (No active workflow, Active workflow, Stashed workflow) and violations. Not explained in reference workflow. Severity: NON-BLOCKING
- **Reviewer #2 finding:** Design.md details enforcement behavior. Reference workflow doesn't demonstrate what happens when enforcement is active vs. inactive. Severity: NON-BLOCKING (suggestion #3)
- **Confidence:** VERY HIGH (both suggested independently)
- **Benefit:** Users will understand violation handling and the three enforcement states

**Missing stashedWorkflowId in Session State Example** (Reference workflow lines 306-327)
- **Reviewer #1 finding:** Design.md section 6 defines `stashedWorkflowId?: string` field. Not shown in session state example. Severity: NON-BLOCKING
- **Reviewer #2 finding:** Session state example could include `stashedWorkflowId` to demonstrate stash state. Severity: NON-BLOCKING (suggestion #5)
- **Confidence:** VERY HIGH (both suggested independently)
- **Benefit:** Complete documentation of session state structure

---

## Exclusive Issues (Pending Cross-check)
Only one reviewer found these issues. Cross-check will validate against ground truth.

**Confidence: MODERATE** - One reviewer found these. Cross-check validates whether they actually apply.

**Cross-check Status:** PENDING

### Found by Reviewer #1 Only

#### BLOCKING / CRITICAL

**Missing `workflow list` in design.md** (Reference workflow lines 297-298; design.md section 5)
- **Found by:** Reviewer #1
- **Description:** Reference workflow shows `workflow list` command but design.md section 5 does not include this command in CLI specification.
- **Severity:** BLOCKING
- **Reasoning:** Inconsistency between design spec and reference - unclear if `workflow list` is actually implemented
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification that design.md lacks this command and whether implementation exists

**Session State Shows Incorrect taskId Format** (Reference workflow lines 318-325; design.md section 6)
- **Found by:** Reviewer #1
- **Description:** Session state example shows `"taskId": { "task": 6, "subtask": "1" }` but design.md shows subtasks as letters: `"3.A" -> { task: 3, subtask: "A" }`
- **Severity:** BLOCKING
- **Reasoning:** Incorrect data model representation in reference example
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of exact format in design.md and reference workflow

#### NON-BLOCKING / LOWER PRIORITY

**Aggregation Rules Table Timing Incomplete** (Reference workflow lines 229-235)
- **Found by:** Reviewer #1
- **Description:** Feature Summary lists aggregation rules but doesn't explain when each applies. Design.md section 9 provides clearer explanation.
- **Severity:** NON-BLOCKING
- **Benefit:** Users will understand how aggregation timing works
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of design.md section 9 content

**README.md References Missing Workflow Files** (`plugin/hooks/README.md` lines 1199-1202)
- **Found by:** Reviewer #1
- **Description:** README references `execute.workflow.md` and `code-review.workflow.md` as examples. Git status shows these may be staged but deleted.
- **Severity:** NON-BLOCKING
- **Benefit:** Users directed to examples that actually exist
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of current git status for example files

**stash/pop Not Documented in README.md** (`plugin/hooks/README.md` lines 753-854)
- **Found by:** Reviewer #1
- **Description:** Reference workflow shows `workflow stash` and CLI reference includes stash/pop, but README.md CLI Commands section does not document these commands.
- **Severity:** NON-BLOCKING
- **Benefit:** README.md completeness
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of README.md CLI Commands section content

### Found by Reviewer #2 Only

#### BLOCKING / CRITICAL

**Inconsistent Variable Naming Conventions** (Reference lines 37-38, 267; README lines 694-697)
- **Found by:** Reviewer #2
- **Description:** Reference uses `requires_review`, `batch_size`; README shows `more_batches`, `has_blocked_task`; example uses `has_blocking_issues`. All snake_case but naming not documented.
- **Severity:** BLOCKING
- **Reasoning:** Users confused about recommended conventions
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of actual variable names used across files

#### NON-BLOCKING / LOWER PRIORITY

**Prompt Marker Placement Flexibility** (Reference workflow Feature Summary section)
- **Found by:** Reviewer #2
- **Description:** Could demonstrate that `**Prompt:**` marker can appear mid-step, not just at beginning.
- **Severity:** NON-BLOCKING
- **Benefit:** Clarifies flexibility of prompt placement
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of parser behavior for prompt placement

**Full Stash/Pop Workflow Demonstration** (Reference workflow step 8, lines 110-111)
- **Found by:** Reviewer #2
- **Description:** Reference mentions stash but doesn't demonstrate the full stash/pop cycle.
- **Severity:** NON-BLOCKING
- **Benefit:** Would show complete escape hatch pattern
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of current stash/pop documentation completeness

**GOTO Step Numbering Clarification** (Reference workflow lines 186-201)
- **Found by:** Reviewer #2
- **Description:** Uses `FAIL: GOTO 15` but could clarify step numbers are 1-indexed and validated at parse time.
- **Severity:** NON-BLOCKING
- **Benefit:** Prevents confusion about step numbering
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of parser validation behavior

**Error Message Examples** (Reference workflow Actions section lines 237-246)
- **Found by:** Reviewer #2
- **Description:** Shows `STOP "message"` syntax but could demonstrate how error messages appear to users.
- **Severity:** NON-BLOCKING
- **Benefit:** Users understand error output format
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of current error message documentation

**Multiple Code Blocks Rejection Example** (README.md lines 491-493)
- **Found by:** Reviewer #2
- **Description:** README states "One code block per step (multiple blocks rejected)" but reference doesn't show invalid example.
- **Severity:** NON-BLOCKING
- **Benefit:** Helps users avoid common mistakes
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of README statement

**Parallel Task Completion Semantics** (Reference workflow lines 229-235)
- **Found by:** Reviewer #2
- **Description:** Shows `PASS (ALL)` and `PASS (ANY)` but could clarify partial completion behavior.
- **Severity:** NON-BLOCKING
- **Benefit:** Clarifies edge case behavior
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Needs verification of actual aggregation semantics

---

## Divergences (Requires Investigation)
Reviewers disagree or have contradictory findings.

**Confidence: INVESTIGATE** - Reviewers have different conclusions. Verification analysis included.

**None** - Both reviewers reached consistent conclusions on all common findings. No contradictory perspectives identified.

---

## Recommendations

### Immediate Actions -> `/revise common`
Common issues - both reviewers found them with VERY HIGH confidence. Can start immediately.

- [ ] **IF/ELSE in example:** Update `code-review.workflow.md` to use agent-controlled branching pattern
- [ ] **Subtask notation:** Standardize to letter format (`6.A` not `6.1`) throughout reference workflow
- [ ] **Task binding clarity:** Add note that hook commands are automatic, not manual agent actions
- [ ] **Context injection:** Add section showing AGENT_ID injection format for subagents
- [ ] **Child workflow fields:** Add child workflow state example with `agentId`, `parentWorkflowId`, `parentTaskId`
- [ ] **workflow unbind:** Document command or mark as "not yet implemented"

### After Cross-check -> `/revise exclusive`
Exclusive issues pending cross-check validation.

**VALIDATED (implement):**
- (pending cross-check)

**INVALIDATED (skip):**
- (pending cross-check)

**UNCERTAIN (user decides):**
- [ ] **workflow list in design.md** (Reviewer #1): Verify if design.md needs updating
- [ ] **taskId format** (Reviewer #1): Verify correct subtask format in session state example
- [ ] **Variable naming** (Reviewer #2): Document recommended naming convention
- [ ] **README missing files** (Reviewer #1): Verify example files exist and are committed
- [ ] **stash/pop in README** (Reviewer #1): Add to README CLI Commands if missing

### For Consideration (NON-BLOCKING)
Improvement suggestions found by one or both reviewers.

- [ ] **Enforcement mode section:** Add section explaining three states and violation types
  - Benefit: Users understand violation handling
  - Found by: Both
  - Cross-check: N/A (common issue)

- [ ] **stashedWorkflowId field:** Add to session state example (can be null)
  - Benefit: Complete state structure documentation
  - Found by: Both
  - Cross-check: N/A (common issue)

- [ ] **Aggregation timing:** Add "Evaluated when all subtasks complete"
  - Benefit: Explains when aggregation rules apply
  - Found by: Reviewer #1
  - Cross-check: PENDING

- [ ] **GOTO validation:** Add note that GOTO targets validated at parse time
  - Benefit: Prevents step numbering confusion
  - Found by: Reviewer #2
  - Cross-check: PENDING

- [ ] **Parallel completion semantics:** Clarify partial completion behavior
  - Benefit: Edge case clarity
  - Found by: Reviewer #2
  - Cross-check: PENDING

### Divergences (Resolved)
None - reviewers were in agreement on all findings.

---

## Overall Assessment

**Ready to proceed?** NO

**Reasoning:**
Both independent reviewers identified the same critical issues, providing VERY HIGH confidence that these problems exist:

1. **Critical inconsistency:** The existing `code-review.workflow.md` example uses IF/ELSE syntax that the README explicitly documents as "not implemented." This is a documentation bug that will confuse users.

2. **Notation inconsistency:** Subtask notation mixes numeric (`6.1`) and letter (`4.A`) formats, which could cause parser issues and user confusion.

3. **Missing design features:** Several features documented in design.md (context injection, child workflow state, unbind command) are not demonstrated in the reference workflow.

**Critical items requiring attention:**
- Update `code-review.workflow.md` to remove IF/ELSE syntax
- Standardize subtask notation to letter format
- Add missing orchestration feature documentation (context injection, child workflow state)
- Clarify hook-driven vs. manual command execution

**Confidence level:**
- **High confidence issues (common):** 8 issues found by both reviewers - these are confirmed problems
- **Moderate confidence issues (exclusive):** 12 issues found by only one reviewer - pending cross-check validation
- **Investigation required (divergences):** 0 - reviewers were in agreement

---

## Next Steps

### Parallel Workflow (Recommended)

1. **Now:** `/revise common` - Start implementing the 8 common issues immediately (VERY HIGH confidence)
2. **Background:** Cross-check validates the 12 exclusive issues
3. **When ready:** `/revise exclusive` - Implement validated exclusive issues
4. **Or:** `/revise all` - Implement everything actionable

### Sequential Workflow

**BLOCKED - Follow this path:**
1. `/revise common` - Address all 6 BLOCKING common issues (VERY HIGH confidence)
2. Wait for cross-check to complete on 12 exclusive issues
3. Review UNCERTAIN exclusive issues (user decides which to implement)
4. `/revise exclusive` - Address VALIDATED exclusive issues

### Priority Order for Common Issues

1. **IF/ELSE in example** - Most confusing inconsistency, directly contradicts README
2. **Subtask notation** - Affects parser functionality and user understanding
3. **Task binding clarity** - Prevents user confusion about automation
4. **Context injection** - Essential for subagent workflow understanding
5. **Child workflow fields** - Completes nested workflow documentation
6. **workflow unbind** - Minor but should be addressed

### Cross-check States

| State | Meaning | Action |
|-------|---------|--------|
| VALIDATED | Cross-check confirmed issue exists | Implement via `/revise exclusive` |
| INVALIDATED | Cross-check found issue doesn't apply | Skip (auto-excluded from `/revise`) |
| UNCERTAIN | Cross-check couldn't determine | User reviews and decides |
