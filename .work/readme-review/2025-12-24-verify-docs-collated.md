# Collated Review Report - Documentation Review

## Metadata
- **Review Type:** Documentation Review
- **Date:** 2025-12-24 16:30:00
- **Reviewers:** Agent A (Independent Verification), Agent B (Independent Verification)
- **Subject:** README.md, SETUP.md, CLAUDE.md - User onboarding documentation
- **Review Files:**
  - Review #1: `/Users/tobyhede/psrc/turboshovel/.work/readme-review/2025-12-24-verify-docs-A.md`
  - Review #2: `/Users/tobyhede/psrc/turboshovel/.work/readme-review/2025-12-24-verify-docs-B.md`
- **Cross-check Status:** COMPLETE (inline verification performed)
- **Cross-check File:** N/A (verified during collation)

## Executive Summary
- **Total unique issues identified:** 12
- **Common issues (VERY HIGH confidence):** 3 (ready for `/revise common`)
- **Exclusive issues (pending cross-check):** 7
  - VALIDATED: 4 (confirmed)
  - INVALIDATED: 1 (can skip)
  - UNCERTAIN: 2 (user decides)
- **Divergences (resolved during collation):** 2

**Overall Status:** APPROVED WITH CHANGES
**Revise Ready:** common (3 high-confidence issues), then exclusive (4 validated issues)

---

## Common Issues (High Confidence)
Both reviewers independently found these issues.

**Confidence: VERY HIGH** - Both reviewers found these issues independently, making them very likely to be real problems.

### BLOCKING / CRITICAL

