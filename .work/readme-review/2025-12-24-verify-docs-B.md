# Documentation Verification Review - Agent B

**Date:** 2025-12-24
**Reviewer:** Agent B (Independent Verification)
**Scope:** README.md, SETUP.md, CLAUDE.md - User Onboarding Documentation

---

## Executive Summary

The documentation is generally well-written and comprehensive. However, I found several issues that would affect new user onboarding. Most critically, the workflow CLI documentation describes features that may not work as documented, and there are some path inconsistencies.

---

## BLOCKING Issues

### BLOCKING-01: Workflow CLI Direct Invocation Path Incorrect

**Location:** README.md, lines 476-477 (Workflow CLI Setup section)

**Description:** The documentation states:
```bash
# Option 2: Direct invocation (without linking)
node plugin/hooks/hooks-app/dist/cli/workflow-cli.js <command>
```

**Verification:** The actual distribution structure shows:
- `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/dist/cli/workflow-cli.js` exists and is 17KB

However, the path in the documentation assumes the user is in the turboshovel project root. For users installing turboshovel as a plugin, the path would be different (e.g., `${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli/workflow-cli.js`).

**Impact:** New users following Option 2 without linking would have incorrect paths, especially if using turboshovel as an installed plugin rather than from source.

**Action:** Update to show the plugin-relative path using `${CLAUDE_PLUGIN_ROOT}`:
```bash
# Option 2: Direct invocation (without linking)
node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli/workflow-cli.js <command>
```

---

### BLOCKING-02: Context File Tool Names Case Inconsistency

**Location:** README.md, lines 163-164 (Hook-to-File Mapping table)

**Description:** The documentation shows context file examples with mixed casing:
```
| `PreToolUse` | `{tool}-pre.md` | `Edit-pre.md` |
| `PostToolUse` | `{tool}-post.md` | `Edit-post.md` |
```

**Verification:** The implementation in `context.ts` (lines 189-192) explicitly lowercases tool names:
```typescript
case 'PreToolUse':
  return input.tool_name ? { name: input.tool_name.toLowerCase(), stage: 'pre' } : null;

case 'PostToolUse':
  return input.tool_name ? { name: input.tool_name.toLowerCase(), stage: 'post' } : null;
```

**Impact:** Users creating files like `Edit-pre.md` will not have them discovered. The correct filename would be `edit-pre.md` (lowercase).

**Action:** Fix the examples in the table to use lowercase:
```
| `PreToolUse` | `{tool}-pre.md` | `edit-pre.md` |
| `PostToolUse` | `{tool}-post.md` | `edit-post.md` |
```

---

### BLOCKING-03: CONVENTIONS.md Corrected but README.md Still Inconsistent

**Location:** CONVENTIONS.md correctly documents this in "Tool Names" section (lines 160-163):
```markdown
### Tool Names (for PreToolUse/PostToolUse)
- Tool names are **lowercased** for context file discovery
- `Edit` tool -> `edit-pre.md`, `edit-post.md`
```

README.md contradicts this with capital E in examples.

**Impact:** Documentation inconsistency causes user confusion and file discovery failures.

**Action:** Synchronize README.md with CONVENTIONS.md - use lowercase tool names in examples.

---

### BLOCKING-04: Missing `workflow complete` Documentation in CLAUDE.md

**Location:** CLAUDE.md, lines 92-101

**Description:** CLAUDE.md lists workflow commands including `workflow complete`:
```markdown
- `workflow complete` - Mark workflow as complete
```

**Verification:** The `workflow-cli.ts` implementation shows `complete` command exists (lines 232-260) with `--status` option:
```typescript
program
  .command('complete')
  .description('Mark current workflow as complete')
  .option('--status <status>', 'Completion status (ok|blocked)', 'ok')
```

**Impact:** The `--status` option (ok|blocked) is not documented in CLAUDE.md, but is documented in README.md. This inconsistency could confuse users who reference CLAUDE.md.

**Action:** Ensure CLAUDE.md and README.md are synchronized for workflow commands, or add a clear reference from CLAUDE.md to README.md for full workflow documentation.

---

## SUGGESTIONS

### SUGGESTION-01: Example JSON Files Use `mise run` Commands

**Location:** README.md line 73-75, SETUP.md line 320-321

**Description:** The example configuration files (strict.json, permissive.json) use `mise run check`, `mise run test`, etc. as example commands. While mise is a valid task runner, most users will be using npm, yarn, pnpm, or cargo.

**Verification:** `plugin/hooks/examples/strict.json` shows:
```json
"command": "mise run check",
```

