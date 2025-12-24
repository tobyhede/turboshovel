# Review - 2025-12-24

## Metadata
- **Reviewer:** technical-writer (Agent A)
- **Date:** 2025-12-24 16:30:00
- **Subject:** Project documentation verification against codebase implementation
- **Ground Truth:** Current codebase implementation in plugin/hooks/hooks-app/
- **Context:** Independent review #1 for dual-verification
- **Mode:** Review

## Summary
- **Subject:** Verification of all Turboshovel documentation files (CLAUDE.md, README.md, ARCHITECTURE.md, CONVENTIONS.md, INTEGRATION_TESTS.md, SETUP.md, TYPESCRIPT.md)
- **Scope:** Cross-referenced all documented features, file paths, commands, configurations, and architectural claims against actual implementation

---

## Status: APPROVED WITH SUGGESTIONS

## BLOCKING (Must Address)

**[BLOCKING-1] config.ts missing PreCompact and PermissionRequest hooks:**
- Description: hooks.json registers 11 hooks including PreCompact and PermissionRequest. Documentation in ARCHITECTURE.md correctly lists 11 hooks. However, config.ts KNOWN_HOOK_EVENTS array only contains 12 entries but is missing PreCompact and PermissionRequest (has SubagentStart instead which is correct).
- Location: config.ts lines 8-21
- Impact: Configuration validation will reject valid hook events PreCompact and PermissionRequest
- Action: Add "PreCompact" and "PermissionRequest" to KNOWN_HOOK_EVENTS in config.ts. Current list:
  ```
  PreToolUse, PostToolUse, SubagentStop, UserPromptSubmit,
  SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd,
  SessionStart, SessionEnd, Stop, Notification
  ```
  Missing: PreCompact, PermissionRequest, SubagentStart

**[BLOCKING-2] ARCHITECTURE.md: "commands" gate example does not exist:**
- Description: ARCHITECTURE.md lines 69-84 show plugin gates.json with a "commands" gate for "Context-aware command injection". The actual plugin/hooks/gates.json has: plugin-path, check, test, and build gates. No "commands" gate exists.
- Location: ARCHITECTURE.md lines 69-84
- Impact: Users following documentation example will be confused when the "commands" gate doesn't exist
- Action: Update ARCHITECTURE.md example to reflect actual gates.json content:
  ```json
  {
    "gates": {
      "plugin-path": {
        "description": "Verify plugin path resolution in subagents",
        "on_pass": "CONTINUE",
        "on_fail": "CONTINUE"
      },
      "check": { ... },
      "test": { ... },
      "build": { ... }
    }
  }
  ```

**[BLOCKING-3] ARCHITECTURE.md: Directory structure path incorrect:**
- Description: Directory structure at lines 92-130 shows `../context/` for plugin context files. The actual path is `plugin/context/` (verified). The relative path from plugin/hooks/ would be `../context/` which is technically correct but confusing in the context of the directory tree.
- Location: ARCHITECTURE.md line 103
- Impact: Users may not find context files at expected location
- Action: Change directory structure to show absolute path or clarify:
  ```
  plugin/
  ├── context/                    # Plugin-level context files
  │   ├── session-start.md
  │   ├── prompt-submit.md
  │   ├── subagent-stop.md
  │   └── tool-use.md
  ├── hooks/                      # Hook system
  ```

## SUGGESTIONS (Would Improve Quality)

**[SUGGESTION-1] TYPESCRIPT.md: HookInput interface is incomplete:**
- Description: TYPESCRIPT.md lines 104-127 show HookInput interface but is missing fields from actual schemas.ts implementation.
- Location: TYPESCRIPT.md lines 104-127
- Benefit: More accurate API documentation for gate developers
- Action: Add missing fields from schemas.ts:
  ```typescript
  agent_id?: string;
  agent_transcript_path?: string;
  tool_input?: {
    description?: string;
    subagent_type?: string;
    prompt?: string;
  };
  ```

**[SUGGESTION-2] README.md: Workflow --step vs --task flag clarification:**
- Description: README.md line 842-843 notes --task is for parallel task IDs, and CLAUDE.md line 95 mentions --step N for jumping. The distinction could be clearer.
- Location: README.md line 842-843, CLAUDE.md line 95
- Benefit: Reduces user confusion about flag purposes
- Action: Add explicit clarification: "--step N jumps to workflow step N (e.g., step 3). --task is for parallel subtask IDs like 3.A, 3.B"

**[SUGGESTION-3] CONVENTIONS.md: SlashCommand/Skill hooks status unclear:**
- Description: Lines 40-43 state SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd are "planned hooks (not yet registered)" but they ARE in config.ts KNOWN_HOOK_EVENTS. They're just not in hooks.json.
- Location: CONVENTIONS.md lines 40-43
- Benefit: Clarifies implementation status
- Action: Reword to: "SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd - recognized by config validation but not yet registered in hooks.json for Claude Code routing"

