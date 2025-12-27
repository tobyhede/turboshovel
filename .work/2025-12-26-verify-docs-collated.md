# Collated Review Report - Documentation Verification

## Metadata
- **Review Type:** Documentation Review
- **Date:** 2025-12-26 23:35:00
- **Reviewers:** technical-writer (Agent #1), technical-writer (Agent #2)
- **Subject:** User-facing documentation verification (README.md, CLAUDE.md, SETUP.md, CONVENTIONS.md, TYPESCRIPT.md, ARCHITECTURE.md, packages/cli/README.md, INTEGRATION_TESTS.md)
- **Review Files:**
  - Review #1: /Users/tobyhede/psrc/turboshovel/.work/2025-12-26-verify-docs-232800.md
  - Review #2: /Users/tobyhede/psrc/turboshovel/.work/2025-12-26-verify-docs-232722.md
- **Cross-check Status:** PENDING
- **Cross-check File:** N/A

## Executive Summary
- **Total unique issues identified:** 16
- **Common issues (VERY HIGH confidence):** 4 (all BLOCKING)
- **Exclusive issues (pending cross-check):** 12
  - Agent #1 exclusive: 2 BLOCKING, 8 SUGGESTIONS
  - Agent #2 exclusive: 2 BLOCKING, 8 SUGGESTIONS (note: some overlap in suggestions)
  - VALIDATED: 0 (pending)
  - INVALIDATED: 0 (pending)
  - UNCERTAIN: 12 (pending)
- **Divergences (resolved during collation):** 1 (overall status assessment)

**Overall Status:** BLOCKED
**Revise Ready:** common (exclusive issues pending cross-check)

---

## Common Issues (High Confidence)
Both reviewers independently found these issues.

**Confidence: VERY HIGH** - Both reviewers found these issues independently, making them very likely to be real problems.

### BLOCKING / CRITICAL

**1. Examples directory path mismatch - plugin/examples/ and plugin/core/examples/ do not exist** (Multiple files)
- **Reviewer #1 finding:** README.md references `plugin/examples/` at lines 1346, 1380-1386. CONVENTIONS.md line 368-373 references `plugin/core/examples/context/`. Both paths do not exist - actual examples are at root `examples/`.
- **Reviewer #2 finding:** README.md lines 1379-1386, CONVENTIONS.md line 368, SETUP.md lines 74, 84, 320, 325, 330, 634 all reference `plugin/examples/`, `plugin/core/examples/`, or `${CLAUDE_PLUGIN_ROOT}/core/examples/` which do not exist.
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Update all references from `plugin/examples/`, `plugin/core/examples/`, and `${CLAUDE_PLUGIN_ROOT}/core/examples/` to `examples/` (root level)

**2. SETUP.md references non-existent plugin/core/ paths for gates.json and examples** (SETUP.md)
- **Reviewer #1 finding:** SETUP.md lines 60-61, 74, 83-84, 320-335, 634-639 reference `${CLAUDE_PLUGIN_ROOT}/core/gates.json` but actual gates.json is at `plugin/gates.json` (not in core subdirectory)
- **Reviewer #2 finding:** SETUP.md lines 74, 84, 320, 325, 330, 634 reference `${CLAUDE_PLUGIN_ROOT}/core/examples/` which does not exist
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Update paths to use `${CLAUDE_PLUGIN_ROOT}/gates.json` (without core/) and correct examples paths

**3. Plugin context directory does not exist** (README.md, CONVENTIONS.md, ARCHITECTURE.md)
- **Reviewer #1 finding:** README.md line 143, CONVENTIONS.md lines 46, 103-107, 119-124 reference `${CLAUDE_PLUGIN_ROOT}/context/` as fallback location, but `plugin/context/` directory does not exist
- **Reviewer #2 finding:** ARCHITECTURE.md lines 101-106 documents `plugin/context/` directory with multiple context files (session-start.md, prompt-submit.md, subagent-stop.md, tool-use.md) that does not exist
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING
- **Action required:** Either create `plugin/context/` directory with documented files or remove/clarify this fallback mechanism in docs

**4. Incorrect workflow command prefix in documentation** (README.md)
- **Reviewer #1 finding:** README.md lines 575-576, 893-997 shows `workflow start`, `workflow next` etc., but CLI uses `tsv` or `turboshovel` commands, not `workflow`
- **Reviewer #2 finding:** README.md uses `workflow` prefix extensively but CLI package uses `tsv` as command name; `turboshovel` is an alias
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING (user commands will fail)
- **Action required:** Change `workflow` to `tsv` throughout documentation, note that `turboshovel` is an alias

### NON-BLOCKING / LOWER PRIORITY

None - all common issues are BLOCKING

---

## Exclusive Issues (Pending Cross-check)
Only one reviewer found these issues. Cross-check will validate against ground truth.

**Confidence: MODERATE** - One reviewer found these. Cross-check validates whether they actually apply.

**Cross-check Status:** PENDING

### Found by Reviewer #1 Only

#### BLOCKING / CRITICAL

**Session state file path discrepancy** (README.md lines 849-851)
- **Found by:** Reviewer #1
- **Description:** README.md claims hook session is at `.claude/session/state.json` but this directory does not exist in the project. Path is technically correct but file is only created on first use.
- **Severity:** BLOCKING (Reviewer #1 rated as "MEDIUM impact" but included in BLOCKING section)
- **Reasoning:** May confuse users who look for the file before any hooks have run
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING
- **Evidence:** N/A

#### NON-BLOCKING / LOWER PRIORITY

**S1: HookInput interface documentation incomplete** (TYPESCRIPT.md lines 104-133)
- **Found by:** Reviewer #1
- **Description:** HookInput interface documentation is missing some fields that exist in actual schemas.ts
- **Severity:** NON-BLOCKING
- **Benefit:** Accurate interface documentation prevents developer confusion
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**S2: Workflow CLI --pass flag not documented** (CLAUDE.md lines 104-114)
- **Found by:** Reviewer #1
- **Description:** CLAUDE.md shows `tsv next --fail` but does not mention `--pass` flag which exists in cli.ts line 129
- **Severity:** NON-BLOCKING
- **Benefit:** Complete command documentation
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**S6: package.json bin field confusion** (plugin/core/package.json)
- **Found by:** Reviewer #1
- **Description:** plugin/core/package.json has bin entry `"workflow": "dist/cli/workflow-cli.js"` but packages/cli is the actual CLI package
- **Severity:** NON-BLOCKING
- **Benefit:** Clear separation of concerns
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**S7: CONVENTIONS.md pre/post stage naming inconsistency** (CONVENTIONS.md lines 165-168)
- **Found by:** Reviewer #1
- **Description:** Says stages are `start`/`pre` and `end`/`post` but examples use different conventions inconsistently
- **Severity:** NON-BLOCKING
- **Benefit:** Clearer documentation
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**S8: Hook Events table verification needed** (README.md lines 100-122)
- **Found by:** Reviewer #1
- **Description:** Hook event table should be verified against hooks.json - some "Not implemented" labels may need updating
- **Severity:** NON-BLOCKING
- **Benefit:** Accurate feature documentation
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

### Found by Reviewer #2 Only

#### BLOCKING / CRITICAL

**Incorrect gates.json path in ARCHITECTURE.md** (ARCHITECTURE.md lines 60-65, 108)
- **Found by:** Reviewer #2
- **Description:** ARCHITECTURE.md references `plugin/core/gates.json` but actual file is at `plugin/gates.json`
- **Severity:** BLOCKING
- **Reasoning:** Self-referential design documentation is inaccurate
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Incorrect hooks.json path in ARCHITECTURE.md** (ARCHITECTURE.md line 108, 156-169)
- **Found by:** Reviewer #2
- **Description:** ARCHITECTURE.md shows hooks.json at `plugin/core/hooks.json` but actual location is `plugin/hooks.json`
- **Severity:** BLOCKING
- **Reasoning:** Documentation does not match actual file locations
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Incorrect CLI path in ARCHITECTURE.md hook config** (ARCHITECTURE.md line 163)
- **Found by:** Reviewer #2
- **Description:** Shows CLI command path as `plugin/hooks/hooks-app/dist/cli.js` but actual path is `plugin/core/dist/cli.js`
- **Severity:** BLOCKING
- **Reasoning:** Example hook configuration is wrong
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

#### NON-BLOCKING / LOWER PRIORITY

**INTEGRATION_TESTS.md modifies plugin gates.json directly** (INTEGRATION_TESTS.md tests 3, 4, 5, 6)
- **Found by:** Reviewer #2
- **Description:** Examples modify `plugin/core/gates.json` directly but docs say users should never modify plugin configuration directly
- **Severity:** NON-BLOCKING
- **Benefit:** Consistency with best practices
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Inconsistent directory structure in ARCHITECTURE.md** (ARCHITECTURE.md lines 97-150)
- **Found by:** Reviewer #2
- **Description:** Directory structure partially matches reality but has inaccuracies (examples/ is at root, not under plugin/core/)
- **Severity:** NON-BLOCKING
- **Benefit:** Accurate documentation helps new contributors
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**CONVENTIONS.md references non-existent slash commands** (CONVENTIONS.md lines 271-303)
- **Found by:** Reviewer #2
- **Description:** References `/turboshovel:code-review`, `/turboshovel:plan` as examples but these are not defined
- **Severity:** NON-BLOCKING
- **Benefit:** Clearer documentation
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Documentation emphasis on planned hooks may confuse users** (README.md line 102, CONVENTIONS.md line 44)
- **Found by:** Reviewer #2
- **Description:** "Planned hooks" (SlashCommandStart, etc.) prominently mentioned but not available
- **Severity:** NON-BLOCKING
- **Benefit:** Clearer expectations
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Missing `complete` command documentation** (packages/cli/README.md)
- **Found by:** Reviewer #2
- **Description:** CLAUDE.md lists `tsv complete` but CLI README.md does not document what it does beyond "Mark complete"
- **Severity:** NON-BLOCKING
- **Benefit:** Complete command documentation
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**ARCHITECTURE.md session state path inconsistency** (ARCHITECTURE.md line 349)
- **Found by:** Reviewer #2
- **Description:** Says hook session state is at `.claude/session/state.json` but may not match implementation
- **Severity:** NON-BLOCKING
- **Benefit:** Accurate state file locations
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

**Outdated comment in gates index.ts** (plugin/core/src/gates/index.ts line 1)
- **Found by:** Reviewer #2
- **Description:** Comment references old path structure `plugin/hooks/hooks-app/src/gates/index.ts`
- **Severity:** NON-BLOCKING
- **Benefit:** Clean codebase
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** PENDING

---

## Divergences (Requires Investigation)

**Confidence: INVESTIGATE** - Reviewers have different conclusions. Verification analysis included.

**Overall Status Assessment Divergence**
- **Reviewer #1 perspective:** Status: BLOCKED - 6 BLOCKING issues requiring immediate fixes
- **Reviewer #2 perspective:** Status: APPROVED WITH SUGGESTIONS - 5 BLOCKING issues but considered less severe
- **Verification Analysis:**
  - **Verifying agent:** Collator analysis
  - **Correct perspective:** Reviewer #1 (more conservative)
  - **Reasoning:** Both reviewers identified critical path errors that will cause user-facing failures (copy commands, configuration lookups). The distinction is semantic - both agree significant fixes are needed before documentation is reliable.
  - **Recommendation:** Use BLOCKED status given the number of BLOCKING issues affecting user workflows
- **Confidence:** RESOLVED - Use BLOCKED status
- **Action required:** Proceed with fixes before considering documentation ready

---

## Recommendations

### Immediate Actions (Common Issues - VERY HIGH Confidence)

- [ ] **Fix examples directory paths:** Update all references from `plugin/examples/`, `plugin/core/examples/`, `${CLAUDE_PLUGIN_ROOT}/core/examples/` to `examples/` in README.md, CONVENTIONS.md, SETUP.md
- [ ] **Fix SETUP.md configuration paths:** Change `${CLAUDE_PLUGIN_ROOT}/core/gates.json` to `${CLAUDE_PLUGIN_ROOT}/gates.json`
- [ ] **Address plugin context directory:** Either create `plugin/context/` with documented files OR update README.md, CONVENTIONS.md, ARCHITECTURE.md to remove references
- [ ] **Fix workflow command syntax:** Change all `workflow start`, `workflow next` etc. to `tsv start`, `tsv next` in README.md; note that `turboshovel` is an alias

### After Cross-check

**VALIDATED (implement):**
- (pending cross-check validation)

**INVALIDATED (skip):**
- (pending cross-check validation)

**UNCERTAIN (user decides):**
- All 12 exclusive issues pending cross-check

### For Consideration (NON-BLOCKING)

- [ ] **HookInput interface sync:** Sync TYPESCRIPT.md with schemas.ts
  - Benefit: Accurate developer documentation
  - Found by: Reviewer #1

- [ ] **Document --pass flag:** Add to CLAUDE.md CLI documentation
  - Benefit: Complete command documentation
  - Found by: Reviewer #1

- [ ] **ARCHITECTURE.md path corrections:** Fix gates.json, hooks.json, CLI paths if cross-check validates
  - Benefit: Accurate architecture documentation
  - Found by: Reviewer #2

- [ ] **INTEGRATION_TESTS.md examples:** Update to use `.claude/gates.json` pattern
  - Benefit: Consistency with best practices
  - Found by: Reviewer #2

- [ ] **De-emphasize planned hooks:** Move to Roadmap section
  - Benefit: Clearer user expectations
  - Found by: Reviewer #2

- [ ] **Document `complete` command:** Explain difference from `stop`
  - Benefit: Complete CLI documentation
  - Found by: Reviewer #2

### Divergences (Resolved)

- [x] **Overall status assessment:** Reviewers disagreed on BLOCKED vs APPROVED WITH SUGGESTIONS
  - Resolution: Use BLOCKED (more conservative approach given 4+ common BLOCKING issues)
  - Action: Address all BLOCKING issues before considering documentation ready

---

## Overall Assessment

**Ready to proceed?** NO

**Reasoning:**
Both reviewers independently identified 4 common BLOCKING issues involving incorrect file paths that will cause direct user-facing failures (copy commands, configuration lookups, CLI commands). The documentation cannot be considered ready until these paths are corrected.

**Critical items requiring attention:**
1. Examples directory paths (affects README.md, CONVENTIONS.md, SETUP.md)
2. SETUP.md configuration paths (gates.json location)
3. Plugin context directory (either create or remove references)
4. Workflow command syntax (`workflow` should be `tsv`)

**Confidence level:**
- **High confidence issues (common):** 4 BLOCKING - all involve verified path mismatches that will cause user failures
- **Moderate confidence issues (exclusive):** 12 issues (4 BLOCKING from Reviewer #2, 1 from Reviewer #1, plus suggestions) - pending cross-check validation
- **Investigation required (divergences):** 1 (resolved - use BLOCKED status)

---

## Next Steps

### Recommended Workflow

1. **Now:** `/revise common` - Address the 4 common BLOCKING issues immediately
   - These have VERY HIGH confidence (both reviewers found independently)
   - All are path corrections - relatively straightforward fixes

2. **Optional:** Run cross-check on exclusive issues
   - Validates the 12 exclusive findings against ground truth
   - Particularly important for ARCHITECTURE.md path issues found only by Reviewer #2

3. **Then:** `/revise exclusive` - Address VALIDATED exclusive issues

4. **Future:** Review NON-BLOCKING suggestions for documentation quality improvements

### Cross-check States

| State | Meaning | Action |
|-------|---------|--------|
| VALIDATED | Cross-check confirmed issue exists | Implement via `/revise exclusive` |
| INVALIDATED | Cross-check found issue doesn't apply | Skip (auto-excluded from `/revise`) |
| UNCERTAIN | Cross-check couldn't determine | User reviews and decides |

---

## Appendix: Issue Comparison Matrix

| Issue | Reviewer #1 | Reviewer #2 | Status |
|-------|-------------|-------------|--------|
| Examples dir path mismatch | B1, S4 | B1 | COMMON |
| SETUP.md core/ paths | B3, B4 | B1 | COMMON |
| Plugin context dir missing | B6 | B2 | COMMON |
| workflow vs tsv commands | S3, S5 | S4 | COMMON |
| Session state file path | B5 | S7 | POSSIBLE COMMON |
| ARCHITECTURE.md gates.json path | - | B3 | EXCLUSIVE #2 |
| ARCHITECTURE.md hooks.json path | - | B4 | EXCLUSIVE #2 |
| ARCHITECTURE.md CLI path | - | B5 | EXCLUSIVE #2 |
| HookInput interface incomplete | S1 | - | EXCLUSIVE #1 |
| --pass flag undocumented | S2 | - | EXCLUSIVE #1 |
| package.json bin confusion | S6 | - | EXCLUSIVE #1 |
| pre/post naming inconsistency | S7 | - | EXCLUSIVE #1 |
| Hook events table verification | S8 | - | EXCLUSIVE #1 |
| INTEGRATION_TESTS.md pattern | - | S1 | EXCLUSIVE #2 |
| Directory structure accuracy | - | S2 | EXCLUSIVE #2 |
| Non-existent slash commands | - | S3 | EXCLUSIVE #2 |
| Planned hooks emphasis | - | S5 | EXCLUSIVE #2 |
| complete command docs | - | S6 | EXCLUSIVE #2 |
| Gates index.ts comment | - | S8 | EXCLUSIVE #2 |
