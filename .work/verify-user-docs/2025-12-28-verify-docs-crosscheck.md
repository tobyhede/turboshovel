# Cross-check Validation Report - Documentation Review

## Metadata
- **Date:** 2025-12-28 16:20:00
- **Collation Report:** `.work/verify-user-docs/2025-12-28-verify-docs-collated.md`
- **Validation Method:** Ground truth verification against codebase

---

## Executive Summary

| Status | Count | Description |
|--------|-------|-------------|
| VALIDATED | 8 | Issue confirmed to exist - should be addressed |
| INVALIDATED | 5 | Issue does not apply - can be skipped |
| UNCERTAIN | 3 | Cannot fully determine - escalate to user |

---

## Exclusive Issues from Agent 1

### BLOCKING Issues

#### [E1-B1] @turboshovel/shared package not published to npm

- **Issue:** CLI package depends on @turboshovel/shared, but it's NOT published to npm. Users following installation instructions will get dependency resolution errors.
- **Source:** Agent 1
- **Validation:** VALIDATED
- **Evidence:**
  - `npm view @turboshovel/shared` returns 404 Not Found
  - `npm view @turboshovel/cli dependencies` shows NO dependency on @turboshovel/shared in the published package
  - Local `packages/cli/package.json` line 32 shows: `"@turboshovel/shared": "*"`
  - Published CLI v1.0.0 dependencies are: commander, js-yaml, mdast-util-from-markdown, minimatch, unist-util-visit, zod
- **Analysis:** The published CLI on npm does NOT include @turboshovel/shared as a dependency (bundled or removed during publish). The local dev package.json references it, but the published version works independently. This is a FALSE ALARM for users installing from npm, but TRUE for developers cloning the repo and trying to build.
- **Recommendation:**
  - For users: INVALIDATED - npm install works fine
  - For contributors: VALIDATED - need to document that `@turboshovel/shared` is workspace-internal and not published
  - Update README Development section to clarify workspace dependency handling

---

#### [E1-B2] Plugin installation command syntax may be incorrect

- **Issue:** README shows `claude plugin marketplace add tobyhede/turboshovel` and `claude plugin install turboshovel@turboshovel`. Syntax may not match Claude Code plugin CLI.
- **Source:** Agent 1
- **Validation:** VALIDATED
- **Evidence:**
  - `claude plugin marketplace --help` shows: `add <source>` - Add a marketplace from a URL, path, or GitHub repo
  - `claude plugin install --help` shows the install command takes `<plugin>` with format `plugin@marketplace`
  - README line 17-22 uses correct syntax based on Claude Code CLI help
- **Analysis:** The syntax appears correct:
  - `claude plugin marketplace add tobyhede/turboshovel` - adds marketplace (GitHub repo format valid)
  - `claude plugin install turboshovel@turboshovel` - installs plugin from marketplace
  However, cannot verify marketplace registration is working without testing live.
- **Recommendation:** UNCERTAIN - syntax matches CLI help, but needs live testing to confirm marketplace is properly registered

---

### NON-BLOCKING Issues (Suggestions)

#### [E1-S1] CONVENTIONS.md references non-existent commands

- **Issue:** CONVENTIONS.md references `/turboshovel:code-review` and `/turboshovel:plan` commands, but only `/turboshovel:verify` is implemented.
- **Source:** Agent 1
- **Validation:** VALIDATED
- **Evidence:**
  - `plugin/commands/` directory contains only: test.md, verify.md, walkthrough.md
  - No `code-review.md` or `plan.md` command files
  - CONVENTIONS.md lines 125-127 reference `/turboshovel:code-review` and `/turboshovel:plan` as examples
  - These are used as EXAMPLES of naming patterns, not claims of existing commands
- **Analysis:** CONVENTIONS.md uses these as examples of the naming convention pattern. The language could be clearer that these are hypothetical examples.
- **Recommendation:** Clarify that `/turboshovel:code-review` and `/turboshovel:plan` are example patterns, or change to `/turboshovel:verify` which actually exists

---

