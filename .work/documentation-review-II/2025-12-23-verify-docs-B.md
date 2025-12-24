# Review - 2025-12-23

## Metadata
- **Reviewer:** code-agent (independent verification)
- **Date:** 2025-12-23 09:45:00
- **Subject:** `.work/workflow-orchestration/reference.workflow.md`
- **Ground Truth:**
  - Design document: `.work/workflow-orchestration/design.md`
  - Existing docs: `plugin/hooks/README.md` (workflow syntax reference section)
  - Existing examples: `plugin/hooks/examples/code-review.workflow.md`
- **Context:** Independent review #2 for dual-verification
- **Mode:** Review

## Summary
- **Subject:** Reference workflow file intended to demonstrate all workflow syntax and capabilities
- **Scope:** Verification of syntax correctness, feature completeness against design.md, and consistency with README.md documentation

---

## For Reviews (use BLOCKING/SUGGESTIONS)

## Status: BLOCKED

## BLOCKING (Must Address)

**1. IF/ELSE Syntax Used Despite Being Documented as Not Implemented:**
- Description: The existing example `code-review.workflow.md` uses IF/ELSE syntax (Step 3), but README.md clearly states "IF/ELSE conditionals are planned but not currently supported by the parser." The reference workflow does NOT use IF/ELSE (correctly), but the existing example does, creating inconsistency.
- Location: `plugin/hooks/examples/code-review.workflow.md` lines 21-23; README.md lines 542-554
- Impact: Users will be confused about whether IF/ELSE works. The existing example appears broken.
- Action: Either update the existing example to use agent-controlled branching pattern, OR the reference workflow should acknowledge this inconsistency. The reference workflow correctly avoids IF/ELSE in favor of agent-controlled patterns.

**2. Parallel Task Subtask Notation Inconsistency:**
- Description: Reference workflow uses `### 4.A` notation (period separator), but design.md section 6 uses subtask format `3.A` (without period in TaskId examples). The parsing shows `{ task: 3, subtask: "A" }`. The reference uses lowercase letters in some places (4.A, 4.B) which is consistent, but the overall notation should be verified against parser implementation.
- Location: Reference workflow lines 47-57; design.md lines 100-109
- Impact: If parser expects different format, parallel task binding may fail.
- Action: Verify that `N.LETTER` format (e.g., `4.A`) in H3 headers is correctly parsed as `{ task: 4, subtask: "A" }`. Confirm the parser accepts this format.

**3. Missing `workflow unbind` Command:**
- Description: Design.md section 13 mentions `workflow unbind --agent <id>` as a potential solution for stale agent bindings, but this is not documented in the CLI Commands Reference section of the reference workflow.
- Location: Design.md line 300; Reference workflow CLI Reference section lines 268-302
- Impact: Users may have stale agent bindings with no documented way to clean them up.
- Action: Either add `workflow unbind --agent <id>` to CLI reference if implemented, or clearly state it's not yet implemented.

**4. Inconsistent Variable Naming Conventions:**
- Description: Reference workflow uses both `requires_review` (snake_case) and mentions `batch_size` (snake_case), but the README.md examples show `more_batches`, `has_blocked_task`. The existing example uses `has_blocking_issues`. Naming conventions should be consistent.
- Location: Reference lines 37-38, 267; README lines 694-697; code-review.workflow.md line 21
- Impact: Minor confusion for users about naming conventions.
- Action: Document recommended variable naming convention (snake_case appears standard).

**5. Task Binding Flow Description May Be Inaccurate:**
- Description: Reference workflow step 6 describes task binding flow with specific CLI commands, but the design.md architecture shows hooks calling CLI, not agents. The description "PostToolUse fires -> `workflow start --task 6.1`" is correct for hook automation, but step 83-85 presents this as something the user/agent would see, which is confusing.
- Location: Reference workflow lines 83-85; design.md section 7
- Impact: Users may misunderstand whether they need to run these commands or if hooks handle them automatically.
- Action: Clarify that these commands are typically executed by hooks automatically, not manually by agents (unless hooks are disabled).

**6. Missing Design Feature: Context Injection for Subagents:**
- Description: Design.md section 8 specifies that SubagentStart hook should inject `AGENT_ID` into subagent context so subagent knows its ID. This feature is not demonstrated or mentioned in the reference workflow.
- Location: Design.md lines 216-223
- Impact: Users won't know how subagents receive their agent ID for workflow commands.
- Action: Add a note or example showing the context injection pattern: "AGENT_ID: xyz / If you need to run workflow commands, use --agent xyz"

**7. Child Workflow State Fields Not Demonstrated:**
- Description: Design.md section 6 defines child workflow additions: `agentId`, `parentWorkflowId`, `parentTaskId`. The reference workflow shows nested workflow usage (step 5) but doesn't demonstrate how child workflow state relates to parent.
- Location: Design.md lines 139-145; Reference workflow step 5
- Impact: Users won't understand how nested workflows track their parent relationship.
- Action: Add example of child workflow state in Session State section showing these fields.

---

## SUGGESTIONS (Would Improve Quality)

**1. Add Explicit Prompt Example Variations:**
- Description: Reference workflow shows `**Prompt:**` marker usage, but could demonstrate that the marker can appear mid-step (not just at beginning).
- Location: Reference workflow Feature Summary section
- Benefit: Would clarify flexibility of prompt placement.
- Action: Add note that `**Prompt:**` can appear anywhere in step content.

