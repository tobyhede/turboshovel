# Collated Review Report - Documentation Review

## Metadata
- **Review Type:** Documentation Review
- **Date:** 2025-12-28 17:00:00
- **Reviewers:** technical-writer (Agent 1), Documentation verification agent (Agent 2)
- **Subject:** User-facing documentation (README.md, CLAUDE.md, SETUP.md, CONVENTIONS.md, TYPESCRIPT.md, ARCHITECTURE.md)
- **Review Files:**
  - Review #1: /Users/tobyhede/psrc/turboshovel/.work/verify-user-docs/2025-12-28-verify-docs-agent1.md
  - Review #2: /Users/tobyhede/psrc/turboshovel/.work/verify-user-docs/2025-12-28-verify-docs-agent2.md
- **Cross-check Status:** PENDING
- **Cross-check File:** N/A

## Executive Summary
- **Total unique issues identified:** 22
- **Common issues (VERY HIGH confidence):** 6 (1 BLOCKING, 5 NON-BLOCKING)
- **Exclusive issues (pending cross-check):** 16
  - VALIDATED: 0 (pending cross-check)
  - INVALIDATED: 0 (pending cross-check)
  - UNCERTAIN: 16 (pending cross-check)
- **Divergences (resolved during collation):** 0

**Overall Status:** APPROVED WITH CHANGES
**Revise Ready:** common (cross-check pending for exclusive issues)

---

## Common Issues (High Confidence)
Both reviewers independently found these issues.

**Confidence: VERY HIGH** - Both reviewers found these issues independently, making them very likely to be real problems.

### BLOCKING / CRITICAL

**[C-B1] `tsv complete` command documentation mismatch** (CLAUDE.md:112)
- **Reviewer #1 finding:** CLAUDE.md documents `tsv complete` command but doesn't clarify difference from `tsv stop`. The "complete" command marks done but keeps state vs "stop" aborts and deletes state. (BLOCKING)
- **Reviewer #2 finding:** CLAUDE.md line 112 lists `tsv complete` but behavior differs from documentation. CLI requires `--status` option. (BLOCKING)
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Update CLAUDE.md to accurately document `tsv complete` command syntax and clarify difference from `tsv stop`. Include `--status <ok|blocked>` syntax if applicable.

### NON-BLOCKING / LOWER PRIORITY

**[C-S1] Getting started / quick-win example needs improvement** (README.md Quick Start)
- **Reviewer #1 finding:** Missing complete end-to-end 5-minute example for new users to validate installation. (SUGGESTION)
- **Reviewer #2 finding:** Quick Start section buried after installation details. Users need to scroll to understand value proposition. (SUGGESTION)
- **Confidence:** VERY HIGH (both suggested independently)
- **Benefit:** New users would understand the value faster and be able to validate installation immediately

**[C-S2] README.md workflow section too long / duplication with CLAUDE.md** (README.md lines 466-1349)
- **Reviewer #1 finding:** ~700 lines of workflow documentation in README.md is overwhelming; duplicates ARCHITECTURE.md content. (SUGGESTION)
- **Reviewer #2 finding:** CLAUDE.md concise command list vs README.md 1000+ lines of workflow docs - duplication increases maintenance burden. (SUGGESTION)
- **Confidence:** VERY HIGH (both suggested independently)
- **Benefit:** Single source of truth reduces inconsistency risk; README would be scannable

**[C-S3] SubagentStart context injection status confusing** (README.md line 109)
- **Reviewer #1 finding:** SubagentStart shown as "Not implemented" for context injection but doesn't clarify gates still work. (SUGGESTION)
- **Reviewer #2 finding:** README says "Not implemented" but hooks.json registers SubagentStart. Distinction is context file discovery isn't implemented, not the hook itself. (SUGGESTION)
- **Confidence:** VERY HIGH (both found independently)
- **Benefit:** Users understand what works vs what doesn't for SubagentStart hook

**[C-S4] Example files not documented in detail** (CONVENTIONS.md, README.md examples section)
- **Reviewer #1 finding:** README says "See examples/" but doesn't describe what each example does. (SUGGESTION)
- **Reviewer #2 finding:** examples/context/ directory files exist but CONVENTIONS.md only briefly mentions them. (SUGGESTION)
- **Confidence:** VERY HIGH (both suggested independently)
- **Benefit:** Users would have clearer guidance on real-world patterns

