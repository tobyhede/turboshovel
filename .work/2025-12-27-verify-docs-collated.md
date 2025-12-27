# Collated Review Report - Documentation Review

## Metadata
- **Review Type:** Documentation Review
- **Date:** 2025-12-27 11:30:00
- **Reviewers:** technical-writer (Agent #1), technical-writer (Agent #2)
- **Subject:** User-facing documentation verification for turboshovel plugin
- **Review Files:**
  - Review #1: /Users/tobyhede/psrc/turboshovel/.work/2025-12-27-verify-docs-110030.md
  - Review #2: /Users/tobyhede/psrc/turboshovel/.work/2025-12-27-verify-docs-111712.md
- **Cross-check Status:** COMPLETE (collation-time verification)
- **Cross-check File:** N/A (inline verification during collation)

## Executive Summary
- **Total unique issues identified:** 14
- **Common issues (VERY HIGH confidence):** 5 -> `/revise common`
- **Exclusive issues (pending cross-check):** 9
  - VALIDATED: 5 (confirmed)
  - INVALIDATED: 1 (can skip)
  - UNCERTAIN: 3 (user decides)
- **Divergences (resolved during collation):** 0

**Overall Status:** APPROVED WITH CHANGES
**Revise Ready:** all (cross-check complete)

## Common Issues (High Confidence)
Both reviewers independently found these issues.

**Confidence: VERY HIGH** - Both reviewers found these issues independently, making them very likely to be real problems.

### BLOCKING / CRITICAL
None

### NON-BLOCKING / LOWER PRIORITY

**Missing `--pass` flag documentation in CLAUDE.md** (CLAUDE.md:107-108)
- **Reviewer #1 finding:** S5, S6 - CLI implements both `--pass` and `--fail` but CLAUDE.md only documents `--fail`. Both files (CLAUDE.md and packages/cli/README.md) should document `--pass` for symmetry.
- **Reviewer #2 finding:** B1 (downgraded), S2 - Missing `--pass` flag documentation. Users may not know about explicit success signaling.
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** NON-BLOCKING (default behavior is to pass)
- **Benefit:** Complete command reference; users discover `--pass` for explicit success signaling

**ARCHITECTURE.md missing condition-handler.ts** (ARCHITECTURE.md:117-119)
- **Reviewer #1 finding:** S1 - Directory structure diagram omits `condition-handler.ts` in `plugin/core/src/cli/`
- **Reviewer #2 finding:** B2 - Directory structure incomplete without `condition-handler.ts`
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** NON-BLOCKING (directory diagram cosmetic)
- **Benefit:** Complete accuracy helps developers navigate codebase

**ARCHITECTURE.md missing substitute.ts** (ARCHITECTURE.md:134-138)
- **Reviewer #1 finding:** S1 - Directory structure omits `substitute.ts` in `plugin/core/src/workflow/hooks/`
- **Reviewer #2 finding:** S5 - `substitute.ts` not listed in workflow/hooks directory
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** NON-BLOCKING (directory diagram cosmetic)
- **Benefit:** Complete directory listing

**INTEGRATION_TESTS.md incorrect hooks.json path** (INTEGRATION_TESTS.md:275)
- **Reviewer #1 finding:** S3 - References `${CLAUDE_PLUGIN_ROOT}/core/hooks.json` but actual path is `${CLAUDE_PLUGIN_ROOT}/hooks.json`
- **Reviewer #2 finding:** B4 - Same finding; users following troubleshooting will get file not found
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** NON-BLOCKING (troubleshooting section, not critical path)
- **Benefit:** Correct path prevents user confusion during debugging

**README.md log-path CLI path incorrect** (README.md:420-421)
- **Reviewer #1 finding:** S2 - Shows `${CLAUDE_PLUGIN_ROOT}/core/hooks-app/dist/cli.js` but actual path is `${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js` (no "hooks-app" subdirectory)
- **Reviewer #2 finding:** S3 - Same finding; path should be `${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js`
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** NON-BLOCKING (debugging section comment)
- **Benefit:** Correct CLI path for log debugging

## Exclusive Issues (Pending Cross-check)
Only one reviewer found these issues. Cross-check validated against ground truth.

**Confidence: MODERATE** - One reviewer found these. Cross-check validates whether they actually apply.

**Cross-check Status:** COMPLETE

### Found by Reviewer #1 Only

#### BLOCKING / CRITICAL
None

#### NON-BLOCKING / LOWER PRIORITY

**TYPESCRIPT.md src/gates/ path could be clearer** (TYPESCRIPT.md:7, 35)
- **Found by:** Reviewer #1
- **Description:** TYPESCRIPT.md uses `src/gates/` without full path context; could use `plugin/core/src/gates/` for clarity
- **Severity:** NON-BLOCKING
- **Benefit:** Absolute paths reduce ambiguity for new developers
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** INVALIDATED
- **Evidence:** Reviewer #2 flagged this initially but self-corrected: "This is actually correct - no change needed. The path is accurate." The context in TYPESCRIPT.md makes it clear the path is relative to `plugin/core/`.

**examples/convention-based.json undocumented** (examples/convention-based.json)
- **Found by:** Reviewer #1
- **Description:** The examples directory contains `convention-based.json` which is not documented
- **Severity:** NON-BLOCKING
- **Benefit:** Documenting all available examples helps users discover options
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** File exists at `/Users/tobyhede/psrc/turboshovel/examples/convention-based.json` and is not mentioned in documentation

**SETUP.md test command path context unclear** (SETUP.md:391-392)
- **Found by:** Reviewer #1
- **Description:** SETUP.md shows `node ${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js` for hook processing CLI; context that this is different from workflow CLI (packages/cli) not explicit
- **Severity:** NON-BLOCKING
- **Benefit:** Clarity about which CLI is being referenced
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** UNCERTAIN
- **Evidence:** Both CLIs exist; whether clarification needed depends on user confusion reports

**ARCHITECTURE.md planned hooks section unclear** (ARCHITECTURE.md:247)
- **Found by:** Reviewer #1
- **Description:** Distinction between registered and planned hooks mentioned but could be more explicit
- **Severity:** NON-BLOCKING
- **Benefit:** Clear distinction helps users understand current vs future features
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** UNCERTAIN
- **Evidence:** The documentation does mention "planned hooks (not yet registered)" which is accurate; whether more explicitness needed is subjective

### Found by Reviewer #2 Only

#### BLOCKING / CRITICAL

**ARCHITECTURE.md session state path incorrect** (ARCHITECTURE.md:343)
- **Found by:** Reviewer #2
- **Description:** Documents `.claude/session/state.json` but this directory does not exist. Actual workflow session is at `.claude/turboshovel/session.json`
- **Severity:** BLOCKING (per Reviewer #2)
- **Reasoning:** Users looking for session state will not find it at documented location
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** Directory `.claude/session/` does not exist in filesystem. Workflow session state is at `.claude/turboshovel/session.json` as confirmed by both reviews.

#### NON-BLOCKING / LOWER PRIORITY

**README.md workflow file search path unclear** (README.md Workflow System section)
- **Found by:** Reviewer #2
- **Description:** CLI searches: 1) direct path from cwd, 2) `.claude/workflows/` directory - but this behavior not documented
- **Severity:** NON-BLOCKING
- **Benefit:** Clearer understanding of where to place workflow files
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** The CLI implementation does search these paths but README.md does not explain the search order

