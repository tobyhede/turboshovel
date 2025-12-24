---
name: Collation Report - Workflow System Documentation
description: Collated findings from two independent documentation reviews
version: 2.0.0
---

# Collated Review Report - Documentation Review

## Metadata
- **Review Type:** Documentation Review
- **Date:** 2025-12-20
- **Reviewers:** Agent #1 (technical-writer @ 20:55:20), Agent #2 (technical-writer @ 14:30:22)
- **Subject:** plugin/hooks/README.md (Workflow System section, lines 389-1104)
- **Review Files:**
  - Review #1: .work/2025-12-20-verify-docs-205520.md
  - Review #2: .work/2025-12-20-verify-docs-143022.md
- **Cross-check Status:** PENDING
- **Cross-check File:** [will be generated after cross-check validation]

## Executive Summary
- **Total unique issues identified:** 23
- **Common issues (VERY HIGH confidence):** 2 BLOCKING, 1 NON-BLOCKING → `/revise common`
- **Exclusive issues (pending cross-check):** 20
  - VALIDATED: [pending]
  - INVALIDATED: [pending]
  - UNCERTAIN: [pending]
- **Divergences (resolved during collation):** 0

**Overall Status:** BLOCKED (critical path issues must be fixed)
**Revise Ready:** common (can start immediately on 3 high-confidence issues)

## Common Issues (High Confidence)
Both reviewers independently found these issues.

**Confidence: VERY HIGH** - Both reviewers found these issues independently, making them very likely to be real problems.

### BLOCKING / CRITICAL

**Session.json path documentation is incorrect**
- **Reviewer #1 finding:** "README states workflows persist to `.claude/turboshovel/workflows/{id}.json` (line 604) but doesn't mention session.json location for active workflow tracking." Then notes at Suggestion #4: "Session tracking path inconsistency: README says session.json is at `.claude/turboshovel/workflows/session.json` (line 633) but implementation shows `.claude/turboshovel/session.json` (state.ts:7). README has extra `/workflows/` directory."
- **Reviewer #2 finding:** "README claims session state is stored at `.claude/turboshovel/workflows/session.json` but implementation uses `.claude/turboshovel/session.json`" - marked as BLOCKING
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Change README.md:633 from `.claude/turboshovel/workflows/session.json` to `.claude/turboshovel/session.json`
- **Evidence:**
  - README.md:633 shows incorrect path with `/workflows/` subdirectory
  - state.ts:7 shows correct path: `.claude/turboshovel/session.json`

**IF/ELSE conditionals documented but not implemented in parser**
- **Reviewer #1 finding:** "README documents IF/ELSE conditionals (lines 508-518) but the actual parser implementation doesn't appear to support this syntax. The parser only handles PASS/FAIL conditionals, not IF/ELSE variable-based branching." (Suggestion #1)
- **Reviewer #2 finding:** "README documents IF/ELSE conditional syntax (lines 507-520, 799-806, 909-914) but the parser has no implementation for IF or ELSE keywords" - marked as BLOCKING. "Agents will write workflows using IF/ELSE syntax expecting it to work, but the parser will silently ignore these constructs."
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Either (1) Remove all IF/ELSE documentation until implemented, OR (2) Add clear "NOT YET IMPLEMENTED" warnings before each IF/ELSE example
- **Evidence:**
  - README shows IF/ELSE at lines 507-520, 587-590, 799-806, 909-914, 1012-1015
  - parser.ts has no IF/ELSE handling
  - helpers.ts parseConditional() only handles PASS/FAIL
  - No IF/ELSE tests in __tests__/workflow/parser/

### NON-BLOCKING / LOWER PRIORITY

**BLOCKED condition documented but not implemented as condition type**
- **Reviewer #1 finding:** "README shows `- BLOCKED: STOP "Agent reported BLOCKED"` (line 571, line 890) as a valid condition type, but parser only recognizes PASS and FAIL conditions." (Suggestion #2)
- **Reviewer #2 finding:** "README shows BLOCKED as a valid condition outcome (line 28, 570, 891) but it's not a recognized condition type in the parser" - marked as BLOCKING. "Workflows using `- BLOCKED: STOP` will fail to parse or have undefined behavior."
- **Confidence:** VERY HIGH (both suggested independently)
- **Severity Note:** Reviewer #2 marked BLOCKING, Reviewer #1 marked SUGGESTION. Collation assessment: Likely MODERATE severity - may cause parser errors, but BLOCKED is properly documented as a task status (types.ts:78), so this may be documentation confusion rather than critical bug.
- **Benefit:** Clarify that BLOCKED is a task status, not a condition type. Prevent invalid workflow syntax.
- **Action required:** Either (1) Document BLOCKED only as task status (not condition), OR (2) Implement BLOCKED as valid condition type in parser

