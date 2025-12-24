# Documentation Verification Review - Agent A

**Date:** 2025-12-24
**Reviewer:** Agent A (Independent Verification)
**Scope:** README.md, SETUP.md, CLAUDE.md - User onboarding and getting started documentation
**Branch:** feat/workflow-system

---

## Executive Summary

Overall, the documentation is comprehensive and largely accurate. However, there are several issues that could confuse new users or prevent successful onboarding. The most significant issues involve workflow CLI documentation inaccuracies and some context file path discrepancies.

---

## BLOCKING ISSUES

Issues that would prevent new users from successfully using the plugin.

### BLOCKING-1: Workflow Context Injection Guidance Uses Wrong Flag

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (line 467, 869, 875-879)

**Description:** The workflow context documentation at line 467 states:
```
- Jump to task: `workflow next --task N`
```

But the actual CLI implementation in `workflow-cli.ts` uses `--step N` to jump to workflow steps (GOTO functionality). The `--task` flag serves a different purpose - it specifies which parallel subtask when multiple tasks run concurrently.

**Verified against:** `src/cli/workflow-cli.ts` lines 134, 197-200

**Impact:** New users will use the wrong flag and get confusing errors or unexpected behavior. This appears in multiple places:
- Line 467 in workflow context section
- Line 869-879 in CLI Commands section correctly explains both flags, but line 467 is wrong

**Action:** Change line 467 from `workflow next --task N` to `workflow next --step N`

---

### BLOCKING-2: Plugin Context Directory Path Incorrect in README

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (lines 66, 122)

**Description:** README states plugin context is at `${CLAUDE_PLUGIN_ROOT}/context/`:
```
plugin/context/                          plugin/context/
(zero config!)                          - fallback defaults
```

But actual implementation shows plugin context at `${CLAUDE_PLUGIN_ROOT}/context/` (which resolves to `/plugin/context/` relative to plugin root). The physical location is:
```
/Users/tobyhede/psrc/turboshovel/plugin/context/
```

This is actually correct. However, the documentation mentions both `plugin/context/` and `${CLAUDE_PLUGIN_ROOT}/context/` which could confuse users about where their plugin's context files should go.

**Verified against:** `src/context.ts` lines 72-79 and actual directory listing showing `/plugin/context/` exists with files.

**Impact:** Medium - actual paths work, but documentation terminology is inconsistent.

**Action:** Clarify that `${CLAUDE_PLUGIN_ROOT}/context/` resolves to the plugin's `context/` directory at the plugin root level (e.g., `/plugin/context/` in turboshovel's case).

---

### BLOCKING-3: Example Configuration Files Use `mise run` Commands

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/strict.json` (and other example files)

**Description:** All example configuration files use `mise run <command>` as their gate commands:
```json
{
  "gates": {
    "check": {
      "command": "mise run check",
      ...
    }
  }
}
```

Most users will not have `mise` installed. The documentation mentions npm, cargo, etc. as alternatives but a new user copying the example files will get immediate failures.

**Verified against:** `examples/strict.json`, `examples/permissive.json`, `examples/pipeline.json`

**Impact:** New users copying example files will get command failures.

**Action:** Either:
1. Change examples to use npm commands (more universal), or
2. Add prominent warning in SETUP.md that examples use `mise` and must be customized

---

### BLOCKING-4: Workflow State File Path Inconsistency

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (lines 748-749)

**Description:** README states:
```
Workflow state persists to `.claude/turboshovel/workflows/{id}.json`
```

This is correct. However, CLAUDE.md (lines 103) states:
```
State persists in `.claude/turboshovel/workflows/` (workflow files) and `.claude/turboshovel/session.json`
```

This is also correct. No issue here - both are consistent.

**Verified against:** `src/workflow/state.ts` lines 7-8:
```typescript
const STATE_DIR = '.claude/turboshovel/workflows';
const SESSION_FILE = '.claude/turboshovel/session.json';
```

**Status:** No action needed - documentation is accurate.

---

### BLOCKING-5: Convention-based.json References Non-Existent Hook Fields

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/convention-based.json`

**Description:** The example uses `enabled_commands` and `enabled_skills` fields:
```json
{
  "hooks": {
    "SlashCommandEnd": {
      "enabled_commands": ["/code-review"],
      "gates": ["test"]
    },
    "SkillStart": {
      "enabled_skills": ["test-driven-development"]
    }
  }
}
```

However:
1. `SlashCommandEnd` is not registered in `hooks.json` (only planned)
2. `enabled_commands` and `enabled_skills` are not defined in the `HookConfig` interface (only `enabled_tools` and `enabled_agents`)

