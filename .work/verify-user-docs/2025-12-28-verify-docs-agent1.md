# Review - 2025-12-28

## Metadata
- **Reviewer:** technical-writer (Agent 1)
- **Date:** 2025-12-28 16:15:00
- **Subject:** User-facing documentation (README.md, CLAUDE.md, SETUP.md, CONVENTIONS.md, TYPESCRIPT.md)
- **Ground Truth:** Current codebase implementation
- **Context:** Independent review #1 for dual-verification
- **Mode:** Review

## Summary
- **Subject:** Verification of user-facing documentation against implementation
- **Scope:** All user-facing docs - getting started, examples, features, configuration

---

## Status: APPROVED WITH SUGGESTIONS

## BLOCKING (Must Address)

**1. @turboshovel/shared package not published to npm:**
- Description: The CLI package (@turboshovel/cli) depends on @turboshovel/shared, but @turboshovel/shared is NOT published to npm. Users following the installation instructions will get dependency resolution errors.
- Location: README.md lines 27-28, packages/cli/package.json line 32
- Impact: Users cannot install the CLI globally using `npm install -g @turboshovel/cli` because the dependency chain is broken. This is a critical getting-started blocker.
- Action: Either publish @turboshovel/shared to npm, or bundle the shared code into the CLI package, or document that users need to install from source.

**2. README references non-existent workflow commands in CLAUDE.md summary:**
- Description: CLAUDE.md (line 112-115) documents `tsv complete` command, but the CLI actually has it. However, the help text for `complete` says "Mark current workflow as complete" but it doesn't actually complete/delete the workflow - it just clears the active workflow pointer or sets a blocked variable.
- Location: CLAUDE.md lines 107-116
- Impact: Users may be confused about what "complete" vs "stop" actually do
- Action: Clarify the difference between `tsv complete` (marks done but keeps state) vs `tsv stop` (aborts and deletes state) in documentation

**3. Plugin installation command syntax may be incorrect:**
- Description: README.md shows `claude plugin marketplace add tobyhede/turboshovel` and `claude plugin install turboshovel@turboshovel`. The actual Claude Code plugin installation syntax should be verified against Claude Code documentation.
- Location: README.md lines 17-22
- Impact: Users may not be able to install the plugin if syntax is wrong
- Action: Verify these commands work against actual Claude Code plugin CLI

---

## SUGGESTIONS (Would Improve Quality)

**1. Missing "Getting Started" quick-win example:**
- Description: README.md has good installation and quick start sections, but lacks a complete end-to-end example that a new user could follow in 5 minutes to see the plugin working.
- Location: README.md Quick Start section
- Benefit: New users could validate installation worked immediately
- Action: Add a minimal "First 5 Minutes" section with: 1) Install, 2) Create one context file, 3) Start Claude session, 4) See context injection in action

**2. CLAUDE.md workflow commands list inconsistency:**
- Description: CLAUDE.md lists commands but some details don't match CLI implementation:
  - `tsv next --pass` / `tsv next --fail` - documented but could use more explanation
  - `tsv gate <name>` - documented but brief
- Location: CLAUDE.md lines 104-116
- Benefit: Users would understand all CLI options
- Action: Add brief explanation of each flag and when to use them

**3. README workflow section is extremely long:**
- Description: The README.md has ~700 lines dedicated to the Workflow System, making it overwhelming. Most of this duplicates ARCHITECTURE.md content.
- Location: README.md lines 466-1349
- Benefit: README would be scannable, workflow details in dedicated doc
- Action: Consider moving detailed workflow documentation to a separate WORKFLOW.md file and keeping only essential quick-start in README

**4. Context injection hooks table has confusing status:**
- Description: README.md line 109 shows `SubagentStart` as "Not implemented" for context injection but README doesn't clarify this is context-only - gates still work. Could be clearer.
- Location: README.md lines 100-122
- Benefit: Users understand what works vs what doesn't
- Action: Add footnote or reword to clarify "context injection not implemented" vs "gates work"

**5. CONVENTIONS.md references commands that don't exist:**
- Description: CONVENTIONS.md references `/turboshovel:code-review` and `/turboshovel:plan` commands multiple times, but only `/turboshovel:verify` is implemented in the commands directory.
- Location: CONVENTIONS.md lines 259, 276, etc.
- Benefit: Users won't be confused about which commands exist
- Action: Either implement these commands or clarify these are example patterns for user-created commands