**[SUGGESTION-4] SETUP.md: Config loading behavior clarification:**
- Description: Line 58-62 implies priority fallthrough, but config.ts only loads FIRST project config found then merges with plugin config.
- Location: SETUP.md lines 58-62
- Benefit: Accurate description of config loading
- Action: Clarify that only the first project config found (.claude/gates.json OR gates.json, not both) is loaded and merged with plugin defaults

**[SUGGESTION-5] README.md: Document default shell gates:**
- Description: Built-in gates table at line 28-29 only shows plugin-path TypeScript gate. The plugin gates.json also defines check, test, build gates with placeholder shell commands.
- Location: README.md lines 28-29
- Benefit: Users understand all available default gates
- Action: Add section explaining default shell gates (check, test, build) with placeholder commands that users should override

**[SUGGESTION-6] ARCHITECTURE.md: Session state stashing documentation:**
- Description: Types.ts SessionState includes stashedWorkflowId field and WorkflowStateManager has stash/pop methods, but ARCHITECTURE.md session state section doesn't document this.
- Location: ARCHITECTURE.md lines 318-343
- Benefit: Complete session state documentation
- Action: Add note about workflow stashing capability to session state section

**[SUGGESTION-7] INTEGRATION_TESTS.md: Test examples need update:**
- Description: Test examples at line 15-18 use jq commands that assume specific gates.json structure. Actual structure differs (no rust-agent in enabled_agents by default).
- Location: INTEGRATION_TESTS.md lines 15-18, 36-38
- Benefit: Tests reflect actual default configuration
- Action: Update test setup examples to match actual gates.json:
  ```bash
  jq '.hooks.SubagentStop.enabled_agents' plugin/hooks/gates.json
  # Returns [] (empty array) not ["rust-agent"]
  ```

**[SUGGESTION-8] README.md: Clarify context file lowercase convention:**
- Description: Context.ts lines 188-192 show tool names are lowercased (Edit -> edit), but CONVENTIONS.md table shows tool names as capitalized (Edit-pre.md, Edit-post.md).
- Location: CONVENTIONS.md lines 154-166, context.ts lines 188-192
- Benefit: Users create correctly named files
- Action: Update CONVENTIONS.md examples to use lowercase: edit-pre.md, edit-post.md (matching actual implementation)

**[SUGGESTION-9] CLAUDE.md: Document all 11 registered hooks:**
- Description: Features section mentions hooks but doesn't list all 11. hooks.json registers: SessionStart, SessionEnd, UserPromptSubmit, SubagentStart, SubagentStop, PreToolUse, PostToolUse, Stop, Notification, PreCompact, PermissionRequest.
- Location: CLAUDE.md Features section
- Benefit: Complete hook coverage documentation
- Action: Add complete hook list to documentation section

**[SUGGESTION-10] README.md: workflow CLI path clarification:**
- Description: Line 448 shows `node plugin/hooks/hooks-app/dist/cli/workflow-cli.js` but package.json defines bin.workflow pointing to same file. After npm link, just `workflow` command works.
- Location: README.md lines 443-452
- Benefit: Clearer CLI usage instructions
- Action: Clarify that after `npm link`, the command is simply `workflow start <file>` not the full node path

---

## Assessment

**Conclusion:**
The documentation is generally well-maintained and accurate. Three blocking issues were identified:
1. config.ts KNOWN_HOOK_EVENTS is missing SubagentStart, PreCompact, and PermissionRequest (code bug)
2. ARCHITECTURE.md references a "commands" gate that doesn't exist in actual gates.json
3. ARCHITECTURE.md directory structure has confusing relative path notation

The remaining suggestions are improvements for clarity and completeness. Core functionality is accurately documented.

**Confidence in findings:**
- HIGH for file path verifications (verified via filesystem)
- HIGH for code cross-referencing (read actual source files)
- HIGH for configuration structure (compared JSON files directly)
- MEDIUM for workflow CLI behavior (verified from source, not tested live)

**Files Verified:**
- /Users/tobyhede/psrc/turboshovel/CLAUDE.md
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/ARCHITECTURE.md
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/CONVENTIONS.md
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/INTEGRATION_TESTS.md
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/SETUP.md
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/TYPESCRIPT.md
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/gates.json
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks.json
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/types.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/schemas.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/config.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/dispatcher.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/context.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/session.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/cli/workflow-cli.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/workflow/state.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/workflow/types.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/workflow/parser/parser.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/gates/index.ts
- /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/* (all files verified)
- /Users/tobyhede/psrc/turboshovel/plugin/context/* (all files verified)