**Verified against:**
- `src/types.ts` lines 59-63 (HookConfig interface)
- `plugin/hooks/hooks.json` (no SlashCommandEnd hook)
- `src/config.ts` lines 8-24 (KNOWN_HOOK_EVENTS includes SlashCommand* and Skill*)

**Impact:** Users copying this example will have a non-functional configuration.

**Action:** Either remove this example or update to use only currently implemented hooks and fields.

---

## SUGGESTIONS

Improvements that would help users but are not strictly required.

### SUGGESTION-1: Missing Installation Instructions

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md`, `/Users/tobyhede/psrc/turboshovel/CLAUDE.md`

**Description:** Neither README.md nor CLAUDE.md explains how to install the plugin for the first time. The documentation jumps straight to "Quick Start" assuming the plugin is already installed.

**Impact:** New users won't know how to get started.

**Action:** Add "Installation" section before "Quick Start" explaining:
1. How to install the plugin (clone/download)
2. How to register with Claude Code (settings.local.json)
3. Prerequisites (Node.js, npm)

---

### SUGGESTION-2: npm link Workflow Not Fully Documented

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (lines 467-478)

**Description:** The workflow CLI setup documentation mentions `npm link` but doesn't explain:
- Where to run it (must be in `plugin/hooks/hooks-app/`)
- What happens if not linked (need to use full path)
- How to verify it worked

**Impact:** Users may struggle to get the `workflow` command working.

**Action:** Add verification step:
```bash
# Verify link worked
which workflow
# Should output something like ~/.npm-global/bin/workflow

# If not found, ensure npm global bin is in PATH
npm config get prefix
# Add <prefix>/bin to PATH
```

---

### SUGGESTION-3: Hook Table Missing SubagentStart Context Status

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (line 87)

**Description:** The hook table shows:
```
| `SubagentStart` | `{agent}-start.md` | ✗ Not implemented | Gates only |
```

But looking at `src/context.ts`, `extractNameAndStage()` does NOT handle `SubagentStart` - it returns `null`. The CONVENTIONS.md correctly states "context injection not implemented" for SubagentStart.

**Verified against:** `src/context.ts` line 196-197 shows SubagentStop is handled specially but SubagentStart is not in the switch statement.

**Impact:** Minor - table is already marked as not implemented.

**Action:** Consider clarifying the table heading. Currently says "Context Injection" with X mark - this is correct.

---

### SUGGESTION-4: Debugging Section Log Path Example Has Syntax Issue

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (lines 395-396)

**Description:** The debugging section shows:
```bash
tail -f $(node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js log-path)
```

This requires `CLAUDE_PLUGIN_ROOT` to be set, but a developer testing locally may not have it set. The command will fail silently or with unclear errors.

**Impact:** Minor - developers may struggle to find logs.

**Action:** Add alternative:
```bash
# Alternative without CLAUDE_PLUGIN_ROOT:
tail -f $TMPDIR/turboshovel/hooks-$(date +%Y-%m-%d).log

# Or find the log file:
ls $TMPDIR/turboshovel/hooks-*.log
```

(This is actually already documented at line 398-399, so just reorder for clarity)

---

### SUGGESTION-5: Workflow System Documentation Could Be Separate File

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (lines 416-1295)

**Description:** The Workflow System section is 880 lines - nearly 68% of the README. This makes the README overwhelming for new users who just want context injection or gates.

**Impact:** Users may be overwhelmed by documentation length.

**Action:** Consider extracting Workflow System to `WORKFLOWS.md` with just a brief summary and link in README.

---

### SUGGESTION-6: TypeScript Gates Path Clarification

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (lines 252-253), `/Users/tobyhede/psrc/turboshovel/plugin/hooks/TYPESCRIPT.md`

**Description:** README says:
```
Gates without `command` field are TypeScript modules in `src/gates/`:
```

This is correct but could confuse users about the full path. The actual path is `plugin/hooks/hooks-app/src/gates/`.

**Verified against:** Actual directory listing shows `plugin/hooks/hooks-app/src/gates/` with `plugin-path.ts` and `index.ts`.

**Impact:** Minor - users creating TypeScript gates might look in wrong location.

**Action:** Use full relative path: `plugin/hooks/hooks-app/src/gates/`

---

### SUGGESTION-7: Environment Variables Missing CLAUDE_PLUGIN_ROOT

**Location:** `/Users/tobyhede/psrc/turboshovel/CLAUDE.md` (lines 60-63)

**Description:** Environment Variables section documents:
- `TURBOSHOVEL_LOG=0`
- `TURBOSHOVEL_LOG_LEVEL=debug|info|warn|error`

But doesn't mention `CLAUDE_PLUGIN_ROOT` which is critical for plugin operation.

**Impact:** Users troubleshooting may not realize CLAUDE_PLUGIN_ROOT is essential.

**Action:** Add:
```
- `CLAUDE_PLUGIN_ROOT` - Set automatically by Claude Code; path to plugin root
```

---

### SUGGESTION-8: SETUP.md gates.json Priority Documentation Outdated

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/SETUP.md` (lines 56-63)

