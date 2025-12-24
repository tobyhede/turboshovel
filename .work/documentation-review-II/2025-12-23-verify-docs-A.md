# Review - 2025-12-23

## Metadata
- **Reviewer:** technical-writer (Agent A)
- **Date:** 2025-12-23 10:30:00
- **Subject:** `.work/workflow-orchestration/reference.workflow.md`
- **Ground Truth:**
  - `.work/workflow-orchestration/design.md` (orchestration design)
  - `plugin/hooks/README.md` (workflow syntax reference)
  - `plugin/hooks/examples/code-review.workflow.md` (existing example)
- **Context:** Independent review #1 for dual-verification
- **Mode:** Review

## Summary
- **Subject:** Reference workflow demonstrating all workflow syntax and orchestration capabilities
- **Scope:** Verified every feature claim, syntax example, and orchestration pattern against design.md and README.md documentation

---

## Status: BLOCKED

## BLOCKING (Must Address)

**B1. IF/ELSE syntax used despite being documented as NOT IMPLEMENTED:**
- Description: The reference workflow does not use IF/ELSE conditionals, which is correct. However, the existing `code-review.workflow.md` example at step 3 uses `- IF: has_blocking_issues` / `- ELSE: CONTINUE` syntax. The README.md clearly states: "NOT YET IMPLEMENTED: IF/ELSE conditionals are planned but not currently supported by the parser."
- Location: `plugin/hooks/examples/code-review.workflow.md`, step 3
- Impact: The existing example file demonstrates syntax that will fail at parse time
- Action: Update `code-review.workflow.md` to use agent-controlled branching pattern instead of IF/ELSE

**B2. Missing `workflow unbind` command from design.md:**
- Description: Design.md section 13 mentions `workflow unbind --agent <id>` as a potential cleanup command for stale agent bindings. This is NOT shown in the reference workflow's CLI Commands Reference section.
- Location: Reference workflow, lines 269-302 (CLI Commands Reference section)
- Impact: Users will not know how to handle crashed subagents with stale bindings
- Action: Either add `workflow unbind` to the CLI reference, or explicitly note it as "not yet implemented"

**B3. Missing `workflow list` command documentation in design.md:**
- Description: The reference workflow shows `workflow list` command (line 297-298), but design.md section 5 does not include this command in its CLI specification.
- Location: Reference workflow, lines 297-298; Design.md section 5
- Impact: Inconsistency between design spec and reference - unclear if `workflow list` is actually implemented
- Action: Confirm implementation status and update design.md to include `workflow list` if implemented

**B4. Parallel subtask notation inconsistency:**
- Description: Reference workflow uses `### 4.A`, `### 4.B`, `### 4.C` notation (uppercase letters). README.md shows no explicit example of parallel subtask notation format, and design.md section 9 uses `### 3.A`, `### 3.B`. The task binding examples in reference workflow use `6.1` (numeric) instead of `6.A` (letter) notation inconsistently.
- Location: Reference workflow steps 4, 6, 10; lines 83-85 (task binding)
- Impact: Confusion about whether subtasks use letters (A, B, C) or numbers (1, 2, 3)
- Action: Standardize subtask notation. Design.md uses `3.A` format, so reference should use consistent letter notation throughout. Fix task binding examples to use `6.A` format.

**B5. Session state example shows incorrect taskId format:**
- Description: Reference workflow session state example (lines 318-325) shows `"taskId": { "task": 6, "subtask": "1" }` but the TaskId definition in design.md section 6 shows subtasks as letters: `"3.A" -> { task: 3, subtask: "A" }`.
- Location: Reference workflow, lines 318-325; Design.md section 6
- Impact: Incorrect data model representation in reference example
- Action: Change session state example to use letter subtasks: `"subtask": "A"` to match design.md

---

## SUGGESTIONS (Would Improve Quality)