## Exclusive Issues (Pending Cross-check)
Only one reviewer found these issues. Cross-check will validate against ground truth.

**Confidence: MODERATE** - One reviewer found these. Cross-check validates whether they actually apply.

**Cross-check Status:** PENDING

### Found by Reviewer #1 Only

#### BLOCKING / CRITICAL
None

#### NON-BLOCKING / LOWER PRIORITY

**Missing documentation for workflow complete command**
- **Found by:** Reviewer #1
- **Description:** "CLI implements `workflow complete` command (workflow-cli.ts:125-152) with `--status` option, but README doesn't mention this command in CLI Commands section."
- **Severity:** NON-BLOCKING
- **Benefit:** Users need to know all available commands
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Action:** Add `workflow complete` to CLI Commands section if cross-check validates

**Example workflow step format differs from documented recommendation**
- **Found by:** Reviewer #1
- **Description:** "README shows explicit **Prompt:** marker as recommended (lines 469-474), but actual example files (execute.workflow.md, code-review.workflow.md) use implicit prompts (no **Prompt:** marker)."
- **Severity:** NON-BLOCKING
- **Benefit:** Consistency between documentation and examples helps learning
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Action:** Either update examples to use **Prompt:** marker or note that both formats work

**STOP message syntax clarification**
- **Found by:** Reviewer #1
- **Description:** "README shows STOP with quoted messages: `STOP \"Tests failed\"` but parser also accepts STOP with parentheses: `STOP (message)` (helpers.ts:115-118). Both formats work but README only shows quotes."
- **Severity:** NON-BLOCKING
- **Benefit:** Clear documentation of supported syntax variations
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Actions table missing IF/ELSE**
- **Found by:** Reviewer #1
- **Description:** "Actions Reference table (lines 522-532) doesn't include IF/ELSE conditionals which are shown in examples."
- **Severity:** NON-BLOCKING
- **Note:** This is related to common issue #2 (IF/ELSE not implemented). If IF/ELSE is removed from docs, this becomes moot.
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Step content description incomplete**
- **Found by:** Reviewer #1
- **Description:** "README doesn't explicitly state that step content between header and code block becomes implicit prompt text. This is implemented (parser.ts:157-159, 199-201) but not clearly documented."
- **Severity:** NON-BLOCKING
- **Benefit:** Users understand how step descriptions become prompts
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Multiple code blocks error message not documented**
- **Found by:** Reviewer #1
- **Description:** "Parser provides helpful error message for multiple code blocks (parser.ts:123-126) but README doesn't warn about this limitation."
- **Severity:** NON-BLOCKING
- **Benefit:** Prevent common mistakes
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**findWorkflowFile search paths undocumented**
- **Found by:** Reviewer #1
- **Description:** "CLI searches for workflow files in multiple locations (workflow-cli.ts:268-289) but README only mentions starting from 'relative path' or 'absolute path'."
- **Severity:** NON-BLOCKING
- **Benefit:** Users understand where workflow files are discovered
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Default retry max value verification**
- **Found by:** Reviewer #1
- **Description:** "README mentions 'default max 3' for RETRY (line 531, 997). Confirmed accurate - state.ts:45 sets retryMax: 3 by default."
- **Severity:** INFORMATIONAL (verification passed)
- **Confidence:** HIGH (verified against code)
- **Cross-check:** N/A (already verified)

**Variable type documentation needs examples**
- **Found by:** Reviewer #1
- **Description:** "README shows variables as TypeScript type but examples only show boolean usage. Add example showing number or string variable usage."
- **Severity:** NON-BLOCKING
- **Benefit:** Show diverse examples
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Workflow ID format undocumented**
- **Found by:** Reviewer #1
- **Description:** "README shows ID format example (line 608, 736: `wf-2025-01-15-abc123`) but doesn't document the format pattern."
- **Severity:** NON-BLOCKING
- **Benefit:** Users understand ID structure
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Action:** Add note: "ID format: wf-YYYY-MM-DD-{random6}"

**SubagentStop hook integration claims**
- **Found by:** Reviewer #1
- **Description:** "README claims SubagentStop hook 'Automatically detects task completion' and 'Parses STATUS: OK or STATUS: BLOCKED from agent output' (lines 669-671, 1073-1077) but the workflow state manager code doesn't show this parsing logic."
- **Severity:** NON-BLOCKING (accuracy concern)
- **Benefit:** Accurate documentation of what's implemented vs planned
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Action:** Verify this integration exists in hook handlers or mark as planned