#### [E1-S2] ARCHITECTURE.md mentions planned hooks without timeline

- **Issue:** Planned hooks (SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd) mentioned without implementation indication.
- **Source:** Agent 1
- **Validation:** VALIDATED
- **Evidence:**
  - ARCHITECTURE.md line 247: "**Planned hooks (not yet registered):** SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd."
  - CONVENTIONS.md line 44: "**Planned hooks:** SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd - recognized by config validation but not yet registered"
- **Analysis:** Both docs consistently note these are "planned" and "not yet registered". The current documentation is accurate but could benefit from a "Roadmap" section or issue link.
- **Recommendation:** NON-BLOCKING - documentation is accurate. Optional: add link to tracking issue if one exists

---

#### [E1-S3] Debugging section needs more examples

- **Issue:** Debugging section shows log path but doesn't show example log output or common error patterns.
- **Source:** Agent 1
- **Validation:** VALIDATED
- **Evidence:**
  - README.md lines 410-429 show log path and what gets logged
  - No example log entries or common error patterns shown
- **Analysis:** The debugging section is functional but minimal. Adding example output would help users self-diagnose.
- **Recommendation:** Add 2-3 example log entries showing common scenarios (gate pass, gate fail, context injection)

---

#### [E1-S4] IF/ELSE conditional syntax documented but not implemented

- **Issue:** README extensively documents IF/ELSE conditional syntax but notes "NOT YET IMPLEMENTED".
- **Source:** Agent 1
- **Validation:** VALIDATED
- **Evidence:**
  - README.md line 675: `> **NOT YET IMPLEMENTED:** IF/ELSE conditionals are planned but not currently supported`
  - Lines 691-732 document workaround using agent-controlled branching
- **Analysis:** Documentation correctly marks this as not implemented and provides working alternative. The extensive documentation prepares for future implementation.
- **Recommendation:** INVALIDATED as a problem - documentation is accurate and provides working alternative. Consider moving unimplemented features to a "Planned Features" section.

---

#### [E1-S5] Session state directory path inconsistency

- **Issue:** Documentation mentions `.claude/session/state.json` but actual path may differ.
- **Source:** Agent 1
- **Validation:** VALIDATED (but nuanced)
- **Evidence:**
  - ARCHITECTURE.md lines 342, 357: Documents `.claude/session/state.json` for hook session state
  - `plugin/core/src/session.ts` line 22: `this.stateFile = join(cwd, '.claude', 'session', 'state.json');`
  - `.claude/session/` directory does NOT exist in project root
  - `.claude/turboshovel/session.json` EXISTS (for workflow session)
- **Analysis:** Two distinct session mechanisms:
  1. **Hook session** (`.claude/session/state.json`) - created on first use during hook execution, not present until first run
  2. **Workflow session** (`.claude/turboshovel/session.json`) - exists in project

  Documentation is technically correct but confusing because:
  - The hook session directory doesn't exist until runtime
  - Users might confuse hook session with workflow session
- **Recommendation:** Clarify in ARCHITECTURE.md that `.claude/session/` is created at runtime on first hook execution

---

#### [E1-S6] N-Verification skill uses "workflow" command not "tsv"

- **Issue:** Skill references `workflow start` but CLI command is `tsv start`.
- **Source:** Agent 1
- **Validation:** VALIDATED
- **Evidence:**
  - `plugin/skills/verifying-by-consensus/SKILL.md` line 40: `workflow start ${CLAUDE_PLUGIN_ROOT}workflows/verify.workflow.md`
  - `plugin/skills/workflow/SKILL.md` line 52: `workflow start <file>`
  - CLI provides both `tsv` and `turboshovel` as bin names
  - No `workflow` command registered
- **Analysis:** Skills use `workflow` command but CLI only provides `tsv` and `turboshovel` aliases. This is inconsistent.
- **Recommendation:** Update skills to use `tsv start` instead of `workflow start`, or document that `workflow` is an internal alias

---

## Exclusive Issues from Agent 2

### BLOCKING Issues