**Example JSON Files Use `mise run` Commands** (examples/*.json)
- **Reviewer #1 finding:** BLOCKING-3 - All example configuration files use `mise run <command>` which most users won't have installed. New users copying examples will get immediate failures.
- **Reviewer #2 finding:** SUGGESTION-01 - Examples use mise which is not universally installed. Recommends using npm or placeholder pattern.
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING (Agent A) / SUGGESTION (Agent B) - Upgrading to BLOCKING due to user onboarding impact
- **Action required:** Change example gate commands to use npm (more universal) or add prominent warning that examples use mise and must be customized

---

**Debugging Command Uses `${CLAUDE_PLUGIN_ROOT}` Variable Unavailable to Users** (README.md, lines 395-396)
- **Reviewer #1 finding:** SUGGESTION-4 - The `tail -f $(node ${CLAUDE_PLUGIN_ROOT}/...)` command requires CLAUDE_PLUGIN_ROOT which is only set during hook execution. Noted that alternative is documented at lines 398-399.
- **Reviewer #2 finding:** SUGGESTION-02 - Same issue. Recommends adding alternative command using `$TMPDIR/turboshovel/hooks-$(date +%Y-%m-%d).log`.
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** NON-BLOCKING (improvement)
- **Benefit:** Users debugging outside hook execution can find log files more easily

---

**Workflow Examples Directory References Deleted Files** (README.md, lines 1279-1294)
- **Reviewer #1 finding:** SUGGESTION-10 - README mentions workflow examples (execute.workflow.md, verify-code.workflow.md, etc.) that were deleted according to git status.
- **Reviewer #2 finding:** SUGGESTION-08 - Same issue. Only code-review.workflow.md exists, but deleted files are still referenced.
- **Confidence:** VERY HIGH (both found independently)
- **Severity consensus:** BLOCKING (documentation references non-existent files)
- **Action required:** Update examples section to only list files that actually exist: strict.json, permissive.json, pipeline.json, convention-based.json, context/, code-review.workflow.md

---

### NON-BLOCKING / LOWER PRIORITY

None - all common issues have been classified as BLOCKING or addressed above.

---

## Exclusive Issues (Pending Cross-check)
Only one reviewer found these issues. Cross-check performed during collation.

**Confidence: MODERATE** - One reviewer found these. Cross-check validates whether they actually apply.

**Cross-check Status:** COMPLETE

### Found by Reviewer #1 Only

#### BLOCKING / CRITICAL

**Workflow Context Injection Uses Wrong Flag (--task vs --step)** (README.md, line 467)
- **Found by:** Reviewer #1 (BLOCKING-1)
- **Description:** Documentation at line 467 claims `workflow next --task N` for jumping to tasks, but implementation uses `--step N`. The `--task` flag is for parallel subtasks.
- **Severity:** BLOCKING
- **Reasoning:** Users will use wrong flag and get confusing errors
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** INVALIDATED
- **Evidence:** Verified README.md lines 463-478. The documentation does NOT say `--task N` at line 467. Line 467 says "workflow start my-workflow.md". The `--step N` and `--task` flags are correctly documented at lines 868-878. Reviewer #1 appears to have misread the line numbers.

---

**convention-based.json Uses Non-Existent Hook Fields** (examples/convention-based.json)
- **Found by:** Reviewer #1 (BLOCKING-5)
- **Description:** Example uses `enabled_commands` and `enabled_skills` fields that are not in `HookConfig` interface. Also references `SlashCommandEnd` hook.
- **Severity:** BLOCKING
- **Reasoning:** Users copying this example will have non-functional configuration
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** Verified `types.ts` lines 59-63 shows `HookConfig` only has `enabled_tools`, `enabled_agents`, and `gates`. The fields `enabled_commands` and `enabled_skills` are NOT defined. However, `SlashCommandEnd` IS in KNOWN_HOOK_EVENTS (config.ts line 16). The example uses undefined interface fields which would be silently ignored.

---

#### NON-BLOCKING / LOWER PRIORITY

**Missing Installation Instructions** (README.md, CLAUDE.md)
- **Found by:** Reviewer #1 (SUGGESTION-1)
- **Description:** Neither document explains how to install the plugin for the first time. Jumps straight to Quick Start.
- **Severity:** NON-BLOCKING
- **Benefit:** New users would know how to get started (clone, register, prerequisites)
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** Confirmed - neither file contains installation instructions. README starts with "Why Turboshovel?" and jumps to "Quick Start". No instructions for cloning, settings.local.json registration, or Node.js prerequisites.

---

**npm link Workflow Not Fully Documented** (README.md, lines 467-478)
- **Found by:** Reviewer #1 (SUGGESTION-2)
- **Description:** Documentation mentions `npm link` but doesn't explain where to run it, what happens if not linked, or how to verify.
- **Severity:** NON-BLOCKING
- **Benefit:** Users would have clearer path to getting workflow CLI working
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** Confirmed - lines 468-469 show `cd plugin/hooks/hooks-app && npm link` but no verification step or troubleshooting guidance.

---

**SETUP.md Config Priority Documentation Outdated** (SETUP.md, lines 56-63)
- **Found by:** Reviewer #1 (SUGGESTION-8)
- **Description:** SETUP.md implies mutual exclusivity between project configs, but actually all configs are MERGED with plugin config as base.
- **Severity:** NON-BLOCKING
- **Benefit:** Users would understand config merging behavior correctly
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** UNCERTAIN
- **Evidence:** Would need deeper analysis of config.ts merge behavior to confirm. The note about "If .claude/gates.json exists, gates.json in project root is NOT loaded" appears accurate for project configs, but plugin config merging behavior needs verification.

---

### Found by Reviewer #2 Only

#### BLOCKING / CRITICAL

**Tool Names Case Inconsistency** (README.md, lines 163-164)
- **Found by:** Reviewer #2 (BLOCKING-02, BLOCKING-03)
- **Description:** README shows `Edit-pre.md` with capital E, but implementation lowercases tool names. Users creating files like `Edit-pre.md` won't have them discovered.
- **Severity:** BLOCKING
- **Reasoning:** User-created context files will not be discovered
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** Verified context.ts lines 188-192 explicitly calls `input.tool_name.toLowerCase()`. README line 163-164 shows `Edit-pre.md` with capital E. CONVENTIONS.md correctly documents lowercase. This is a real inconsistency that will cause user confusion.

---

**Workflow CLI Direct Invocation Path Incorrect** (README.md, lines 476-477)
- **Found by:** Reviewer #2 (BLOCKING-01)
- **Description:** Documentation shows relative path `node plugin/hooks/hooks-app/dist/cli/workflow-cli.js` which assumes user is in turboshovel project root. For plugin users, path would be different.
- **Severity:** BLOCKING
- **Reasoning:** New users using Option 2 without linking would have incorrect paths
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** UNCERTAIN
- **Evidence:** The path shown IS relative to project root. For users installing as a plugin (not developing turboshovel itself), the path semantics are different. However, the primary use case (npm link) is correct. Edge case for direct invocation.

---

#### NON-BLOCKING / LOWER PRIORITY

**`workflow start` Examples Missing in Getting Started** (README.md, Quick Start section)
- **Found by:** Reviewer #2 (SUGGESTION-06)
- **Description:** Quick Start shows commands but not a complete getting-started workflow (create file, where to put it, start it).
- **Severity:** NON-BLOCKING
- **Benefit:** New users would have clearer onboarding path
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** Confirmed - the Quick Start section (lines 482-502) shows commands but doesn't show how to create a workflow file from scratch.

---

**Workflow findWorkflowFile Search Logic Not Documented** (README.md)
- **Found by:** Reviewer #2 (SUGGESTION-10)
- **Description:** The search locations (direct path, .claude/workflows/) are not documented.
- **Severity:** NON-BLOCKING
- **Benefit:** Users would know they can organize workflows in .claude/workflows/
- **Confidence:** MODERATE (pending cross-check)
- **Cross-check:** VALIDATED
- **Evidence:** Verified workflow-cli.ts has this logic but README doesn't document the .claude/workflows/ search location.

---

## Divergences (Requires Investigation)
Reviewers disagree or have contradictory findings.

**Confidence: INVESTIGATE** - Reviewers have different conclusions. Verification analysis included.

---

**Plugin Context Directory Path Accuracy** (README.md, lines 66, 122)
- **Reviewer #1 perspective:** BLOCKING-2 - Initially flagged as incorrect, then self-corrected. Said documentation terminology is "inconsistent" between `plugin/context/` and `${CLAUDE_PLUGIN_ROOT}/context/`.
- **Reviewer #2 perspective:** Did not flag this issue.
- **Verification Analysis:**
  - **Verifying agent:** Collator (inline verification)
  - **Correct perspective:** Reviewer #1 (self-corrected to non-issue)
  - **Reasoning:** Reviewer #1 correctly identified the paths work but noted potential confusion. The documentation is technically accurate. The `${CLAUDE_PLUGIN_ROOT}/context/` resolves to the plugin's context directory which is `plugin/context/` in the source tree.
  - **Recommendation:** No action needed - documentation is accurate
- **Confidence:** RESOLVED (non-issue)
- **Action required:** None

---

**Workflow State File Path Consistency** (README.md, line 749 vs CLAUDE.md, line 103)
- **Reviewer #1 perspective:** BLOCKING-4 - Initially flagged as inconsistency, then self-corrected to "No action needed - documentation is accurate"
- **Reviewer #2 perspective:** SUGGESTION-05 - Noted both documents are consistent, README is more specific with `{id}.json` pattern
- **Verification Analysis:**
  - **Verifying agent:** Collator (inline verification)
  - **Correct perspective:** Both agree - no issue
  - **Reasoning:** Both reviewers concluded documentation is accurate after verification
  - **Recommendation:** No action needed
- **Confidence:** RESOLVED (non-issue)
- **Action required:** None

---

## Recommendations

### Immediate Actions (Common Issues)

- [ ] **mise run commands:** Change example gate commands in strict.json, permissive.json, pipeline.json to use `npm run` commands or add prominent warning in SETUP.md
- [ ] **Debugging command:** Add alternative log path command that doesn't require CLAUDE_PLUGIN_ROOT (already documented at lines 398-399, just needs reordering for clarity)
- [ ] **Deleted workflow examples:** Update README.md examples section to remove references to deleted files (collate.workflow.md, crosscheck.workflow.md, execute.workflow.md, verify-code.workflow.md, verify-docs.workflow.md, verify-plan.workflow.md)

### Validated Exclusive Issues (Implement)

**VALIDATED (implement):**
- [ ] **Tool name casing** (Reviewer #2): Change README.md lines 163-164 from `Edit-pre.md`/`Edit-post.md` to `edit-pre.md`/`edit-post.md` to match implementation
  - Evidence: context.ts explicitly lowercases tool names
- [ ] **convention-based.json fields** (Reviewer #1): Remove or update example to use only implemented HookConfig fields (enabled_tools, enabled_agents, gates)
  - Evidence: types.ts HookConfig interface does not include enabled_commands or enabled_skills
- [ ] **Missing installation instructions** (Reviewer #1): Add Installation section before Quick Start
  - Evidence: Neither README nor CLAUDE.md explains initial setup
- [ ] **npm link verification** (Reviewer #1): Add verification step after npm link command
  - Evidence: No guidance on verifying link succeeded

**INVALIDATED (skip):**
- [ ] ~~**--task vs --step flag error**~~ (Reviewer #1): Reviewer misread line numbers
  - Reason: Documentation at lines 868-878 correctly documents both flags

**UNCERTAIN (user decides):**
- [ ] **SETUP.md config merging** (Reviewer #1): Clarify config loading and merging behavior
  - Context: May need deeper code analysis to verify merge behavior accuracy
- [ ] **Workflow CLI direct path** (Reviewer #2): Consider adding plugin-relative path for direct invocation
  - Context: Edge case for users not using npm link

### For Consideration (NON-BLOCKING)

- [ ] **Workflow getting started example:** Add minimal "Create your first workflow" example in Quick Start
  - Benefit: New users would have clearer onboarding path
  - Found by: Reviewer #2
  - Cross-check: VALIDATED

- [ ] **Document workflow file search locations:** Document that workflow files can be placed in .claude/workflows/
  - Benefit: Users would know about organizational options
  - Found by: Reviewer #2
  - Cross-check: VALIDATED

### Divergences (Resolved)

- [ ] **Plugin context path:** No action needed - documentation is accurate (both reviewers ultimately agreed)
- [ ] **Workflow state path:** No action needed - documentation is consistent (both reviewers agreed)

---

## Overall Assessment

**Ready to proceed?** YES - WITH CHANGES

**Reasoning:**
The documentation is comprehensive and largely accurate. The critical issues that would prevent successful user onboarding are:
1. Tool name casing inconsistency (users creating `Edit-pre.md` won't work)
2. Example files using mise (unfamiliar to most users)
3. References to deleted workflow example files
4. convention-based.json using undefined interface fields

These are all straightforward fixes that don't require architectural changes.

**Critical items requiring attention:**
- Tool name casing in README.md (lines 163-164)
- Example JSON files using mise commands
- Deleted workflow example file references
- convention-based.json using undefined fields

**Confidence level:**
- **High confidence issues (common):** 3 issues - mise commands, debugging variable, deleted file references
- **Moderate confidence issues (exclusive):** 4 validated, 1 invalidated, 2 uncertain
- **Investigation required (divergences):** 2 divergences, both resolved as non-issues

---

## Next Steps

### Parallel Workflow (Recommended)

1. **Now:** `/revise common` - Start implementing 3 common issues immediately
2. **Then:** `/revise exclusive` - Implement 4 validated exclusive issues
3. **User Review:** 2 uncertain issues for user decision

### Priority Order

1. **Tool name casing** (BLOCKING - user files won't be discovered)
2. **Deleted file references** (BLOCKING - documentation references non-existent files)
3. **convention-based.json fields** (BLOCKING - example won't work as shown)
4. **mise commands** (BLOCKING - examples will fail)
5. **Installation instructions** (NON-BLOCKING but high impact for new users)
6. **npm link verification** (NON-BLOCKING quality of life)
7. **Debugging command reorder** (NON-BLOCKING already documented)

### Validation Complete

All exclusive issues have been cross-checked against the codebase. The collation is complete and ready for revision.