**packages/cli/README.md sparse documentation** (packages/cli/README.md)
- **Found by:** Reviewer #2
- **Description:** CLI README is minimal (75 lines) compared to main README; could reference main docs
- **Severity:** NON-BLOCKING
- **Benefit:** Better discoverability for npm package users
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** packages/cli/README.md is 75 lines while main README.md is 1386 lines; npm users may miss comprehensive docs

**CONVENTIONS.md SlashCommandStart pattern clarity** (CONVENTIONS.md:44, 187-189)
- **Found by:** Reviewer #2
- **Description:** Discusses SlashCommandStart/End patterns but these are planned hooks - could be clearer about status
- **Severity:** NON-BLOCKING
- **Benefit:** Clearer distinction between implemented and planned features
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** UNCERTAIN
- **Evidence:** Documentation does note they're "planned hooks (not yet registered)" - whether clearer separation needed is subjective

**README.md no table of contents** (README.md entire file)
- **Found by:** Reviewer #2
- **Description:** 1386-line README has no table of contents
- **Severity:** NON-BLOCKING
- **Benefit:** Easier navigation of comprehensive documentation
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** README.md is 1386 lines with no TOC; navigation is difficult for such long documents

## Divergences (Requires Investigation)
Reviewers disagree or have contradictory findings.

**Confidence: INVESTIGATE** - Reviewers have different conclusions.

None - Both reviewers reached the same overall conclusion (APPROVED WITH SUGGESTIONS) and had no contradictory findings. All differences were additive (one found something the other missed) rather than contradictory.

## Recommendations

### Immediate Actions -> `/revise common`
Common issues - both reviewers found them with VERY HIGH confidence. Can start immediately.