**SessionStart auto-injection claim**
- **Found by:** Reviewer #1
- **Description:** "README claims 'SessionStart hook: Auto-injects active workflow context' (line 1080) but doesn't show where this is implemented."
- **Severity:** NON-BLOCKING (accuracy concern)
- **Benefit:** Verify this feature exists
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Step validation error message details**
- **Found by:** Reviewer #1
- **Description:** "Parser validates sequential numbering and rejects gaps (parser.ts:224-232) with helpful error messages, but README only mentions rejection without the helpful message."
- **Severity:** NON-BLOCKING
- **Benefit:** Users know what error to expect
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Backward compatibility syntax**
- **Found by:** Reviewer #1
- **Description:** "Parser supports old syntax (`Pass:`, `Fail:`, `Go to Step N`, `STOP (message)`) per helpers.ts:100-118, but README doesn't mention backward compatibility."
- **Severity:** NON-BLOCKING
- **Benefit:** Users migrating from old workflows know their syntax still works
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**H1 rejection error message**
- **Found by:** Reviewer #1
- **Description:** "Parser rejects H1 headers that look like step headers with helpful error (parser.ts:85-92) but README doesn't mention this validation."
- **Severity:** NON-BLOCKING
- **Benefit:** Users understand why they get errors
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Nested workflow property not documented**
- **Found by:** Reviewer #1
- **Description:** "WorkflowState type includes `nested` property for nested workflow support (types.ts:96-99) but this feature is not documented in README."
- **Severity:** NON-BLOCKING
- **Benefit:** If nested workflows are supported, users should know about them
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

### Found by Reviewer #2 Only

#### BLOCKING / CRITICAL
None

#### NON-BLOCKING / LOWER PRIORITY

**Add workflow command execution documentation**
- **Found by:** Reviewer #2
- **Description:** "README doesn't explain how bash commands in workflows are actually executed (are they run automatically? by agents? what environment?)"
- **Severity:** NON-BLOCKING
- **Benefit:** Agents and developers need to understand execution model to write effective workflows
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Action:** Add explanation that commands are not auto-executed; agents read and determine whether to execute

**Clarify variable setting mechanism**
- **Found by:** Reviewer #2
- **Description:** "Documentation says 'Variables are set by: Workflow hooks, Agent logic, Manual updates via CLI (future)' but doesn't explain HOW agents set variables programmatically"
- **Severity:** NON-BLOCKING
- **Benefit:** Critical for migration - cipherpowers agents need to know the API for setting workflow variables
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Missing documentation for DONE action**
- **Found by:** Reviewer #2
- **Description:** "DONE action is implemented and tested but not prominently documented in Actions Reference table. Developers need to understand how DONE differs from STOP with success."
- **Severity:** NON-BLOCKING
- **Benefit:** Complete action reference
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Workflow status output format undocumented**
- **Found by:** Reviewer #2
- **Description:** "README shows example output for `workflow status` but actual format may differ"
- **Severity:** NON-BLOCKING
- **Benefit:** Accurate example helps agents parse workflow status output
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Migration guide lacks concrete API examples**
- **Found by:** Reviewer #2
- **Description:** "Migration Guide for Cipherpowers Agents shows before/after workflow structure but doesn't show how to start workflows, update variables, or integrate with gates.json"
- **Severity:** NON-BLOCKING
- **Benefit:** Migration requires practical integration examples, not just workflow file syntax
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

## Divergences (Requires Investigation)
Reviewers disagree or have contradictory findings.

**Confidence: INVESTIGATE** - Reviewers have different conclusions. Verification analysis included.

None - Both reviewers reached same conclusions on all overlapping findings.

## Recommendations

### Immediate Actions → `/revise common`
[Common issues - both reviewers found them with VERY HIGH confidence. Can start immediately.]

- [ ] **Session.json path:** Change README.md:633 from `.claude/turboshovel/workflows/session.json` to `.claude/turboshovel/session.json`
- [ ] **IF/ELSE conditionals:** Remove all IF/ELSE documentation (lines 507-520, 587-590, 799-806, 909-914, 1012-1015) OR add "NOT YET IMPLEMENTED" warnings
- [ ] **BLOCKED condition:** Clarify BLOCKED is a task status (not a condition type) OR implement as valid condition type in parser

### After Cross-check → `/revise exclusive`
[Exclusive issues pending cross-check validation]

**VALIDATED (implement):**
[Will be populated after cross-check]

**INVALIDATED (skip):**
[Will be populated after cross-check]

**UNCERTAIN (user decides):**
[Will be populated after cross-check]

### For Consideration (NON-BLOCKING)
[Improvement suggestions found by one or both reviewers]