**[C-S5] TYPESCRIPT.md path references incorrect / missing shared package coverage** (TYPESCRIPT.md)
- **Reviewer #1 finding:** TYPESCRIPT.md instructs users to create gates in `plugin/core/src/gates/` which is inside the plugin, not user's project. Needs clarification. (SUGGESTION)
- **Reviewer #2 finding:** TYPESCRIPT.md references `plugin/core/src/types.ts` but types are in `packages/shared/src/types.ts`. Missing @turboshovel/shared package documentation. (SUGGESTION - also BLOCKING B3)
- **Confidence:** VERY HIGH (both found path/types issues independently)
- **Benefit:** Developers would know correct locations for types and gate creation

---

## Exclusive Issues (Pending Cross-check)
Only one reviewer found these issues. Cross-check will validate against ground truth.

**Confidence: MODERATE** - One reviewer found these. Cross-check validates whether they actually apply.

**Cross-check Status:** PENDING

### Found by Reviewer #1 Only

#### BLOCKING / CRITICAL

**[E1-B1] @turboshovel/shared package not published to npm** (README.md lines 27-28, packages/cli/package.json line 32)
- **Found by:** Reviewer #1
- **Description:** CLI package depends on @turboshovel/shared, but it's NOT published to npm. Users following installation instructions will get dependency resolution errors.
- **Severity:** BLOCKING
- **Reasoning:** Critical getting-started blocker - users cannot install globally
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Reviewer claims verified with `npm view`

**[E1-B2] Plugin installation command syntax may be incorrect** (README.md lines 17-22)
- **Found by:** Reviewer #1
- **Description:** README shows `claude plugin marketplace add tobyhede/turboshovel` and `claude plugin install turboshovel@turboshovel`. Syntax may not match Claude Code plugin CLI.
- **Severity:** BLOCKING
- **Reasoning:** Users may not be able to install the plugin if syntax is wrong
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Reviewer could not verify against Claude Code docs

#### NON-BLOCKING / LOWER PRIORITY

**[E1-S1] CONVENTIONS.md references non-existent commands** (CONVENTIONS.md lines 259, 276, etc.)
- **Found by:** Reviewer #1
- **Description:** CONVENTIONS.md references `/turboshovel:code-review` and `/turboshovel:plan` commands, but only `/turboshovel:verify` is implemented.
- **Severity:** NON-BLOCKING
- **Benefit:** Users won't be confused about which commands exist
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**[E1-S2] ARCHITECTURE.md mentions planned hooks without timeline** (ARCHITECTURE.md line 247, README.md line 122)
- **Found by:** Reviewer #1
- **Description:** Planned hooks (SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd) mentioned without implementation indication.
- **Severity:** NON-BLOCKING
- **Benefit:** Users know what to expect
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**[E1-S3] Debugging section needs more examples** (README.md lines 410-429)
- **Found by:** Reviewer #1
- **Description:** Debugging section shows log path but doesn't show example log output or common error patterns.
- **Severity:** NON-BLOCKING
- **Benefit:** Users can self-diagnose issues
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**[E1-S4] IF/ELSE conditional syntax documented but not implemented** (README.md lines 675-687)
- **Found by:** Reviewer #1
- **Description:** README extensively documents IF/ELSE conditional syntax but notes "NOT YET IMPLEMENTED".
- **Severity:** NON-BLOCKING
- **Benefit:** Users won't try to use unimplemented features
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**[E1-S5] Session state directory path inconsistency** (ARCHITECTURE.md lines 330-343)
- **Found by:** Reviewer #1
- **Description:** Documentation mentions `.claude/session/state.json` but actual path may differ.
- **Severity:** NON-BLOCKING
- **Benefit:** Users can find actual state files
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**[E1-S6] N-Verification skill uses "workflow" command not "tsv"** (plugin/skills/verifying-by-consensus/SKILL.md line 40)
- **Found by:** Reviewer #1
- **Description:** Skill references `workflow start` but CLI command is `tsv start`.
- **Severity:** NON-BLOCKING
- **Benefit:** Consistency in command references
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

### Found by Reviewer #2 Only

#### BLOCKING / CRITICAL

**[E2-B1] README.md title "Quality Hooks" inconsistent with project name** (README.md:1)
- **Found by:** Reviewer #2
- **Description:** README.md header says "# Quality Hooks" while project is named "Turboshovel" everywhere else.
- **Severity:** BLOCKING
- **Reasoning:** Users may be confused about project identity
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** Header text verification