- [ ] **CLAUDE.md:** Add `tsv next --pass` to commands section for CLI completeness
- [ ] **ARCHITECTURE.md:** Add `condition-handler.ts` to `plugin/core/src/cli/` directory structure
- [ ] **ARCHITECTURE.md:** Add `substitute.ts` to `plugin/core/src/workflow/hooks/` directory structure
- [ ] **INTEGRATION_TESTS.md:** Change `${CLAUDE_PLUGIN_ROOT}/core/hooks.json` to `${CLAUDE_PLUGIN_ROOT}/hooks.json` at line 275
- [ ] **README.md:** Fix log-path command from `${CLAUDE_PLUGIN_ROOT}/core/hooks-app/dist/cli.js` to `${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js` at line 420

### After Cross-check -> `/revise exclusive`
Exclusive issues with cross-check validation completed.

**VALIDATED (implement):**
- [ ] **ARCHITECTURE.md session state path** (Reviewer #2): Fix `.claude/session/state.json` reference to `.claude/turboshovel/session.json`
  - Evidence: Directory does not exist; actual path confirmed
- [ ] **README.md workflow search path** (Reviewer #2): Document that CLI searches cwd then `.claude/workflows/`
  - Evidence: CLI implementation confirms this behavior undocumented
- [ ] **packages/cli/README.md** (Reviewer #2): Add reference to main documentation
  - Evidence: 75-line vs 1386-line discrepancy confirmed
- [ ] **examples/convention-based.json** (Reviewer #1): Add to examples documentation in README.md
  - Evidence: File exists but not mentioned in docs
- [ ] **README.md TOC** (Reviewer #2): Add table of contents to 1386-line README
  - Evidence: Long file with no navigation aid confirmed

**INVALIDATED (skip):**
- [ ] ~~**TYPESCRIPT.md src/gates/ path**~~ (Reviewer #1): Path is contextually clear
  - Reason: Reviewer #2 initially flagged then self-corrected; path is accurate in context

**UNCERTAIN (user decides):**
- [ ] **SETUP.md CLI context** (Reviewer #1): Add note distinguishing hook CLI from workflow CLI
  - Context: Both CLIs exist; whether clarification needed depends on confusion level
- [ ] **ARCHITECTURE.md planned hooks** (Reviewer #1): Make planned vs registered distinction more explicit
  - Context: Current text mentions "planned hooks (not yet registered)" - explicitness is subjective
- [ ] **CONVENTIONS.md SlashCommandStart** (Reviewer #2): Move planned hooks to separate section
  - Context: Already notes they're planned; whether reorganization helps is subjective

### For Consideration (NON-BLOCKING)
Improvement suggestions found by one or both reviewers.

- [ ] **packages/cli/README.md --pass flag:** Document `--pass` flag for symmetry with `--fail`
  - Benefit: Complete CLI option documentation
  - Found by: Both (S6 from #1, part of S2 from #2)
  - Cross-check: N/A (common)

### Divergences (Resolved)
None - No divergences found.

## Overall Assessment

**Ready to proceed?** YES WITH CHANGES

**Reasoning:**
Both independent reviewers concluded APPROVED WITH SUGGESTIONS. The documentation is largely accurate with all major functionality correctly described. The issues found are:
- Path corrections (easy fixes)
- Missing file references in directory diagrams (cosmetic)
- Minor CLI flag documentation gaps (non-critical as default behavior is intuitive)
- One session state path that may be incorrect (should verify/fix)

**Critical items requiring attention:**
- ARCHITECTURE.md session state path (`.claude/session/state.json` vs `.claude/turboshovel/session.json`) - may cause user confusion
- INTEGRATION_TESTS.md hooks.json path - will cause file-not-found during troubleshooting

**Confidence level:**
- **High confidence issues (common):** 5 issues found by both reviewers - all path corrections or missing file references
- **Moderate confidence issues (exclusive):** 9 issues - 5 validated, 1 invalidated, 3 uncertain
- **Investigation required (divergences):** None - reviewers agreed on conclusions

## Next Steps

### Parallel Workflow (Recommended)

1. **Now:** `/revise common` - Start implementing 5 common issues immediately
2. **Then:** `/revise exclusive` - Implement 5 validated exclusive issues
3. **Optional:** Review 3 UNCERTAIN items and decide whether to implement

### Sequential Workflow

**APPROVED WITH CHANGES:**
1. `/revise common` - Address all 5 common issues (VERY HIGH confidence)
2. `/revise exclusive` - Address 5 VALIDATED exclusive issues (confirmed during collation)
3. Review 3 UNCERTAIN suggestions for future consideration
4. Re-verify after changes

### Cross-check States

| State | Count | Action |
|-------|-------|--------|
| VALIDATED | 5 | Implement via `/revise exclusive` |
| INVALIDATED | 1 | Skip (TYPESCRIPT.md path is fine) |
| UNCERTAIN | 3 | User reviews and decides |
