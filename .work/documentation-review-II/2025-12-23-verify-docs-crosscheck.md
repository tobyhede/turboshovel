# Cross-Check Report - Exclusive Issues Validation

## Metadata
- **Date:** 2025-12-23
- **Source:** `.work/2025-12-23-verify-docs-collated.md`
- **Subject:** `.work/workflow-orchestration/reference.workflow.md`
- **Cross-checker:** Principal engineer (cross-check agent)

## Ground Truth Documents
- Design: `.work/workflow-orchestration/design.md`
- README: `plugin/hooks/README.md`
- Example: `plugin/hooks/examples/code-review.workflow.md`

---

## Summary

| Status | Count |
|--------|-------|
| VALIDATED | 5 |
| INVALIDATED | 5 |
| UNCERTAIN | 2 |
| **Total** | **12** |

---

## Reviewer #1 Exclusive Issues

### Issue 1: Missing `workflow list` in design.md

- **Issue:** Reference workflow shows `workflow list` command but design.md section 5 does not include this command in CLI specification.
- **Source:** Reviewer #1
- **Severity claimed:** BLOCKING

**Validation:**

Checked design.md section 5 (CLI Commands):
```
workflow start <file>     # Start workflow
workflow next             # Advance step
workflow status           # Show state
workflow stop             # Abort
```

Checked README.md line 839-851:
```
#### `workflow list`
List all workflows (active and inactive).
```

**Verdict:** VALIDATED

**Evidence:** Design.md section 5 lists only `start`, `next`, `status`, `stop` under "Existing" commands. The `workflow list` command is documented in README.md (lines 839-851) but NOT in design.md. This is an inconsistency between design spec and implementation documentation.

**Recommendation:** Add `workflow list` to design.md section 5 under "Existing" commands, or clarify in a new section.

---

### Issue 2: Session State Shows Incorrect taskId Format

- **Issue:** Session state example shows `"taskId": { "task": 6, "subtask": "1" }` but design.md shows subtasks as letters: `"3.A" -> { task: 3, subtask: "A" }`
- **Source:** Reviewer #1
- **Severity claimed:** BLOCKING

**Validation:**

Checked design.md section 6 (Data Model):
```
{ task: number, subtask?: string }

Examples:
  "3" → { task: 3 }
  "3.A" → { task: 3, subtask: "A" }
```

Checked reference.workflow.md session state (lines 319-324):
```json
"agentBindings": {
  "abc123": {
    "taskId": { "task": 6, "subtask": "1" },
    ...
  }
}
```

But the reference workflow uses LETTER notation for subtasks (4.A, 4.B, 10.A, 10.B).

**Verdict:** VALIDATED