**[E2-B2] README.md config location path inconsistency** (README.md:373)
- **Found by:** Reviewer #2
- **Description:** References to `plugin/gates.json` vs plugin root paths are inconsistent.
- **Severity:** BLOCKING
- **Reasoning:** Paths work but consistency varies, causing confusion
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

#### NON-BLOCKING / LOWER PRIORITY

**[E2-S1] N-Verification phases could be clearer** (README.md:430-457)
- **Found by:** Reviewer #2
- **Description:** Phase descriptions abbreviated. Skill file has more detail about "Common (N/N)" vs "Exclusive (<N/N)".
- **Severity:** NON-BLOCKING
- **Benefit:** Users would understand consensus-based verification better
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**[E2-S2] SETUP.md missing npm test/build verification step** (SETUP.md:383-396)
- **Found by:** Reviewer #2
- **Description:** "Testing Your Configuration" shows jq validation but doesn't mention running npm test/build to verify commands work.
- **Severity:** NON-BLOCKING
- **Benefit:** Users would catch command configuration issues earlier
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**[E2-S3] INTEGRATION_TESTS.md not linked prominently** (README.md:464)
- **Found by:** Reviewer #2
- **Description:** INTEGRATION_TESTS.md contains valuable troubleshooting patterns but only mentioned once.
- **Severity:** NON-BLOCKING
- **Benefit:** Users troubleshooting would find diagnostic steps faster
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**[E2-S4] Default shell gates shows "clippy" keyword** (README.md:295-298)
- **Found by:** Reviewer #2
- **Description:** "clippy" as keyword is Rust-specific and may confuse non-Rust users.
- **Severity:** NON-BLOCKING
- **Benefit:** More language-agnostic presentation
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**[E2-S5] CLI development instructions could clarify npm workspace** (README.md:1351-1375)
- **Found by:** Reviewer #2
- **Description:** Development section shows manual cd between directories but project uses npm workspaces.
- **Severity:** NON-BLOCKING
- **Benefit:** Contributors would understand monorepo structure better
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

---

## Divergences (Requires Investigation)

**Confidence: INVESTIGATE** - Reviewers have different conclusions. Verification analysis included.

None identified. Both reviewers reached the same overall status (APPROVED WITH SUGGESTIONS) and their findings complement rather than contradict each other.

---

## Recommendations

### Immediate Actions (Common Issues)

These are VERY HIGH confidence issues - both reviewers found them independently.

- [ ] **[C-B1] Fix `tsv complete` documentation:** Update CLAUDE.md to accurately reflect command syntax and clarify difference from `tsv stop`
- [ ] **[C-S1] Improve getting started experience:** Add brief "What it does" section before installation or create 5-minute quick-win example
- [ ] **[C-S2] Reduce README.md workflow duplication:** Extract to dedicated WORKFLOWS.md, keep concise reference in README
- [ ] **[C-S3] Clarify SubagentStart status:** Note that gates work but context injection pattern isn't implemented yet
- [ ] **[C-S4] Document examples in detail:** Add descriptions of what each example file demonstrates
- [ ] **[C-S5] Fix TYPESCRIPT.md paths:** Update type import paths and clarify @turboshovel/shared package

### After Cross-check

**VALIDATED (implement):**
- Pending cross-check validation

**INVALIDATED (skip):**
- Pending cross-check validation

**UNCERTAIN (user decides):**
- All 16 exclusive issues pending cross-check

### For Consideration (NON-BLOCKING)

| Issue | Description | Found by | Benefit |
|-------|-------------|----------|---------|
| [E1-S1] | CONVENTIONS.md references non-existent commands | Agent 1 | Clarity |
| [E1-S2] | Planned hooks without timeline | Agent 1 | User expectations |
| [E1-S3] | Debugging section needs examples | Agent 1 | Self-diagnosis |
| [E1-S4] | IF/ELSE documented but not implemented | Agent 1 | Avoid confusion |
| [E1-S5] | Session state directory path | Agent 1 | Findability |
| [E1-S6] | N-Verification "workflow" vs "tsv" | Agent 1 | Consistency |
| [E2-S1] | N-Verification phases clarity | Agent 2 | Understanding |
| [E2-S2] | SETUP.md missing test step | Agent 2 | Early error detection |
| [E2-S3] | INTEGRATION_TESTS.md not prominent | Agent 2 | Troubleshooting |
| [E2-S4] | "clippy" keyword Rust-specific | Agent 2 | Language-agnostic |
| [E2-S5] | npm workspace documentation | Agent 2 | Contributor clarity |