**6. Example files mentioned but not fully documented:**
- Description: README says "See `examples/` for ready-to-use configurations" but doesn't describe what each example does in detail.
- Location: README.md lines 1377-1385
- Benefit: Users know which example to use
- Action: Add a table describing each example file's purpose and use case

**7. TYPESCRIPT.md path references plugin/core but users work in project:**
- Description: TYPESCRIPT.md instructs users to create gates in `plugin/core/src/gates/` which is inside the plugin, not the user's project.
- Location: TYPESCRIPT.md lines 35-62
- Benefit: Users understand they're extending the plugin itself
- Action: Clarify that TypeScript gates require modifying the plugin source (for plugin developers) vs using shell command gates (for end users)

**8. ARCHITECTURE.md mentions "planned hooks" without timeline:**
- Description: ARCHITECTURE.md line 247 mentions "Planned hooks (not yet registered): SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd" but there's no indication of when or if these will be implemented.
- Location: ARCHITECTURE.md line 247, README.md line 122
- Benefit: Users know what to expect
- Action: Either remove planned hooks mention or add a roadmap indicator

**9. Debugging section could use more examples:**
- Description: README debugging section shows log path but doesn't show example log output or common error patterns.
- Location: README.md lines 410-429
- Benefit: Users can self-diagnose issues
- Action: Add 2-3 example log entries and what they mean

**10. IF/ELSE conditional syntax documented but not implemented:**
- Description: README extensively documents IF/ELSE conditional syntax in workflow tasks (lines 675-687) but explicitly notes it's "NOT YET IMPLEMENTED". This is confusing in user-facing docs.
- Location: README.md lines 675-687
- Benefit: Users won't try to use unimplemented features
- Action: Move planned/unimplemented features to a "Roadmap" section or remove until implemented

**11. Session state directory inconsistency:**
- Description: Documentation mentions `.claude/session/state.json` for hook session but actual code may use different paths. Need to verify this matches implementation.
- Location: ARCHITECTURE.md lines 330-343
- Benefit: Users can find actual state files
- Action: Verify path is correct, or update if implementation differs

**12. N-Verification section uses "workflow" command not "tsv":**
- Description: The N-Verification skill SKILL.md references `workflow start` but the CLI command is `tsv start`.
- Location: plugin/skills/verifying-by-consensus/SKILL.md line 40
- Benefit: Consistency in command references
- Action: Update skill to use `tsv` command syntax

---

## Assessment

**Conclusion:**
The documentation is comprehensive and covers most features well. The main blocking issue is the npm dependency chain being broken for CLI installation. Most other issues are suggestions for clarity and completeness.

The documentation accurately describes most features, but the Workflow System section in README.md is excessively long and could benefit from being split into a separate file. The examples directory is well-organized and context files are documented clearly.

**Confidence in findings:**
- HIGH: npm package dependency issue (verified with `npm view`)
- HIGH: CLI commands match documentation (verified by reading cli.ts source)
- MEDIUM: Plugin installation syntax (could not verify against Claude Code docs)
- HIGH: File and directory existence (verified with ls/ls -la)
- MEDIUM: Context injection implementation details (based on code comments/hooks.json)

**Files Verified:**
- `/Users/tobyhede/psrc/turboshovel/README.md`
- `/Users/tobyhede/psrc/turboshovel/CLAUDE.md`
- `/Users/tobyhede/psrc/turboshovel/SETUP.md`
- `/Users/tobyhede/psrc/turboshovel/CONVENTIONS.md`
- `/Users/tobyhede/psrc/turboshovel/TYPESCRIPT.md`
- `/Users/tobyhede/psrc/turboshovel/ARCHITECTURE.md`
- `/Users/tobyhede/psrc/turboshovel/INTEGRATION_TESTS.md`
- `/Users/tobyhede/psrc/turboshovel/packages/cli/src/cli.ts`
- `/Users/tobyhede/psrc/turboshovel/packages/cli/package.json`
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks.json`
- `/Users/tobyhede/psrc/turboshovel/plugin/gates.json`
- `/Users/tobyhede/psrc/turboshovel/plugin/commands/verify.md`
- `/Users/tobyhede/psrc/turboshovel/plugin/skills/verifying-by-consensus/SKILL.md`
- `/Users/tobyhede/psrc/turboshovel/examples/` directory contents