Reviewer #1 exclusive issues (pending validation):
- [ ] **workflow complete command:** Add to CLI Commands section (Reviewer #1)
- [ ] **Example format consistency:** Update examples to use **Prompt:** marker or note both formats work (Reviewer #1)
- [ ] **STOP syntax:** Document both `STOP "message"` and `STOP (message)` formats (Reviewer #1)
- [ ] **Implicit prompt behavior:** Add explicit statement about step content becoming prompts (Reviewer #1)
- [ ] **Multiple code blocks:** Warn about single code block limitation (Reviewer #1)
- [ ] **Workflow file search:** Document search order for findWorkflowFile (Reviewer #1)
- [ ] **Variable examples:** Add number/string variable usage examples (Reviewer #1)
- [ ] **Workflow ID format:** Document format pattern (Reviewer #1)
- [ ] **Hook integration claims:** Verify SubagentStop parsing and SessionStart injection (Reviewer #1)
- [ ] **Nested workflows:** Document or mark as experimental (Reviewer #1)

Reviewer #2 exclusive issues (pending validation):
- [ ] **Command execution model:** Explain that commands aren't auto-executed (Reviewer #2)
- [ ] **Variable setting API:** Show how agents set variables programmatically (Reviewer #2)
- [ ] **DONE action:** Expand description in Actions table (Reviewer #2)
- [ ] **Status output format:** Verify example matches actual CLI output (Reviewer #2)
- [ ] **Migration guide:** Add practical integration examples (Reviewer #2)

### Divergences (Resolved)
[Areas where reviewers disagreed - resolved during collation]

None

## Overall Assessment

**Ready to proceed?** NO - WITH CRITICAL CHANGES

**Reasoning:**
Two BLOCKING issues must be addressed before documentation can be trusted:

1. **Session.json path** is objectively wrong and will cause debugging confusion
2. **IF/ELSE conditionals** are documented extensively but not implemented, creating false expectations

These are not opinion-based suggestions - they are factual errors where documentation contradicts implementation. Both reviewers independently verified against source code (state.ts, parser.ts, helpers.ts).

The BLOCKED condition issue is less severe (may be semantic confusion about task status vs condition type) but still needs clarification.

**Critical items requiring attention:**
1. Fix session.json path documentation (trivial fix, high impact)
2. Remove or mark IF/ELSE as unimplemented (moderate fix, prevents broken workflows)
3. Clarify BLOCKED usage (minor fix, prevents syntax errors)

**Confidence level:**
- **High confidence issues (common):** 3 issues with VERY HIGH confidence (both reviewers found independently)
- **Moderate confidence issues (exclusive):** 20 issues pending cross-check validation
- **Investigation required (divergences):** 0 issues (complete agreement)

Both reviewers provided HIGH confidence in their findings because they verified against actual TypeScript implementation, not just reading documentation. Review #1 inspected parser.ts, helpers.ts, state.ts, types.ts, and workflow-cli.ts. Review #2 verified same files and noted absence of IF/ELSE tests.

## Next Steps

### Parallel Workflow (Recommended)

1. **Now:** `/revise common` - Fix 3 common issues immediately (session path, IF/ELSE, BLOCKED)
2. **Background:** Cross-check validates 20 exclusive issues
3. **When ready:** `/revise exclusive` - Implement validated exclusive issues
4. **Or:** `/revise all` - Implement everything actionable

### Sequential Workflow

**Because status is BLOCKED:**
1. `/revise common` - Address 2 BLOCKING issues (session path, IF/ELSE) + 1 clarification (BLOCKED)
2. Wait for cross-check to complete
3. Review UNCERTAIN exclusive issues (user decides)
4. `/revise exclusive` - Address VALIDATED exclusive issues (documentation completeness)

**After fixes applied:**
- Re-review Workflow System section for accuracy
- Verify migration guide includes fixed information
- Test example workflows against actual parser

### Cross-check States

| State | Meaning | Action |
|-------|---------|--------|
| VALIDATED | Cross-check confirmed issue exists | Implement via `/revise exclusive` |
| INVALIDATED | Cross-check found issue doesn't apply | Skip (auto-excluded from `/revise`) |
| UNCERTAIN | Cross-check couldn't determine | User reviews and decides |

---

## Collation Methodology

**Process:**
1. Read both review files completely
2. Extract all BLOCKING and SUGGESTION issues
3. Compare findings line-by-line for overlap
4. Categorize as common (both found), exclusive (one found), or divergence (disagree)
5. Preserve original severity assessments from each reviewer
6. Note evidence locations for verification

**Common issue identification:**
- Same file location referenced
- Same code construct discussed
- Same incorrect behavior or missing documentation
- Independent discovery (not mentioned in opposite review)

**Quality checks:**
- Verified both reviewers used same ground truth (TypeScript implementation)
- Confirmed both reviewers checked same README section (lines 389-1104)
- Noted different confidence levels where applicable
- Preserved all original findings without interpretation bias

**Collation confidence:**
VERY HIGH for common issues (two independent verifications against source code)
MODERATE for exclusive issues (single verification, awaiting cross-check)