### Divergences (Resolved)

None - no divergences identified.

---

## Overall Assessment

**Ready to proceed?** YES WITH CHANGES

**Reasoning:**
Both reviewers independently reached "APPROVED WITH SUGGESTIONS" status. The documentation is comprehensive and covers all major features. The one BLOCKING common issue (tsv complete command documentation) is straightforward to fix. Most findings are quality improvements rather than critical blockers.

**Critical items requiring attention:**
1. **[C-B1]** `tsv complete` command documentation mismatch - both reviewers flagged this
2. **[E1-B1]** @turboshovel/shared npm publication - needs cross-check verification (critical if true)
3. **[E2-B1]** README.md "Quality Hooks" title inconsistency - needs cross-check verification

**Confidence level:**
- **High confidence issues (common):** 6 issues (1 BLOCKING, 5 NON-BLOCKING) - proceed with fixes
- **Moderate confidence issues (exclusive):** 16 issues (4 BLOCKING, 12 NON-BLOCKING) - await cross-check
- **Investigation required (divergences):** 0 issues - reviewers aligned

---

## Next Steps

### Recommended Workflow

1. **Now:** Address common issues immediately (VERY HIGH confidence)
   - Fix [C-B1] `tsv complete` documentation
   - Implement [C-S1] through [C-S5] quality improvements

2. **Parallel:** Request cross-check to validate exclusive issues
   - Priority: [E1-B1] npm package, [E1-B2] plugin syntax, [E2-B1] title, [E2-B2] paths

3. **After cross-check:** Address validated exclusive issues

### Cross-check States

| State | Meaning | Action |
|-------|---------|--------|
| VALIDATED | Cross-check confirmed issue exists | Implement fix |
| INVALIDATED | Cross-check found issue doesn't apply | Skip |
| UNCERTAIN | Cross-check couldn't determine | User reviews and decides |

---

## Appendix: Issue Mapping

### Review #1 Issues
| ID | Issue | Mapped To |
|----|-------|-----------|
| B1 | @turboshovel/shared not published | [E1-B1] Exclusive |
| B2 | tsv complete vs tsv stop confusion | [C-B1] Common |
| B3 | Plugin installation syntax | [E1-B2] Exclusive |
| S1 | Missing quick-win example | [C-S1] Common |
| S2 | CLAUDE.md commands inconsistency | [C-S2] Common (merged with S3) |
| S3 | README workflow section too long | [C-S2] Common |
| S4 | SubagentStart confusion | [C-S3] Common |
| S5 | CONVENTIONS.md non-existent commands | [E1-S1] Exclusive |
| S6 | Example files not documented | [C-S4] Common |
| S7 | TYPESCRIPT.md path references | [C-S5] Common |
| S8 | Planned hooks no timeline | [E1-S2] Exclusive |
| S9 | Debugging examples | [E1-S3] Exclusive |
| S10 | IF/ELSE not implemented | [E1-S4] Exclusive |
| S11 | Session state path | [E1-S5] Exclusive |
| S12 | N-Verification "workflow" vs "tsv" | [E1-S6] Exclusive |

### Review #2 Issues
| ID | Issue | Mapped To |
|----|-------|-----------|
| B1 | tsv complete undefined | [C-B1] Common |
| B2 | README title inconsistency | [E2-B1] Exclusive |
| B3 | TYPESCRIPT.md types.ts path | [C-S5] Common (merged) |
| B4 | Config location path inconsistency | [E2-B2] Exclusive |
| S1 | Getting started prominence | [C-S1] Common |
| S2 | CLAUDE.md/README duplication | [C-S2] Common |
| S3 | Example context files | [C-S4] Common |
| S4 | N-Verification phases | [E2-S1] Exclusive |
| S5 | SETUP.md test step | [E2-S2] Exclusive |
| S6 | Missing @turboshovel/shared | [C-S5] Common (merged) |
| S7 | SubagentStart status | [C-S3] Common |
| S8 | INTEGRATION_TESTS.md linking | [E2-S3] Exclusive |
| S9 | "clippy" keyword | [E2-S4] Exclusive |
| S10 | npm workspace structure | [E2-S5] Exclusive |