**S1. Missing context injection agent_id example:**
- Description: Design.md section 8 specifies that SubagentStart hook injects `AGENT_ID: xyz` into subagent context with message "If you need to run workflow commands, use --agent xyz". Reference workflow mentions context injection but doesn't show the actual injected format.
- Location: Reference workflow, feature summary section (missing)
- Impact: Users may not understand exactly what subagents receive
- Action: Add a "Context Injection" section showing the injected context format

**S2. Missing child workflow data model fields:**
- Description: Design.md section 6 "Child Workflow (additions)" specifies three fields: `agentId`, `parentWorkflowId`, `parentTaskId`. The reference workflow's session state example doesn't show these fields for nested workflows.
- Location: Reference workflow, Session State section (lines 306-327)
- Impact: Incomplete data model documentation for nested workflows
- Action: Add a separate session state example for child workflows showing all required fields

**S3. Missing enforcement mode documentation:**
- Description: Design.md section 12 describes enforcement mode behavior (No active workflow, Active workflow, Stashed workflow) and violations table. Reference workflow mentions stash/pop but doesn't explain enforcement mode or violations.
- Location: Reference workflow, missing section
- Impact: Users won't understand what happens when workflow is violated
- Action: Add "Enforcement Mode" section explaining the three states and violation types

**S4. Aggregation rules table incomplete:**
- Description: Reference workflow Feature Summary (lines 229-235) lists aggregation rules but doesn't explain when each applies. Design.md section 9 provides clearer explanation: "When all subtasks complete, evaluate..."
- Location: Reference workflow, lines 229-235
- Impact: Users may not understand how aggregation timing works
- Action: Add timing explanation: "Evaluated when all subtasks complete"

**S5. Missing stashed workflow session state field:**
- Description: Design.md section 6 "Session State (additions)" defines `stashedWorkflowId?: string` field. Reference workflow session state example doesn't show this field.
- Location: Reference workflow, Session State section (lines 306-327)
- Impact: Incomplete documentation of session state structure
- Action: Add `stashedWorkflowId` field to session state example (can be null in example)

**S6. Step 6 task binding flow uses incorrect hook names:**
- Description: Step 6 shows task binding flow mentioning "PostToolUse fires -> workflow start --task 6.1". Design.md section 7 flow shows this correctly, but the reference workflow should clarify these are hook automations, not agent actions.
- Location: Reference workflow, step 6, lines 83-85
- Impact: Users may think agents must manually run these commands
- Action: Clarify that task binding flow shows hook automation, not agent manual commands

**S7. README.md examples section references missing workflow files:**
- Description: README.md line 1199-1202 references `execute.workflow.md` and `code-review.workflow.md` as examples in `plugin/hooks/examples/`. The git status shows these files may be staged but deleted.
- Location: `plugin/hooks/README.md`, lines 1199-1202
- Impact: Users directed to examples that may not exist
- Action: Verify example files exist and are committed

**S8. Reference workflow uses `workflow stash` but README.md doesn't document it:**
- Description: Reference workflow step 8 mentions `workflow stash` and the CLI reference includes stash/pop. However, README.md CLI Commands section (lines 753-854) does not document stash or pop commands.
- Location: `plugin/hooks/README.md`, lines 753-854
- Impact: README.md is incomplete compared to reference workflow
- Action: Add `workflow stash` and `workflow pop` documentation to README.md

---

## Assessment

**Conclusion:**
The reference workflow is a comprehensive demonstration of workflow features but has several inconsistencies with the design document and existing documentation. Most critically:
1. The existing code-review.workflow.md example uses IF/ELSE syntax that is documented as not implemented
2. TaskId notation inconsistently uses numbers vs letters for subtasks
3. Several CLI commands and state fields from design.md are missing

The reference workflow is approximately 85% complete but requires fixes to the blocking issues before it can serve as authoritative documentation.

**Confidence in findings:**
HIGH confidence - all issues verified against specific line numbers and sections in source documents. The IF/ELSE syntax issue is clearly documented in README.md as "NOT YET IMPLEMENTED" while simultaneously being used in the example file.