The plugin's default `gates.json` uses placeholder echo commands which are clearer:
```json
"command": "echo '[PLACEHOLDER] Quality checks passed. Configure with actual project check command (e.g., npm run lint, cargo clippy)'"
```

**Impact:** New users might not know what mise is or assume they need to install it.

**Action:** Consider either:
1. Using npm commands in examples as the most common case
2. Adding a note explaining that mise is just one example task runner
3. Using the placeholder pattern from gates.json in examples

---

### SUGGESTION-02: Debugging Command Uses Variable Not Available to Users

**Location:** README.md, lines 395-396

**Description:** The debugging section shows:
```bash
tail -f $(node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js log-path)
```

This requires `${CLAUDE_PLUGIN_ROOT}` to be set, which is only available during hook execution.

**Verification:** The CLI does support `log-path` and `log-dir` commands (cli.ts lines 27-36).

**Impact:** Users trying to debug outside of hook execution won't have this variable set.

**Action:** Add alternative that doesn't require the variable:
```bash
# View logs (if plugin root known)
tail -f $(node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js log-path)

# Alternative: find log file directly
tail -f $TMPDIR/turboshovel/hooks-$(date +%Y-%m-%d).log
```

---

### SUGGESTION-03: IF/ELSE Syntax Documentation May Mislead Users

**Location:** README.md, lines 607-620

**Description:** The documentation describes IF/ELSE conditional syntax with a warning that it's not implemented:
```markdown
> **Warning:** IF/ELSE conditionals are planned but not currently supported by the parser.
```

The documentation then shows the planned syntax before explaining the workaround.

**Impact:** Users might try the IF/ELSE syntax first, fail, then have to read further to find the workaround. The workaround section is well-written but could be presented first.

**Action:** Consider restructuring to:
1. Lead with the current working approach (agent-controlled branching)
2. Then mention the planned IF/ELSE syntax as a "future feature" at the end

---

### SUGGESTION-04: SubagentStart Context Injection Status Unclear

**Location:** README.md, line 87

**Description:** The table shows:
```
| `SubagentStart` | `{agent}-start.md` | x Not implemented | Gates only |
```

**Verification:** Looking at `context.ts`, `extractNameAndStage` function (lines 167-216):
```typescript
case 'SubagentStop':
  // SubagentStop has special handling - uses agent-command scoping
  return null;
```

SubagentStart is not listed in the switch statement at all, confirming it's not implemented.

But the hooks.json shows SubagentStart IS registered as a hook (line 25-30).

**Impact:** This is correctly documented, just confirming verification.

**Action:** None required - documentation is accurate.

---

### SUGGESTION-05: Workflow State File Path Inconsistency

**Location:** README.md, line 749 vs CLAUDE.md, line 103

**Description:**
- README.md states: `Workflow state persists to .claude/turboshovel/workflows/{id}.json`
- CLAUDE.md states: `State persists in .claude/turboshovel/workflows/ (workflow files)`

**Verification:** Implementation in `state.ts` (lines 7-8):
```typescript
const STATE_DIR = '.claude/turboshovel/workflows';
const SESSION_FILE = '.claude/turboshovel/session.json';
```

Both documents are correct but README is more specific with `{id}.json` pattern.

**Impact:** Minor - documentation is consistent.

**Action:** None required.

---

### SUGGESTION-06: `workflow start` Examples Missing in Getting Started

**Location:** README.md Quick Start section (lines 484-502)

**Description:** The workflow Quick Start shows commands but not a complete getting-started workflow. Users would benefit from seeing:
1. How to create a workflow file
2. Where to put it
3. How to start it

**Verification:** The documentation has comprehensive syntax reference later but the "Quick Start" section assumes prior knowledge.

**Impact:** New users may not know where to put workflow files or how they're structured.

**Action:** Add a minimal "Create your first workflow" example in Quick Start:
```bash
# 1. Create a workflow file
cat > .claude/workflows/my-workflow.md << 'EOF'
# My First Workflow

## 1. Setup
Create the thing.
- PASS: CONTINUE

## 2. Verify
Check it works.
- PASS: DONE
EOF

# 2. Start the workflow
workflow start .claude/workflows/my-workflow.md
```

---

### SUGGESTION-07: Environment Variable Documentation Inconsistency

**Location:** CLAUDE.md lines 60-63 vs README.md CONVENTIONS.md