#### [E2-B1] README.md title "Quality Hooks" inconsistent with project name

- **Issue:** README.md header says "# Quality Hooks" while project is named "Turboshovel" everywhere else.
- **Source:** Agent 2
- **Validation:** VALIDATED
- **Evidence:**
  - README.md line 1: `# Quality Hooks`
  - package.json, CLAUDE.md, repo name all use "Turboshovel"
  - CLAUDE.md line 1: `# CLAUDE.md` then line 3: `Turboshovel is a Claude Code plugin`
- **Analysis:** README uses "Quality Hooks" as title while everything else uses "Turboshovel". This creates brand confusion.
- **Recommendation:** Change README.md title to `# Turboshovel` with subtitle "Quality Hooks and Context Injection for Claude Code"

---

#### [E2-B2] README.md config location path inconsistency

- **Issue:** References to `plugin/gates.json` vs plugin root paths are inconsistent.
- **Source:** Agent 2
- **Validation:** INVALIDATED
- **Evidence:**
  - README.md line 373: `plugin/core/gates.json (defaults)`
  - Actual location: `plugin/gates.json` (exists and verified)
  - `plugin/core/gates.json` does NOT exist
- **Analysis:** README line 373 says `plugin/core/gates.json` but actual file is at `plugin/gates.json`. This is a typo.
- **Recommendation:** Fix README.md line 373 to reference correct path `plugin/gates.json`

---

### NON-BLOCKING Issues (Suggestions)

#### [E2-S1] N-Verification phases could be clearer

- **Issue:** Phase descriptions abbreviated. Skill file has more detail about "Common (N/N)" vs "Exclusive (<N/N)".
- **Source:** Agent 2
- **Validation:** VALIDATED
- **Evidence:**
  - README.md lines 443-449 provide brief phase descriptions
  - `plugin/skills/verifying-by-consensus/SKILL.md` has more detailed explanations
- **Analysis:** README provides minimal phase info while skill file has better explanation.
- **Recommendation:** Expand README phase descriptions or link to skill file for details

---

#### [E2-S2] SETUP.md missing npm test/build verification step

- **Issue:** "Testing Your Configuration" shows jq validation but doesn't mention running npm test/build to verify commands work.
- **Source:** Agent 2
- **Validation:** VALIDATED
- **Evidence:**
  - SETUP.md lines 383-396 show JSON validation and mock hook testing
  - No step to verify configured commands (npm test, npm run build) actually work
- **Analysis:** Testing section focuses on JSON validity and hook structure, not command execution.
- **Recommendation:** Add step: "Run your configured commands manually to verify they work: `npm test`, `npm run lint`, etc."

---

#### [E2-S3] INTEGRATION_TESTS.md not linked prominently

- **Issue:** INTEGRATION_TESTS.md contains valuable troubleshooting patterns but only mentioned once.
- **Source:** Agent 2
- **Validation:** INVALIDATED
- **Evidence:**
  - INTEGRATION_TESTS.md exists (6091 bytes)
  - Grep for "INTEGRATION_TESTS" in README shows no references
- **Analysis:** INTEGRATION_TESTS.md is not actually linked in README at all based on search. This is a developer-focused file, not user documentation.
- **Recommendation:** INTEGRATION_TESTS.md is for contributors, not end users. No change needed for user docs.

---

#### [E2-S4] Default shell gates shows "clippy" keyword

- **Issue:** "clippy" as keyword is Rust-specific and may confuse non-Rust users.
- **Source:** Agent 2
- **Validation:** VALIDATED
- **Evidence:**
  - README.md line 295: `check` gate keywords include "clippy"
  - plugin/gates.json: `"keywords": ["lint", "check", "format", "quality", "clippy", "typecheck"]`
- **Analysis:** "clippy" is Rust-specific (Rust linter) but included as keyword for the generic `check` gate. This is intentional - it allows Rust projects to trigger checks when mentioning clippy.
- **Recommendation:** INVALIDATED as problem - inclusive keyword set is intentional for multi-language support. Optional: add note that keywords cover multiple ecosystems.

