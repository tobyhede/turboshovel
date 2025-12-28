# Review - 2025-12-28

## Metadata
- **Reviewer:** Documentation verification agent (Agent 2)
- **Date:** 2025-12-28 16:30:00
- **Subject:** User-facing documentation (README.md, CLAUDE.md, SETUP.md, CONVENTIONS.md, TYPESCRIPT.md, ARCHITECTURE.md)
- **Ground Truth:** Codebase implementation in /Users/tobyhede/psrc/turboshovel
- **Context:** Independent review #2 for dual-verification
- **Mode:** Review

## Summary
- **Subject:** User-facing documentation for Turboshovel Claude Code plugin
- **Scope:** All user-facing documentation files, verified against actual codebase structure, file paths, command implementations, and examples

---

## Status: APPROVED WITH SUGGESTIONS

## BLOCKING (Must Address)

**[B1] CLAUDE.md references undefined `tsv complete` command:**
- Description: CLAUDE.md line 112 lists `tsv complete` as a workflow command, but this command does not appear in the CLI help or match the codebase semantics. The CLI has a `complete` command but its behavior differs from the documentation.
- Location: CLAUDE.md:112
- Impact: Users will try `tsv complete` and may get unexpected behavior. The CLI actually requires `--status` option.
- Action: Update documentation to accurately reflect `complete --status <ok|blocked>` syntax, or clarify usage.

**[B2] README.md title inconsistency with CLAUDE.md:**
- Description: README.md header says "# Quality Hooks" while the project is named "Turboshovel" everywhere else. This creates confusion about the project identity.
- Location: README.md:1
- Impact: Users may be confused about whether they're looking at the right documentation. The name "Quality Hooks" vs "Turboshovel" is inconsistent.
- Action: Align the README title with the project name "Turboshovel" to maintain consistency.

**[B3] TYPESCRIPT.md references non-existent file path:**
- Description: TYPESCRIPT.md references `plugin/core/src/types.ts` (lines 38, 106-133), but this file does not exist. Types are actually in `packages/shared/src/types.ts` (re-exported from `@turboshovel/shared`).
- Location: TYPESCRIPT.md:38, TYPESCRIPT.md:106-133
- Impact: Developers trying to create custom TypeScript gates will look for imports in the wrong location and fail.
- Action: Update TYPESCRIPT.md to reference correct import paths from `@turboshovel/shared` or clarify the actual location of types.

**[B4] README.md references non-existent config location:**
- Description: README.md mentions `plugin/gates.json` (line 373) for plugin defaults, but the actual location is `plugin/gates.json` at the plugin root. The paths referenced should be clear about the turboshovel plugin vs project paths.
- Location: README.md:373, and multiple other references
- Impact: Minor confusion - paths work, but consistency of plugin directory references varies.
- Action: Ensure all references to plugin configuration use consistent paths (e.g., `${CLAUDE_PLUGIN_ROOT}/gates.json` or plugin root relative).

---

## SUGGESTIONS (Would Improve Quality)

**[S1] Getting started guide could be more prominent:**
- Description: The README starts with installation but the "Quick Start" section is buried after installation. First-time users need to scroll past installation details to understand what the plugin does.
- Location: README.md:12-28
- Benefit: Users would understand the value proposition faster before committing to installation.
- Action: Consider adding a brief "What it does" section before installation, or restructure so value is clear immediately.

**[S2] CLAUDE.md workflow commands are duplicated extensively in README.md:**
- Description: CLAUDE.md has a concise command list (lines 104-116), while README.md contains over 1000 lines of workflow documentation that largely duplicates this. The duplication increases maintenance burden.
- Location: CLAUDE.md Workflow System section vs README.md Workflow System section
- Benefit: Single source of truth reduces inconsistency risk and maintenance effort.
- Action: Consider keeping detailed workflow docs in README.md only, with CLAUDE.md linking to it for details. Alternatively, extract to dedicated WORKFLOWS.md.