**Description:** SETUP.md says:
```
1. **`.claude/gates.json`** - Project-specific configuration (recommended)
2. **`gates.json`** - Project root configuration
3. **`${CLAUDE_PLUGIN_ROOT}hooks/gates.json`** - Plugin default (fallback)

**Note:** If `.claude/gates.json` exists, `gates.json` in project root is NOT loaded.
```

But looking at `src/config.ts` lines 227-244, the implementation:
1. Loads plugin config first (as base)
2. Searches project paths in order, stops at first found
3. MERGES project config with plugin config

The current documentation implies mutual exclusivity between project configs, but actually all configs are MERGED with plugin config as the base.

**Verified against:** `src/config.ts` function `loadConfig()` shows merge behavior.

**Impact:** Users may be confused about config merging behavior.

**Action:** Clarify that plugin config is always loaded as base, then first project config found is merged on top.

---

### SUGGESTION-9: Missing Description Field in Gate Examples

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (multiple locations)

**Description:** Some gate configuration examples omit the `description` field:
```json
{
  "gates": {
    "check": {"command": "npm run lint", "on_fail": "BLOCK"}
  }
}
```

While description is optional, it helps users understand gate purpose and appears in logs.

**Impact:** Minor - examples would be more complete with descriptions.

**Action:** Add description fields to examples for consistency.

---

### SUGGESTION-10: Workflow Examples Directory Missing Multiple Files

**Location:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (lines 1279-1283, 1286-1294)

**Description:** README says examples are in `plugin/hooks/examples/`:
- `code-review.workflow.md` - Listed (EXISTS)
- `strict.json` - Listed (EXISTS)
- `permissive.json` - Listed (EXISTS)
- `pipeline.json` - Listed (EXISTS)
- `convention-based.json` - Listed (EXISTS)
- `context/` - Listed (EXISTS)

But previously mentioned workflow examples in documentation (execute.workflow.md, verify-code.workflow.md, etc.) are mentioned but git status shows they were deleted.

**Verified against:** Git status shows deleted:
```
D plugin/hooks/examples/collate.workflow.md
D plugin/hooks/examples/crosscheck.workflow.md
D plugin/hooks/examples/execute.workflow.md
D plugin/hooks/examples/verify-code.workflow.md
D plugin/hooks/examples/verify-docs.workflow.md
D plugin/hooks/examples/verify-plan.workflow.md
```

**Impact:** Documentation references may become outdated if examples don't exist.

**Action:** Verify the examples section accurately reflects what's actually in the directory.

---

## Verification Summary

| Category | Count |
|----------|-------|
| BLOCKING Issues | 5 |
| SUGGESTIONS | 10 |
| Total Issues | 15 |

### Files Reviewed
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (1295 lines)
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/SETUP.md` (642 lines)
- `/Users/tobyhede/psrc/turboshovel/CLAUDE.md` (111 lines)

### Implementation Files Verified Against
- `src/cli/workflow-cli.ts` - Workflow CLI implementation
- `src/workflow/state.ts` - Workflow state management
- `src/workflow/context.ts` - Workflow context injection
- `src/context.ts` - Context file discovery
- `src/config.ts` - Configuration loading and validation
- `src/types.ts` - Type definitions
- `src/schemas.ts` - Input validation schemas
- `plugin/hooks/gates.json` - Default gate configuration
- `plugin/hooks/hooks.json` - Hook registration
- `plugin/hooks/examples/*.json` - Example configurations

---

## Appendix: Accurate Documentation Found

These sections were verified as accurate:

1. **Context file naming convention** - `.claude/context/{name}-{stage}.md` works as documented
2. **Hook event list** - All 11 hooks in README match `hooks.json`
3. **gates.json schema** - Documented structure matches `GatesConfig` interface
4. **Workflow state schema** - JSON format matches `WorkflowState` interface
5. **Keyword filtering behavior** - UserPromptSubmit-only behavior correctly documented
6. **File pattern filtering** - minimatch syntax correctly documented
7. **Multi-plugin configuration** - `enabledPlugins` format correct
8. **Session file paths** - `.claude/session/state.json` and `.claude/turboshovel/session.json` correctly documented as separate mechanisms