**Description:** CLAUDE.md mentions:
```markdown
- `TURBOSHOVEL_LOG=0` - Disable logging (enabled by default)
- `TURBOSHOVEL_LOG_LEVEL=debug|info|warn|error` - Set log verbosity (default: info)
```

**Verification:** logger.ts implementation (lines 45-47, 53-59) confirms:
- `TURBOSHOVEL_LOG` defaults to enabled (only `=0` disables)
- `TURBOSHOVEL_LOG_LEVEL` defaults to `info`

The documentation is accurate but CONVENTIONS.md (line 358) shows `TURBOSHOVEL_LOG=0` as "Disable logging entirely" which is correct.

**Impact:** None - documentation is accurate and consistent.

**Action:** None required.

---

### SUGGESTION-08: Workflow Examples Directory Reference

**Location:** README.md, lines 1279-1283

**Description:** The documentation references:
```markdown
Full workflow examples in `plugin/hooks/examples/`:
- **`code-review.workflow.md`** - Code review dispatch and triage (4 tasks)
```

**Verification:** The file exists at `/Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/code-review.workflow.md` and contains 4 tasks.

However, the README examples section (lines 1286-1294) also mentions files that were deleted according to git status:
- `collate.workflow.md` - deleted
- `crosscheck.workflow.md` - deleted
- `execute.workflow.md` - deleted
- etc.

**Impact:** Users looking for these example workflows won't find them.

**Action:** Update the examples section to only list files that exist:
```markdown
See `plugin/hooks/examples/` for ready-to-use configurations:

- `strict.json` - Block on all failures
- `permissive.json` - Warn only
- `pipeline.json` - Gate chaining
- `convention-based.json` - Zero-config context injection patterns
- `context/` - Example context files
- `code-review.workflow.md` - Code review workflow
```

---

### SUGGESTION-09: Description Field in Gate Config Not Explicitly Documented

**Location:** README.md Gate Configuration section

**Description:** The `description` field is used in examples but never explicitly documented as a configuration option.

**Verification:** The `GateConfig` interface in `types.ts` doesn't show `description` as a typed field. It's used in gates.json but appears to be for documentation purposes only.

Looking at `gates.json`:
```json
"check": {
  "description": "Run project quality checks (formatting, linting, types)",
  ...
}
```

**Impact:** Users might wonder if `description` is required or optional.

**Action:** Add a note clarifying that `description` is optional documentation for human readers.

---

### SUGGESTION-10: Workflow findWorkflowFile Search Logic

**Location:** README.md doesn't document where workflow files are searched

**Description:** The `findWorkflowFile` function in `workflow-cli.ts` (lines 451-472) searches:
1. Direct path from cwd (e.g., `${cwd}/${filename}`)
2. `.claude/workflows/` directory (basename only)

This is not documented.

**Verification:**
```typescript
async function findWorkflowFile(cwd: string, filename: string): Promise<string | null> {
  // Check if filename is a relative path from cwd
  const directPath = path.join(cwd, filename);

  // Check .claude/workflows/ for basename only
  const basename = path.basename(filename);
  const claudeDir = path.join(cwd, '.claude/workflows', basename);
```

**Impact:** Users might not know they can put workflows in `.claude/workflows/` for organization.

**Action:** Document the workflow file search locations in the Workflow System section.

---

## Verified Correct

The following documentation claims were verified as accurate:

1. **Hook registration** - All 11 hooks in README table are registered in hooks.json
2. **Context file discovery priority** - Project takes precedence over plugin (verified in context.ts)
3. **Gates.json search priority** - .claude/gates.json > gates.json > plugin default (verified in config.ts)
4. **Config merging behavior** - Confirmed in mergeConfigs function
5. **Keyword matching** - Only applies to UserPromptSubmit hook (verified in dispatcher.ts)
6. **File pattern matching** - Only applies to PostToolUse hook (verified in dispatcher.ts)
7. **Workflow state persistence paths** - Correctly documented
8. **Environment variables** - TURBOSHOVEL_LOG and TURBOSHOVEL_LOG_LEVEL work as documented
9. **Multi-plugin configuration warnings** - Accurately explains CLAUDE_PLUGIN_ROOT behavior
10. **TypeScript gates** - Module loading and naming conventions verified in gate-loader.ts

---

## Summary

| Category | Count |
|----------|-------|
| BLOCKING | 4 |
| SUGGESTIONS | 10 |
| Verified Correct | 10 |

The most critical issues are the tool name casing inconsistency (BLOCKING-02/03) which would cause user-created context files to not be discovered, and the workflow CLI path issue (BLOCKING-01) which would prevent users from running the workflow CLI without npm link.