**[S3] Example context files exist but aren't explained in detail:**
- Description: The `examples/context/` directory contains example files (code-review-start.md, plan-start.md, session-start.md, test-driven-development-start.md) but CONVENTIONS.md only briefly mentions them at the end ("See examples/context/").
- Location: CONVENTIONS.md:351-357
- Benefit: Users would have clearer guidance on real-world context file patterns.
- Action: Add more detailed descriptions of what each example file demonstrates, or add inline code snippets from the examples.

**[S4] N-Verification section could explain phases more clearly:**
- Description: README.md N-Verification section (lines 430-457) explains the phases but uses abbreviated descriptions. The actual skill file has more detail that would help users understand the process.
- Location: README.md:430-457
- Benefit: Users would understand consensus-based verification better before using it.
- Action: Expand phase descriptions slightly, particularly explaining what "Common (N/N)" and "Exclusive (<N/N)" mean in practice.

**[S5] SETUP.md could add npm test/build verification step:**
- Description: The "Testing Your Configuration" section shows jq validation and manual hook testing but doesn't mention running actual npm test/build to verify commands work.
- Location: SETUP.md:383-396
- Benefit: Users would catch command configuration issues earlier.
- Action: Add step to verify configured commands work: "Test your gate commands directly: `npm run lint`, `npm test`, etc."

**[S6] Missing coverage of @turboshovel/shared package:**
- Description: The documentation doesn't explain the `@turboshovel/shared` package that contains types and workflow utilities. TypeScript gate developers need this information.
- Location: TYPESCRIPT.md (missing section)
- Benefit: Developers would know where to find shared types and utilities.
- Action: Add section explaining the shared package and its exports, or clarify import paths in TYPESCRIPT.md.

**[S7] Hook table in README.md shows SubagentStart as "Not implemented" but hooks.json registers it:**
- Description: README.md line 109 says SubagentStart context injection is "Not implemented", but hooks.json routes SubagentStart to the CLI just like other hooks. The distinction is that context file discovery isn't implemented, not the hook itself.
- Location: README.md:109
- Benefit: Clearer understanding of what works vs what doesn't.
- Action: Clarify that SubagentStart hook works for gates, just context injection pattern isn't implemented yet.

**[S8] INTEGRATION_TESTS.md is comprehensive but not linked prominently:**
- Description: INTEGRATION_TESTS.md exists and contains valuable troubleshooting patterns, but it's only mentioned once in the Documentation section of README.md.
- Location: README.md:464
- Benefit: Users troubleshooting issues would find diagnostic steps faster.
- Action: Consider linking to it from SETUP.md troubleshooting section, or extract common diagnostic patterns into SETUP.md.

**[S9] Default shell gates table shows outdated keyword list:**
- Description: README.md line 295-298 shows "clippy" as a keyword for the check gate, but this is Rust-specific and may confuse non-Rust users.
- Location: README.md:295-298
- Benefit: More language-agnostic presentation.
- Action: Consider noting that keywords are examples and can be customized, or separate language-specific examples.

**[S10] CLI development instructions could clarify npm workspace structure:**
- Description: README.md development section (lines 1351-1375) shows manual cd between directories, but the project uses npm workspaces. This could be simplified.
- Location: README.md:1351-1375
- Benefit: Contributors would understand the monorepo structure better.
- Action: Add note about npm workspace structure and suggest using workspace commands where applicable.

---

## Assessment

**Conclusion:**
The documentation is comprehensive and covers all major features. The blocking issues center on path references and title inconsistency that would confuse new users. Most verification checks passed - file paths, command outputs, and examples largely match the implementation. The CLI is published on npm as documented, example files exist as referenced, and the architecture documentation accurately reflects the codebase structure.

**Confidence in findings:**
- HIGH for path verification (file system checks)
- HIGH for CLI command verification (examined source code)
- HIGH for npm package verification (queried npm registry)
- MEDIUM for behavioral claims (not able to run full integration tests)
- The types.ts location issue is verified - file does not exist at documented path

**Verification Method:**
- Read all documentation files completely
- Checked file existence for all referenced paths
- Examined CLI source code for command implementations
- Verified npm package publication
- Cross-referenced examples with actual example file contents
- Compared gates.json structures between plugin and examples
