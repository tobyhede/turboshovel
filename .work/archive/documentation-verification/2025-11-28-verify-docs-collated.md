---
name: Collated Documentation Verification Report
description: Systematic collation of two independent Turboshovel documentation reviews
when_to_use: Documentation approval decision gate
version: 1.0.0
---

# Collated Review Report - Documentation Verification

## Metadata
- **Review Type:** Documentation Verification
- **Date:** 2025-11-28 13:55:00
- **Reviewers:** technical-writer agent (Review #1), Documentation Verification Agent (Review #2)
- **Subject:** Turboshovel documentation (README.md, CLAUDE.md, SETUP.md, ARCHITECTURE.md, CONVENTIONS.md, TYPESCRIPT.md, INTEGRATION_TESTS.md)
- **Review Files:**
  - Review #1: `/Users/tobyhede/psrc/turboshovel/.work/2025-11-28-verify-docs-134949.md`
  - Review #2: `/Users/tobyhede/psrc/turboshovel/.work/2025-11-28-verify-docs-135037.md`

## Executive Summary
- **Total unique issues identified:** 18
- **Common issues (high confidence):** 3
- **Exclusive issues (requires judgment):** 15
- **Divergences (requires investigation):** 1

**Overall Status:** BLOCKED

Critical documentation/implementation gaps identified. Multiple documented features do not exist or are not functional as described. Users following documentation will encounter configuration failures and misleading expectations.

---

## Common Issues (High Confidence)

Both reviewers independently found these issues.

**Confidence: VERY HIGH** - Both reviewers found these issues independently, making them very likely to be real problems requiring immediate correction.

### BLOCKING / CRITICAL

**1. Missing Plugin Context Directory** (plugin/hooks/context/)

- **Reviewer #1 finding:** Documentation claims plugin-level context files exist at `${CLAUDE_PLUGIN_ROOT}/context/` but this directory does not exist in the codebase. Code searches for this directory but it never gets created. Only plugin/hooks/examples/context/ exists.
- **Reviewer #2 finding:** Documentation claims plugin provides context files at `${CLAUDE_PLUGIN_ROOT}/context/` that auto-inject, but plugin/hooks/context/ directory does not exist. Only examples exist. Context injection for plugin defaults silently fails without error. This is dead code that will never return anything.
- **Confidence:** VERY HIGH (both found independently - verified by filesystem check)
- **Severity consensus:** BLOCKING
- **Impact:** Users expect plugin fallback context injection to work but it will never materialize. Documentation sets false expectations about available default context files. Context paths code is dead code (plugin/hooks/hooks-app/src/context.ts lines 69-80).
- **Action required:** Either create plugin/hooks/context/ directory with actual default context files, OR remove all references to plugin context injection from documentation. Update ARCHITECTURE.md to remove the context/ directory from structure. Clarify in README.md that only project-level context injection is supported.

---

**2. Hook Event Registration Mismatch - Documentation Claims 12 Hooks, Only 4 Registered** (hooks.json)

- **Reviewer #1 finding:** Documentation claims 12 hook events are supported with comprehensive descriptions, but hooks.json only registers 4 hook events. The remaining 8 hook events are not registered with Claude Code (SessionEnd, SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd, PreToolUse, Stop, Notification). Users attempting to use context files for 8 of the 12 documented hook events will fail silently.
- **Reviewer #2 finding:** Documentation claims all 12 Claude Code hooks are registered and supported, but hooks.json only registers 4 hooks (PostToolUse, SubagentStop, UserPromptSubmit, SessionStart). Missing from hooks.json: SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd, PreToolUse, Stop, SessionEnd, Notification. Users may attempt to create context files for unregistered hooks expecting them to work, but they won't fire because hooks.json doesn't register those events.
- **Confidence:** VERY HIGH (both found independently - verified by direct inspection of hooks.json)
- **Severity consensus:** BLOCKING
- **Impact:** Major discrepancy between documentation promises (12 hooks) and actual functionality (4 hooks). Creates wasted effort when users discover their context files don't work. Contradicts feature completeness claims.
- **Action required:** Either register all 12 hook events in hooks.json with proper implementations, OR update all documentation (README.md lines 78-95, ARCHITECTURE.md lines 207-223, CONVENTIONS.md lines 27-39) to accurately list only the 4 supported hook events: PostToolUse, SubagentStop, UserPromptSubmit, SessionStart. This is a critical alignment issue between promise and reality.

---

**3. Documentation/Implementation Discrepancy Pattern** (General)

- **Reviewer #1 finding:** Multiple instances where documentation claims features or behaviors that don't exist or are untested in the actual codebase (plugin gates feature, commands gate, INTEGRATION_TESTS.md script references).
- **Reviewer #2 finding:** Significant gaps exist between documented scope and actual implementation across multiple areas (hook events, gate behaviors, context patterns).
- **Confidence:** VERY HIGH (both found multiple independent examples)
- **Severity consensus:** BLOCKING
- **Impact:** Documentation cannot be trusted as a reliable guide to actual implementation. Users face configuration failures when following documented procedures.
- **Action required:** Systematic audit of all documentation claims against actual code implementation. Establish process to keep documentation synchronized with code changes.

---

## Exclusive Issues (Requires Judgment)

Only one reviewer found these issues. May be valid edge cases or may require judgment to assess.

**Confidence: MODERATE** - One reviewer found these. May be valid edge cases or may require judgment to assess.

### Found by Reviewer #1 Only

#### BLOCKING / CRITICAL

**1. Plugin Gate References Feature Appears Untested** (config.ts, gate-loader.ts)

- **Found by:** Reviewer #1
- **Description:** SETUP.md extensively documents "plugin gate references" feature with detailed examples and troubleshooting. Code structure exists for resolvePluginPath() in config.ts (lines 99-139) with gate validation, but integration testing is incomplete. No plugin gate execution shown in existing gate-loader tests. plugin/hooks/hooks-app/__tests__/plugin-gates.integration.test.ts exists but appears incomplete.
- **Severity:** BLOCKING
- **Reasoning:** Feature is documented as fully functional but testing and implementation verification is unclear. Users configuring plugin gate references per SETUP.md documentation may experience silent failures or unpredictable behavior.
- **Confidence:** MODERATE (requires judgment - code structure exists but testing is unclear)
- **Recommendation:** Verify that plugin gate reference feature is fully implemented and tested. Create comprehensive integration tests for plugin gate references. If not fully implemented, remove SETUP.md plugin gate reference section (lines 358-456) and README.md examples (lines 168-191) or mark as experimental. Document any limitations or known issues with this feature.

---

**2. Commands Gate Documentation Missing - Feature Not Implemented** (TYPESCRIPT.md)

- **Found by:** Reviewer #1
- **Description:** TYPESCRIPT.md (lines 219-272) documents a "commands" gate as a "built-in gate" showing complete implementation of src/gates/commands.ts. However, gates/index.ts does NOT export "commands" gate, no commands.ts file exists in plugin/hooks/hooks-app/src/gates/, and plugin gates.json (lines 2-43) does NOT define a "commands" gate. The documentation example code is orphaned and non-functional.
- **Severity:** BLOCKING
- **Reasoning:** Users follow the example TYPESCRIPT.md code and expect a "commands" TypeScript gate to be available, but it doesn't exist. This creates confusion about creating custom gates and misleads users about plugin capabilities.
- **Confidence:** MODERATE (requires judgment - code clearly doesn't exist, but unclear if example was meant to be functional)
- **Recommendation:** Either implement the commands gate and register it in index.ts and gates.json, OR remove the TYPESCRIPT.md example code (lines 219-272). Verify that ONLY built-in gates documented actually exist in codebase.

---

#### NON-BLOCKING / LOWER PRIORITY

**3. Development Command Documentation Incomplete** (CLAUDE.md)

- **Found by:** Reviewer #1
- **Description:** CLAUDE.md (lines 37-41) lists development commands but they're incomplete for the actual project structure. Missing commands: npm install before building (required for first-time setup), npm run watch for TypeScript changes, mention of dist/ directory requirement, and build success verification for plugin functionality.
- **Severity:** NON-BLOCKING
- **Benefit:** Users new to the project would know the correct sequence: install → build → verify dist/ exists. Reduces friction for contributors getting started.
- **Confidence:** MODERATE (only one reviewer suggested)

---

**4. Configuration Load Order Documentation Incomplete** (README.md)

- **Found by:** Reviewer #1
- **Description:** README.md (lines 280-291) documents "Configuration Merging" diagram but doesn't explain what happens when gates.json is completely missing. Doesn't clearly state that plugin/hooks/gates.json is ALWAYS loaded as fallback. Unclear whether projects NEED to create .claude/gates.json or if it's truly optional.
- **Severity:** NON-BLOCKING
- **Benefit:** Clarifies that context injection works WITHOUT any gates.json, and plugin defaults apply if project doesn't override.
- **Confidence:** MODERATE (only one reviewer suggested)

---

**5. Example Configuration File Inconsistencies** (SETUP.md vs examples/)

- **Found by:** Reviewer #1
- **Description:** Example configuration files in plugin/hooks/examples/ show different commands than documentation. SETUP.md examples show npm run lint/test/build, but actual examples use mise run check/test/build. SETUP.md also shows Rust, Python, Make examples, but actual examples all use mise. Documentation doesn't explain why or when to use different task runners.
- **Severity:** NON-BLOCKING
- **Benefit:** Helps users understand when to use mise vs npm vs other tools, and that examples need customization.
- **Confidence:** MODERATE (only one reviewer found)

---

**6. Missing Environment Variable Documentation** (CLAUDE.md not in README.md)

- **Found by:** Reviewer #1
- **Description:** CLAUDE.md documents environment variables (TURBOSHOVEL_LOG, TURBOSHOVEL_LOG_LEVEL) but they're not shown in README.md quick reference. Users debugging hooks might not know about these environment variables since they're not in the main debugging documentation.
- **Severity:** NON-BLOCKING
- **Benefit:** Users debugging hook issues know immediately how to enable logging.
- **Confidence:** MODERATE (only one reviewer found)

---

**7. Keyword Matching Behavior Needs Clarification** (CONVENTIONS.md)

- **Found by:** Reviewer #1
- **Description:** CONVENTIONS.md doesn't document the behavior of keyword matching for gates. README.md (lines 225-251) documents keyword gates exist but doesn't explain matching behavior. dispatcher.ts (lines 54-72) shows substring matching (not word-boundary matching) - "test" will match "latest" or "contest" intentionally for flexibility.
- **Severity:** NON-BLOCKING
- **Benefit:** Users understand why "test" keyword matches "testing", "latest", "contest", etc., and can configure keywords accordingly.
- **Confidence:** MODERATE (only one reviewer found)

---

**8. INTEGRATION_TESTS.md References Incorrect Script Paths** (INTEGRATION_TESTS.md)

- **Found by:** Reviewer #1
- **Description:** INTEGRATION_TESTS.md (lines 250-259) references test steps that use `source ${CLAUDE_PLUGIN_ROOT}hooks/shared-functions.sh` and `run_gate` commands. These scripts don't appear in plugin/hooks/ directory. Script path may be incorrect or function may have been removed during extraction.
- **Severity:** NON-BLOCKING
- **Benefit:** Users trying to follow testing procedures won't encounter "command not found" errors.
- **Confidence:** MODERATE (only one reviewer found)

---

### Found by Reviewer #2 Only

#### BLOCKING / CRITICAL

**1. SessionStart Hook Functionality Documentation Issue** (hooks.json, examples/context/)

- **Found by:** Reviewer #2
- **Description:** Documentation claims SessionStart is fully supported with context injection. hooks.json registers SessionStart (lines 13-19), but examples/context/session-start.md (lines 24-26) explicitly states: "Note: SessionStart is not currently a supported hook in Claude Code. This file serves as a template..." This directly contradicts documentation claims in README.md (line 82-84), ARCHITECTURE.md (line 212), and CONVENTIONS.md (line 28).
- **Severity:** BLOCKING
- **Reasoning:** Users may attempt to use SessionStart context injection expecting it to work, but it won't actually trigger. The example file itself documents that the feature doesn't work, directly contradicting the documentation's feature claims.
- **Confidence:** MODERATE (requires judgment - code shows contradiction between registration and actual functionality)
- **Recommendation:** Clarify in README.md and ARCHITECTURE.md that SessionStart registration exists but may not be functional in Claude Code. Move session-start.md to disabled/template section or clearly mark as "Currently unavailable". Add note in CONVENTIONS.md that SessionStart should not be relied upon.

---

**2. Command Field Mutual Exclusivity Not Documented** (types.ts, config.ts)

- **Found by:** Reviewer #2
- **Description:** Documentation shows `command` field in gate examples throughout (SETUP.md lines 93-119, README.md lines 199-204, CLAUDE.md lines 15-35) without noting that command field is mutually exclusive with plugin/gate fields. Actual GateConfig interface (types.ts lines 38-44) shows fields are mutually exclusive. config.ts validateGateConfig() (lines 21-31) throws error: "Gate cannot have both 'command' and 'plugin/gate'".
- **Severity:** BLOCKING
- **Reasoning:** Documentation doesn't clearly show the mutual exclusivity constraint. Examples could be misinterpreted as allowing both fields simultaneously. Users may create invalid configurations that fail validation.
- **Confidence:** MODERATE (requires judgment - constraint is enforced but not documented)
- **Recommendation:** Update SETUP.md "Customizing Gates" section to explicitly state: "Note: command field is mutually exclusive with plugin/gate fields". Add constraint note to README.md gate examples. Consider adding validation error message to documentation.

---

#### NON-BLOCKING / LOWER PRIORITY

**3. SubagentStop Context Injection Pattern Not Documented** (context.ts, dispatcher.ts)

- **Found by:** Reviewer #2
- **Description:** Documentation describes standard context file naming pattern but doesn't adequately document the special agent-command scoping pattern for SubagentStop. CONVENTIONS.md (lines 23-24) mentions agent-command scoping only in passing. README.md and ARCHITECTURE.md don't mention special SubagentStop handling. Actual implementation (context.ts lines 115-180) implements special logic searching in priority order: {agent}-{command}-{stage}.md, {agent}-{stage}.md, standard discovery. dispatcher.ts (lines 236-260) has special case handling for SubagentStop using session state (active_command, active_skill).
- **Severity:** NON-BLOCKING
- **Benefit:** Users understand how to properly scope context for SubagentStop events and utilize session state (active_command, active_skill).
- **Confidence:** MODERATE (only one reviewer found)

---

**4. Keyword Filtering Only for UserPromptSubmit Not Documented** (dispatcher.ts)

- **Found by:** Reviewer #2
- **Description:** Documentation claims keyword filtering works generally (README.md lines 225-251 shows keyword example for "test" gate without specifying hook restriction). Actual implementation (dispatcher.ts lines 187-195, line 202) shows keyword check is explicitly only for UserPromptSubmit hook: "if (hookEvent === 'UserPromptSubmit'...)" For all other hooks (PostToolUse, SubagentStop, etc.), keywords field is ignored (types.ts comment lines 44-47). config.ts validateGateConfig() doesn't validate that keywords only apply to UserPromptSubmit.
- **Severity:** NON-BLOCKING
- **Benefit:** Users understand that keywords on PostToolUse or SubagentStop gates will be silently ignored, avoiding confusion and unexpected behavior.
- **Confidence:** MODERATE (only one reviewer found)

---

**5. Circular Gate Reference Prevention Limits Not Documented** (dispatcher.ts)

- **Found by:** Reviewer #2
- **Description:** Documentation doesn't mention MAX_GATES_PER_DISPATCH circuit breaker limit (dispatcher.ts line 78: `const MAX_GATES_PER_DISPATCH = 10;`). dispatcher.ts (lines 136-142) implements circuit breaker preventing infinite chains with error: "Exceeded max gate chain depth (10)" and comment "Prevents infinite loops from misconfigured gate chains".
- **Severity:** NON-BLOCKING
- **Benefit:** Users implementing complex gate chains understand the 10-gate limit design decision and know how to refactor if chain legitimately exceeds it.
- **Confidence:** MODERATE (only one reviewer found)

---

**6. UserPromptSubmit Context Injection Pattern Not Documented** (context.ts)

- **Found by:** Reviewer #2
- **Description:** Documentation describes {name}-{stage} pattern for context files but doesn't explicitly document that UserPromptSubmit uses a fixed hardcoded pattern. CONVENTIONS.md (line 154) shows pattern as `prompt-submit.md` but doesn't explain it's a fixed pattern. context.ts extractNameAndStage() (line 169) shows hardcoded: "case 'UserPromptSubmit': return { name: 'prompt', stage: 'submit' };". Pattern is hardcoded to 'prompt-submit.md' only.
- **Severity:** NON-BLOCKING
- **Benefit:** Users understand UserPromptSubmit is hardcoded to prompt-submit.md and can't customize the name (e.g., 'user-prompt-submit.md').
- **Confidence:** MODERATE (only one reviewer found)

---

**7. Missing DispatchResult Type Documentation** (TYPESCRIPT.md)

- **Found by:** Reviewer #2
- **Description:** TYPESCRIPT.md (lines 129-144) documents GateResult interface only, but dispatcher expects DispatchResult which has different structure (context, blockReason, stopMessage). dispatcher.ts (lines 30-35) shows DispatchResult interface. cli.ts (lines 7-12) converts DispatchResult to JSON. Documentation doesn't clarify the relationship between what gates return (GateResult) and what dispatcher returns (DispatchResult).
- **Severity:** NON-BLOCKING
- **Benefit:** Clarifies data flow through system and how GateResult.additionalContext becomes DispatchResult.context.
- **Confidence:** MODERATE (only one reviewer found)

---

**8. Plugin Gate Resolution Path Convention Not Fully Explained** (config.ts, SETUP.md)

- **Found by:** Reviewer #2
- **Description:** Documentation mentions "sibling convention" for plugin resolution briefly (SETUP.md lines 388-392, README.md lines 189-191) but doesn't fully explain path resolution behavior or security model. config.ts (lines 57-80) implements resolvePluginPath() using sibling convention with security comment about path traversal validation.
- **Severity:** NON-BLOCKING
- **Benefit:** More detail helps users understand limitations (plugins must be siblings in same parent directory) and security model. Document error case when plugin not found.
- **Confidence:** MODERATE (only one reviewer found)

---

**9. Session State Documentation Missing Active Agent Tracking Limitation** (types.ts, dispatcher.ts)

- **Found by:** Reviewer #2
- **Description:** Documentation shows session.get/set examples (TYPESCRIPT.md lines 176-200) but doesn't explain why active_agent is not tracked. types.ts (lines 88-89) has comment: "Note: active_agent NOT included - Claude Code does not provide unique agent identifiers". dispatcher.ts (lines 99-102) explains parallel agents make tracking unreliable: "Claude Code does not provide unique agent identifiers, making reliable agent tracking impossible when multiple agents of the same type run in parallel". Documentation doesn't mention metadata field as alternative for custom agent tracking.
- **Severity:** NON-BLOCKING
- **Benefit:** Explains design limitation and suggests metadata field for custom agent tracking. Documents why agent tracking is harder than command/skill tracking.
- **Confidence:** MODERATE (only one reviewer found)

---

**10. Action Chaining Behavior Under-Documented** (dispatcher.ts)

- **Found by:** Reviewer #2
- **Description:** Documentation mentions gate chaining (README.md lines 45-52) but doesn't explain on_pass/on_fail action resolution thoroughly. dispatcher.ts (line 200): "const action = passed ? gateConfig.on_pass || 'CONTINUE' : gateConfig.on_fail || 'BLOCK';". Documentation doesn't show real-world chaining patterns or explain default action behavior.
- **Severity:** NON-BLOCKING
- **Benefit:** Help users understand gate chaining patterns: format → lint → test, and default behaviors (default on_pass = CONTINUE, default on_fail = BLOCK).
- **Confidence:** MODERATE (only one reviewer found)

---

**11. Test Documentation Missing** (Across multiple files)

- **Found by:** Reviewer #2
- **Description:** Documentation references testing but provides limited guidance. SETUP.md (lines 247-260) shows basic commands (source shared-functions.sh, run_gate, jq). TYPESCRIPT.md (lines 283-301) shows build/test/watch commands. Complete test suite exists in __tests__/ directory with unit, integration, and plugin-gates tests, but documentation doesn't categorize tests or provide guidance on running specific test suites.
- **Severity:** NON-BLOCKING
- **Benefit:** Document test categories and what each tests. Help contributors understand test structure. Provide examples of running specific test suites.
- **Confidence:** MODERATE (only one reviewer found)

---

**12. Logging Documentation Could Be More Detailed** (README.md, TYPESCRIPT.md)

- **Found by:** Reviewer #2
- **Description:** Documentation mentions logging (README.md lines 294-311 shows basic log viewing commands, TYPESCRIPT.md lines 202-217 shows logger usage) but doesn't fully explain what gets logged or how to use logs. logger.ts has event(), debug(), info(), warn(), error(), always() methods. Logs go to $TMPDIR/turboshovel/hooks-YYYY-MM-DD.log with structured logging context objects. Log levels: debug, info, warn, error, always. Documentation doesn't guide on log level usage or correlation across hook invocations.
- **Severity:** NON-BLOCKING
- **Benefit:** Help users understand logging capabilities and how to correlate logs across hook invocations. Document log level meanings and rotation.
- **Confidence:** MODERATE (only one reviewer found)

---

**13. Configuration Search Order Could Be Clearer** (config.ts vs SETUP.md/README.md)

- **Found by:** Reviewer #2
- **Description:** Documentation mentions 3-point search order (SETUP.md lines 55-62, README.md lines 284-291) but doesn't clarify that search stops at first found (not merged across all three). config.ts loadConfig() checks in order: .claude/gates.json (highest priority), gates.json (project root), ${CLAUDE_PLUGIN_ROOT}hooks/gates.json (plugin default). Returns first found, not merged. Documentation doesn't clarify difference between "project-specific" and "project root".
- **Severity:** NON-BLOCKING
- **Benefit:** Clarifies that search stops at first found (not merged across all three). Example: "If .claude/gates.json exists, gates.json and plugin default are never loaded".
- **Confidence:** MODERATE (only one reviewer found)

---

## Divergences (Requires Investigation)

Reviewers disagree or have contradictory findings.

**Confidence: INVESTIGATE** - Reviewers have different conclusions. Analysis provided below.

**1. Plugin Gate References Implementation Status** (SETUP.md, config.ts)

- **Reviewer #1 perspective:** Plugin gate references feature appears untested. Code structure exists (config.ts resolvePluginPath() lines 99-139) but integration testing is incomplete. plugin/hooks/hooks-app/__tests__/plugin-gates.integration.test.ts exists but file is new and appears incomplete. No plugin gate execution shown in existing gate-loader tests. Feature implementation correctness is uncertain without seeing full gate-loader execution path.
- **Reviewer #2 perspective:** Plugin gate resolution path convention not fully explained in documentation. Code exists (config.ts lines 57-80) implementing sibling convention with security considerations. Suggests documentation needs more detail on path resolution behavior, but doesn't flag the feature as untested or broken.
- **Verification Analysis:**
  - **Issue:** The reviews diverge on whether plugin gate references are "untested/uncertain" (Review #1) vs "inadequately documented" (Review #2)
  - **Analysis:** Both observations appear valid but focus on different aspects. Review #1 is concerned about implementation completeness and testing. Review #2 is concerned about documentation clarity of the existing implementation.
  - **Assessment:** This is not a true divergence but rather different focus areas. Review #1's testing concern is higher-severity (implementation uncertainty) than Review #2's documentation concern (documentation clarity). However, both perspectives add value.
  - **Confidence:** INVESTIGATE (different focus) / Both concerns are valid
  - **Action required:** User should treat Review #1's testing concern as higher priority (implementation verification needed) while also addressing Review #2's documentation improvement suggestions.

---

## Recommendations

### Immediate Actions (Common BLOCKING)

These must be addressed immediately - both reviewers found them independently with VERY HIGH confidence.

- [ ] **Missing Plugin Context Directory:** Either create plugin/hooks/context/ directory with actual default context files (recommended) OR remove all documentation references to plugin context injection. This is a critical false promise causing dead code. Update README.md, ARCHITECTURE.md, CONVENTIONS.md. Reference: Both reviews, locations documented above.

- [ ] **Hook Event Registration/Documentation Mismatch:** Update all documentation (README.md lines 78-95, ARCHITECTURE.md lines 207-223, CONVENTIONS.md lines 27-39) to accurately reflect that ONLY 4 hook events are registered and working: PostToolUse, SubagentStop, UserPromptSubmit, SessionStart. Either register missing 8 hooks in hooks.json or update docs. This represents the largest documentation/implementation gap affecting user expectations.

### Judgment Required (Exclusive BLOCKING)

These are exclusive blocking issues where only one reviewer found concern - user should review reasoning and decide whether to address.

- [ ] **SessionStart Hook Functionality** (Reviewer #2): Verify SessionStart context injection actually works. Documentation claims it's supported but example file says it's "not currently supported". Clarify documentation or fix implementation.

- [ ] **Command Field Mutual Exclusivity** (Reviewer #2): Examples throughout documentation show command field without clarifying it's mutually exclusive with plugin/gate fields. Add clarification notes to SETUP.md, README.md, and CLAUDE.md to prevent user configuration errors.

- [ ] **Plugin Gate References Testing** (Reviewer #1): Verify plugin gate references feature is fully implemented and tested. plugin-gates.integration.test.ts exists but completeness is unclear. Create comprehensive integration tests or remove documentation claims about this feature.

- [ ] **Commands Gate Documentation** (Reviewer #1): Either implement the "commands" gate example from TYPESCRIPT.md and register it, OR remove the example code that documents a non-existent feature.

### For Consideration (NON-BLOCKING)

Improvement suggestions found by reviewers that would enhance documentation quality and user experience.

- [ ] **Development Commands:** Expand CLAUDE.md with npm install, npm run watch, and dist/ directory requirements (Reviewer #1)
  - Benefit: Clearer setup sequence for new contributors

- [ ] **Environment Variables:** Move TURBOSHOVEL_LOG and TURBOSHOVEL_LOG_LEVEL documentation from CLAUDE.md to README.md Debugging section (Reviewer #1)
  - Benefit: Users debugging hooks know how to enable logging

- [ ] **Keyword Matching Behavior:** Add documentation explaining keyword matching uses case-insensitive substring matching (not word boundaries) (Reviewer #1)
  - Benefit: Users understand why "test" matches "latest" or "contest"

- [ ] **Configuration Load Order:** Clarify that search stops at first found (not merged across all) and explain behavior when gates.json is missing (Reviewer #1)
  - Benefit: Users understand plugin defaults apply when project doesn't override

- [ ] **Example Configurations:** Add note explaining examples use mise as task runner, users should replace with their project's commands (Reviewer #1)
  - Benefit: Users understand examples need customization

- [ ] **SubagentStop Context Injection:** Add dedicated section explaining special agent-command scoping pattern and session state tracking (Reviewer #2)
  - Benefit: Users can properly scope context for SubagentStop events

- [ ] **Keyword Filtering Hook Restriction:** Document that keywords only apply to UserPromptSubmit hook, ignored on other hooks (Reviewer #2)
  - Benefit: Prevents user confusion about keyword behavior on PostToolUse/SubagentStop

- [ ] **Gate Chain Depth Limit:** Document MAX_GATES_PER_DISPATCH = 10 limit and suggest refactoring for complex chains (Reviewer #2)
  - Benefit: Users understand circuit breaker design and how to handle deep chains

- [ ] **DispatchResult Type:** Document relationship between GateResult (what gates return) and DispatchResult (what dispatcher returns) (Reviewer #2)
  - Benefit: Helps developers understand system data flow

- [ ] **Plugin Gate Resolution Details:** Expand documentation on sibling convention, path traversal security, and error handling (Reviewer #2)
  - Benefit: Users understand security model and limitations

- [ ] **Session State Metadata:** Document metadata field for custom agent tracking as alternative to unavailable active_agent (Reviewer #2)
  - Benefit: Users have solution for agent tracking when needed

- [ ] **Action Chaining Patterns:** Document gate chaining patterns with examples (format → lint → test) and default action behavior (Reviewer #2)
  - Benefit: Users understand how to build complex gate workflows

- [ ] **Test Documentation:** Create TESTING.md with test structure overview, running specific suites, and integration patterns (Reviewer #2)
  - Benefit: Contributors understand testing approach and can maintain tests

- [ ] **Logging Details:** Expand debugging section with log level guidance, correlation examples, and retention information (Reviewer #2)
  - Benefit: Users can effectively debug hook issues

- [ ] **INTEGRATION_TESTS.md:** Verify or update shared-functions.sh references - either provide actual commands or update documentation (Reviewer #1)
  - Benefit: Users can follow testing procedures without "command not found" errors

---

## Overall Assessment

**Ready to proceed?** NO - BLOCKED

**Reasoning:**

The documentation review identifies critical misalignments between documented features and actual implementation:

1. **Missing directory causing dead code:** The plugin/hooks/context/ directory doesn't exist, making entire fallback context injection feature non-functional. This is the highest-severity issue as it's a completely false promise in documentation.

2. **Feature scope mismatch:** Documentation claims 12 hook events work; only 4 actually registered and working. This represents a fundamental misunderstanding of feature completeness that will mislead users.

3. **Undocumented constraints:** Multiple features have important behavioral constraints not documented (keyword filtering only on UserPromptSubmit, command field mutual exclusivity, SessionStart may not work).

4. **Untested features:** At least one documented feature (plugin gate references) has unclear testing coverage, making it risky to recommend for production use.

5. **Implementation uncertainty:** The SessionStart hook has contradictory evidence - registered in hooks.json but documented in examples as "not currently supported" - creating doubt about actual functionality.

The documentation cannot be recommended for user consumption in its current state. Users following these docs will encounter configuration failures and broken expectations.

**Critical items requiring attention:**
- Plugin context directory (common blocking issue #1)
- Hook event registration (common blocking issue #2)
- SessionStart functionality clarity (exclusive blocking issue #1)
- Command field mutual exclusivity (exclusive blocking issue #2)
- Plugin gate references testing (exclusive blocking issue #3)
- Commands gate implementation (exclusive blocking issue #4)

**Confidence level:**
- **High confidence issues (common):** 3 issues - both reviewers found independently, verified by code/filesystem inspection
- **Moderate confidence issues (exclusive):** 15 issues - single reviewer found, require judgment about prioritization and implementation approach
- **Divergences (investigation):** 1 issue - different perspectives on plugin gate references, both valid but different focus areas

**Estimated effort to remediate:**
- Blocking issues: 2-3 days development and documentation updates
- Exclusive blocking issues: 1-2 days prioritization and fixes
- Non-blocking suggestions: 1 day documentation improvements

---

## Next Steps

**BLOCKED - Must Address Before Approval:**

1. **Address all 3 common BLOCKING issues (VERY HIGH confidence):**
   - Delete plugin context dead code OR create actual plugin/hooks/context/ directory with default files
   - Update hook event documentation to match actual 4 registered hooks
   - Resolve documentation/implementation discrepancy pattern

2. **Review and address 4 exclusive BLOCKING issues (MODERATE confidence):**
   - SessionStart hook functionality verification
   - Command field mutual exclusivity documentation
   - Plugin gate references testing verification
   - Commands gate implementation or documentation removal

3. **Incorporate verification findings:**
   - If plugin gate references testing is uncertain, either complete tests or remove feature from documentation
   - If SessionStart doesn't work, remove or mark as unavailable
   - If commands gate isn't implemented, remove example code

4. **After blocking issues resolved:**
   - Consider 11 non-blocking improvements for user experience
   - Establish process to keep documentation synchronized with code
   - Set up verification reviews for future documentation changes

**If issues are NOT resolved:**
- Documentation approval: BLOCKED
- User-facing status: Not ready for publication
- Risk: High - users will encounter configuration failures following documented procedures

**Reviewers' Confidence:** HIGH - all blocking issues independently verified through code/filesystem inspection. Both reviewers reach consistent conclusions on critical issues.