**Evidence:** The reference workflow correctly uses letter notation for parallel subtasks (### 4.A, ### 10.A, etc.), but the session state example incorrectly shows numeric subtask `"subtask": "1"` instead of letter format `"subtask": "A"`. This is inconsistent with design.md which specifies `"3.A" -> { task: 3, subtask: "A" }` format.

**Recommendation:** Change session state example to use letter format: `"subtask": "A"` to match design spec and the workflow's own step notation.

---

### Issue 3: Aggregation Rules Table Timing Incomplete

- **Issue:** Feature Summary lists aggregation rules but doesn't explain when each applies. Design.md section 9 provides clearer explanation.
- **Source:** Reviewer #1
- **Severity claimed:** NON-BLOCKING

**Validation:**

Checked design.md section 9 (Parallel Task Aggregation):
```
When all subtasks complete, evaluate:
- PASS (ALL): all must pass
- PASS (ANY): at least one passes
- FAIL (ALL): all must fail
- FAIL (ANY): at least one fails
```

Checked reference.workflow.md Feature Summary (lines 229-235):
```
## Parallel Tasks
- **H3 subtask notation**: `### N.letter Title` (Steps 4, 10)
- **Aggregation rules**:
  - `PASS (ALL)`: All must pass (Step 4)
  - `PASS (ANY)`: At least one passes (Step 10)
  - `FAIL (ANY)`: Any failure stops (Step 4)
  - `FAIL (ALL)`: All must fail (Step 10)
```

**Verdict:** INVALIDATED

**Evidence:** The reference workflow DOES explain what each aggregation rule means. Design.md adds "When all subtasks complete, evaluate:" but this timing is implicit from the workflow context (parallel subtasks). The reference workflow's descriptions are functionally equivalent. This is a stylistic preference, not a documentation gap.

**Recommendation:** Skip. The current documentation is adequate.

---

### Issue 4: README.md References Missing Workflow Files

- **Issue:** README references `execute.workflow.md` and `code-review.workflow.md` as examples. Git status shows these may be staged but deleted.
- **Source:** Reviewer #1
- **Severity claimed:** NON-BLOCKING

**Validation:**

Git status shows:
```
Changes not staged for commit:
  deleted:    plugin/hooks/examples/execute.workflow.md
```

README.md lines 1199-1202:
```
- **`execute.workflow.md`** - Batch execution with review checkpoints (7 steps)
- **`code-review.workflow.md`** - Code review dispatch and triage (4 steps)
```

`code-review.workflow.md` exists in working directory (I read it successfully).
`execute.workflow.md` is deleted in working tree.

**Verdict:** VALIDATED

**Evidence:** `execute.workflow.md` has been deleted from the working directory but README still references it. The `code-review.workflow.md` exists. This creates broken documentation references.

**Recommendation:** Either restore `execute.workflow.md` or update README.md to reference existing workflow files (collate.workflow.md, crosscheck.workflow.md, verify-*.workflow.md based on git status).

---

### Issue 5: stash/pop Not Documented in README.md CLI Commands Section

- **Issue:** Reference workflow shows `workflow stash` and CLI reference includes stash/pop, but README.md CLI Commands section does not document these commands.
- **Source:** Reviewer #1
- **Severity claimed:** NON-BLOCKING

**Validation:**

Checked README.md CLI Commands section (lines 751-852).

Found `workflow list`, `workflow start`, `workflow next`, `workflow status`, `workflow stop` documented.

Searched for `stash` and `pop` in README:
- Line 110: "Use `workflow stash` to pause for ad-hoc work" (in example text)
- Line 456-457: Shows stash usage in Quick Start

But NO dedicated CLI command documentation for `workflow stash` or `workflow pop` under the CLI Commands section.

Design.md section 5 shows:
```
workflow stash    # Pause enforcement, preserve workflow state
workflow pop      # Resume enforcement from stashed state
```

**Verdict:** VALIDATED

**Evidence:** Design.md clearly documents `workflow stash` and `workflow pop` as CLI commands. README.md mentions them in example usage but does NOT have dedicated command documentation under the CLI Commands section (lines 751-852) like other commands have.

**Recommendation:** Add `#### \`workflow stash\`` and `#### \`workflow pop\`` sections to README.md CLI Commands, following the pattern of other command documentation.

---

## Reviewer #2 Exclusive Issues

### Issue 6: Inconsistent Variable Naming Conventions

- **Issue:** Reference uses `requires_review`, `batch_size`; README shows `more_batches`, `has_blocked_task`; example uses `has_blocking_issues`. All snake_case but naming not documented.
- **Source:** Reviewer #2
- **Severity claimed:** BLOCKING

**Validation:**

Checked naming across documents:
- Reference workflow: `batch_size`, `requires_review`, `more_batches` (lines 37-38, 266-267)
- README.md: `more_batches`, `has_blocked_task` (lines 693-694)
- code-review.workflow.md: `has_blocking_issues` (line 21)

All use snake_case consistently.

**Verdict:** INVALIDATED

**Evidence:** All variable names consistently use snake_case convention. The different names (`has_blocking_issues` vs `has_blocked_task`) are semantically different variables for different purposes, not inconsistent naming of the same concept. There is no naming convention conflict - just different variables in different workflows. Documentation of variable naming conventions is a nice-to-have but absence is not a bug.

**Recommendation:** Skip. Different workflows use different variables. This is expected behavior, not an inconsistency.

---

### Issue 7: Prompt Marker Placement Flexibility

- **Issue:** Could demonstrate that `**Prompt:**` marker can appear mid-step, not just at beginning.
- **Source:** Reviewer #2
- **Severity claimed:** NON-BLOCKING

**Validation:**

Checked README.md lines 499-518:
```markdown
**Explicit prompts** (using `**Prompt:**` marker):
## 1. Review code
**Prompt:** Review the implementation for security issues.
```

Checked reference.workflow.md - prompts are shown at various positions:
- Step 3 line 34: Prompt after intro text
- Step 6 line 75: Prompt at start
- Step 9 line 118: Prompt in middle of step

**Verdict:** INVALIDATED

**Evidence:** The reference workflow already demonstrates prompt markers at different positions within steps (beginning, middle, after description text). Step 3 shows `**Prompt:**` appearing after introductory text. This is already implicitly demonstrated.

**Recommendation:** Skip. The flexibility is already shown through examples.

---

### Issue 8: Full Stash/Pop Workflow Demonstration

- **Issue:** Reference mentions stash but doesn't demonstrate the full stash/pop cycle.
- **Source:** Reviewer #2
- **Severity claimed:** NON-BLOCKING

**Validation:**

Checked reference.workflow.md:
- Line 110: `Say: "Ready for feedback. Use \`workflow stash\` to pause for ad-hoc work."`
- CLI reference lines 292-295 shows both commands

Checked design.md section 12:
```
### Stash/Pop (Escape Hatch)
workflow stash          # Pause enforcement, preserve state
# ... do untracked work (explore, debug, etc.) ...
workflow pop            # Resume enforcement
```

**Verdict:** UNCERTAIN

**Evidence:** The reference workflow mentions stash in passing but does not demonstrate a complete cycle (stash -> do work -> pop). Design.md section 12 shows the pattern briefly. This is arguably complete since CLI commands section shows both commands, but a step-by-step demonstration could be helpful.

**Recommendation:** User decision. Could add a dedicated step demonstrating full cycle, but existing documentation may be sufficient.

---

### Issue 9: GOTO Step Numbering Clarification

- **Issue:** Uses `FAIL: GOTO 15` but could clarify step numbers are 1-indexed and validated at parse time.
- **Source:** Reviewer #2
- **Severity claimed:** NON-BLOCKING

**Validation:**

Checked README.md lines 604-616:
```
| `GOTO` | `FAIL: GOTO 1` | Jump to specific step number |

**Action validation:**
- GOTO targets must exist (validated at parse time)
- GOTO self creates infinite loop (rejected)
- Step numbers 1-indexed (not zero-based)
```

**Verdict:** INVALIDATED

**Evidence:** README.md lines 614-616 already explicitly documents: "GOTO targets must exist (validated at parse time)" and "Step numbers 1-indexed (not zero-based)". This is already documented.

**Recommendation:** Skip. Already documented in README.

---

### Issue 10: Error Message Examples

- **Issue:** Shows `STOP "message"` syntax but could demonstrate how error messages appear to users.
- **Source:** Reviewer #2
- **Severity claimed:** NON-BLOCKING

**Validation:**

Reference workflow shows STOP with messages:
- Line 18: `FAIL: STOP "Environment setup failed"`
- Line 28: `FAIL: STOP "Prerequisites not met"`
- Multiple other instances

README shows syntax but not output format.

**Verdict:** UNCERTAIN

**Evidence:** The STOP message syntax is well documented. How messages appear to users (CLI output format) is not documented anywhere. This is a valid gap but minor since the syntax is clear.

**Recommendation:** User decision. Could add example CLI output showing error message display, but low priority.

---

### Issue 11: Multiple Code Blocks Rejection Example

- **Issue:** README states "One code block per step (multiple blocks rejected)" but reference doesn't show invalid example.
- **Source:** Reviewer #2
- **Severity claimed:** NON-BLOCKING

**Validation:**

README.md lines 491-494:
```
**Rules:**
- Only `bash` language supported
- One code block per step (multiple blocks rejected)
```

Reference workflow does not show invalid examples.

**Verdict:** INVALIDATED

**Evidence:** Reference documentation typically demonstrates VALID syntax, not invalid syntax. The README clearly states the rule. Showing invalid examples in a reference workflow would be confusing as users might copy the invalid pattern. Anti-patterns belong in a troubleshooting section, not reference documentation.

**Recommendation:** Skip. Invalid examples should not be in reference workflows.

---

### Issue 12: Parallel Task Completion Semantics

- **Issue:** Shows `PASS (ALL)` and `PASS (ANY)` but could clarify partial completion behavior.
- **Source:** Reviewer #2
- **Severity claimed:** NON-BLOCKING

**Validation:**

Design.md section 9:
```
When all subtasks complete, evaluate:
- PASS (ALL): all must pass
- PASS (ANY): at least one passes
- FAIL (ALL): all must fail
- FAIL (ANY): at least one fails
```

Reference workflow Feature Summary explains the rules but not edge cases.

**Verdict:** INVALIDATED

**Evidence:** "Partial completion behavior" is implicitly handled - evaluation only happens "when all subtasks complete" (design.md). There is no partial completion state in the design. Subtasks either all complete (then evaluate), or some are still running (wait). The semantics are complete.

**Recommendation:** Skip. The semantics are already defined - evaluation occurs when ALL subtasks complete.

---

## Final Summary

### VALIDATED Issues (5) - Should Be Addressed

| # | Issue | Source | Severity | Action |
|---|-------|--------|----------|--------|
| 1 | `workflow list` missing from design.md | R#1 | BLOCKING | Add to design.md section 5 |
| 2 | Session state taskId format incorrect (numeric vs letter) | R#1 | BLOCKING | Change `"subtask": "1"` to `"subtask": "A"` |
| 4 | README references deleted `execute.workflow.md` | R#1 | NON-BLOCKING | Restore file or update README references |
| 5 | stash/pop missing from README CLI Commands | R#1 | NON-BLOCKING | Add dedicated command documentation |

### INVALIDATED Issues (5) - Can Be Skipped

| # | Issue | Source | Reason |
|---|-------|--------|--------|
| 3 | Aggregation rules timing | R#1 | Already adequately explained |
| 6 | Variable naming conventions | R#2 | Different variables, not inconsistent naming |
| 7 | Prompt marker placement | R#2 | Already demonstrated in examples |
| 9 | GOTO step numbering | R#2 | Already documented in README |
| 11 | Multiple code blocks example | R#2 | Invalid examples don't belong in reference docs |
| 12 | Partial completion semantics | R#2 | Semantics already defined (wait until all complete) |

### UNCERTAIN Issues (2) - User Decides

| # | Issue | Source | Notes |
|---|-------|--------|-------|
| 8 | Full stash/pop cycle demonstration | R#2 | Existing docs may be sufficient; full demo is nice-to-have |
| 10 | Error message output format | R#2 | Minor gap; syntax is clear, output format not shown |

---

## Revised Exclusive Issues for `/revise exclusive`

**VALIDATED (implement):**
1. Add `workflow list` to design.md CLI Commands section
2. Fix session state example: change `"subtask": "1"` to `"subtask": "A"`
3. Fix README example file references (restore execute.workflow.md or update references)
4. Add `workflow stash` and `workflow pop` to README CLI Commands section

**INVALIDATED (skip):**
- Aggregation timing, variable naming, prompt placement, GOTO docs, invalid examples, partial completion

**UNCERTAIN (user decides):**
- Full stash/pop demonstration
- Error message output examples