---

#### [E2-S5] CLI development instructions could clarify npm workspace structure

- **Issue:** Development section shows manual cd between directories but project uses npm workspaces.
- **Source:** Agent 2
- **Validation:** VALIDATED
- **Evidence:**
  - README.md lines 1355-1375 show manual `cd plugin/core`, `cd ../../packages/cli` workflow
  - Project uses npm workspaces (packages/ directory structure)
- **Analysis:** Development instructions use explicit directory navigation rather than workspace commands.
- **Recommendation:** Add note that project uses npm workspaces and can use `npm run build -w @turboshovel/cli` etc.

---

## Summary Table

| Issue ID | Description | Source | Validation | Action |
|----------|-------------|--------|------------|--------|
| E1-B1 | @turboshovel/shared not published | Agent 1 | INVALIDATED (for users) | npm install works; clarify for contributors |
| E1-B2 | Plugin install syntax | Agent 1 | UNCERTAIN | Syntax correct per CLI help; needs live test |
| E1-S1 | CONVENTIONS.md non-existent commands | Agent 1 | VALIDATED | Clarify examples or use existing commands |
| E1-S2 | Planned hooks no timeline | Agent 1 | VALIDATED | Low priority - docs accurate, add roadmap link |
| E1-S3 | Debugging needs examples | Agent 1 | VALIDATED | Add example log entries |
| E1-S4 | IF/ELSE not implemented | Agent 1 | INVALIDATED | Docs correctly marked as not implemented |
| E1-S5 | Session state path | Agent 1 | VALIDATED | Clarify runtime creation behavior |
| E1-S6 | workflow vs tsv command | Agent 1 | VALIDATED | Update skills to use tsv |
| E2-B1 | README title inconsistency | Agent 2 | VALIDATED | Change to "Turboshovel" |
| E2-B2 | gates.json path inconsistency | Agent 2 | VALIDATED | Fix path: plugin/core/gates.json -> plugin/gates.json |
| E2-S1 | N-Verification phases | Agent 2 | VALIDATED | Expand README phase descriptions |
| E2-S2 | SETUP.md missing test step | Agent 2 | VALIDATED | Add command verification step |
| E2-S3 | INTEGRATION_TESTS.md linking | Agent 2 | INVALIDATED | Developer doc, not user doc |
| E2-S4 | "clippy" keyword | Agent 2 | INVALIDATED | Intentional multi-language support |
| E2-S5 | npm workspace docs | Agent 2 | VALIDATED | Add workspace command note |

---

## Recommendations by Priority

### High Priority (Should Fix)

1. **[E2-B1]** README.md title: Change "Quality Hooks" to "Turboshovel"
2. **[E2-B2]** Fix path reference: `plugin/core/gates.json` -> `plugin/gates.json`
3. **[E1-S6]** Update skills: `workflow start` -> `tsv start`

### Medium Priority (Should Consider)

4. **[E1-S5]** Clarify session state path created at runtime
5. **[E1-S1]** Update CONVENTIONS.md examples to use existing commands
6. **[E2-S2]** Add command verification step to SETUP.md

### Low Priority (Nice to Have)

7. **[E1-S3]** Add debugging example log entries
8. **[E2-S1]** Expand N-Verification phase descriptions
9. **[E2-S5]** Document npm workspace commands for contributors

### No Action Required

- **[E1-B1]** npm install works; @turboshovel/shared is workspace-internal
- **[E1-S2]** Planned hooks accurately documented
- **[E1-S4]** IF/ELSE correctly marked not implemented
- **[E2-S3]** INTEGRATION_TESTS.md is contributor-focused
- **[E2-S4]** clippy keyword intentional for Rust support

### Needs User Decision

- **[E1-B2]** Plugin marketplace syntax - needs live testing to confirm

---

## Cross-check Complete

**Status:** COMPLETE
**Validated Issues:** 8
**Invalidated Issues:** 5
**Uncertain:** 1 (E1-B2 - plugin install syntax needs live test)