**2. Demonstrate Stash/Pop Workflow:**
- Description: The reference workflow mentions `stash` in step 8 ("Use `workflow stash` to pause for ad-hoc work") but doesn't demonstrate the full stash/pop cycle.
- Location: Reference workflow step 8, lines 110-111
- Benefit: Would show complete escape hatch pattern.
- Action: Consider adding a step that demonstrates when/how to use stash/pop.

**3. Include Enforcement Mode Examples:**
- Description: Design.md section 12 details enforcement behavior (violations, blocking). Reference workflow doesn't demonstrate what happens when enforcement is active vs. inactive.
- Location: Design.md lines 268-293
- Benefit: Would help users understand violation handling.
- Action: Add a section explaining enforcement mode behavior.

**4. Clarify GOTO Step Numbering:**
- Description: Reference workflow uses `FAIL: GOTO 15` (step 14) and `workflow next --step 14` (step 15), showing GOTO patterns. Could clarify that step numbers are 1-indexed and validated at parse time.
- Location: Reference workflow lines 186-201
- Benefit: Would prevent confusion about step numbering.
- Action: Add note in Actions Reference that GOTO targets are validated at parse time.

**5. Session State Example Could Show More Fields:**
- Description: Session state example shows good fields but could include `stashedWorkflowId` to demonstrate stash state.
- Location: Reference workflow Session State section lines 306-326
- Benefit: Would show complete state structure.
- Action: Add `stashedWorkflowId` field (even as null) to session state example.

**6. Add Error Message Examples:**
- Description: Reference workflow shows `STOP "message"` syntax but could demonstrate how error messages appear to users.
- Location: Reference workflow Actions section lines 237-246
- Benefit: Would help users understand error output format.
- Action: Add example of error output format.

**7. Demonstrate Multiple Code Blocks Rejection:**
- Description: README.md states "One code block per step (multiple blocks rejected)" but reference workflow doesn't show an invalid example.
- Location: README.md lines 491-493
- Benefit: Would help users avoid common mistakes.
- Action: Add note in reference workflow about single code block requirement.

**8. Parallel Task Completion Semantics:**
- Description: Reference workflow shows `PASS (ALL)` and `PASS (ANY)` but could clarify whether partial completion (some pass, some fail) with `PASS (ANY)` still marks overall step as passed.
- Location: Reference workflow lines 229-235
- Benefit: Would clarify edge case behavior.
- Action: Add clarification about partial completion semantics.

---

## Assessment

**Conclusion:**
The reference workflow is comprehensive and demonstrates most workflow features correctly. However, there are several blocking issues:

1. **Inconsistency with existing example** - The `code-review.workflow.md` uses IF/ELSE syntax that README documents as not implemented, creating confusion about what actually works.

2. **Missing orchestration features** - Key design.md features (context injection for subagents, unbind command, child workflow state fields) are not demonstrated.

3. **Task binding flow clarity** - The hook-driven vs. manual command distinction needs clearer documentation.

The reference workflow correctly uses the agent-controlled branching pattern (the recommended workaround for IF/ELSE), which is good. The syntax for actions, parallel tasks, and state management appears correct.

**Confidence in findings:**
- HIGH confidence on IF/ELSE inconsistency (directly contradicts README)
- HIGH confidence on missing design features (verified against design.md)
- MEDIUM confidence on parser format expectations (would need code verification)
- MEDIUM confidence on enforcement mode documentation (design exists but not reflected in reference)

**Feature Coverage Matrix:**

| Design.md Feature | In Reference? | Notes |
|-------------------|---------------|-------|
| CLI: workflow start | YES | Line 272 |
| CLI: workflow start --task | YES | Line 275 |
| CLI: workflow start --agent | YES | Line 278 |
| CLI: workflow next --pass/--fail | YES | Lines 281-283 |
| CLI: workflow stash/pop | YES | Lines 292-295 |
| CLI: workflow unbind | NO | Not documented |
| TaskId parsing | YES | Lines 253-255 |
| Pending task queue | YES | Described in step 6 |
| Agent bindings | YES | Lines 319-325 |
| Context injection (AGENT_ID) | NO | Not demonstrated |
| Child workflow fields | NO | Not demonstrated |
| Enforcement violations | NO | Not demonstrated |
| Parallel aggregation (ALL/ANY) | YES | Lines 229-235 |

**README.md Coverage Matrix:**

| README Feature | In Reference? | Notes |
|----------------|---------------|-------|
| H2 step format | YES | Throughout |
| Bash code blocks | YES | Steps 1, 14 |
| Implicit prompts | YES | Step 2 |
| Explicit prompts | YES | Multiple steps |
| PASS/FAIL conditions | YES | Throughout |
| IF/ELSE conditionals | CORRECTLY AVOIDED | Uses agent pattern |
| CONTINUE action | YES | Throughout |
| STOP action | YES | Multiple steps |
| DONE action | YES | Step 16 |
| GOTO action | YES | Step 14 |
| RETRY action | YES | Steps 3, 6, 11 |
| Agent-controlled loops | YES | Steps 9, 12, 15 |
| Variables | YES | Step 3, Feature Summary |
| State persistence | YES | Session State section |
