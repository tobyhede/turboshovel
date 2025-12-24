# Research Report: SessionStart Hook Support Investigation

## Metadata
- Date: 2025-11-28
- Researcher: research-agent
- Scope: Deep investigation of SessionStart hook support in Claude Code via Turboshovel plugin

## Research Questions
1. Is SessionStart properly registered in the plugin configuration?
2. Would the code handle SessionStart correctly if Claude Code triggered it?
3. What evidence exists about SessionStart actually firing?
4. Why does documentation claim "not currently supported" despite full implementation?
5. What is the recommended action regarding SessionStart?

## Key Findings

### Finding 1: SessionStart is Fully Registered in Plugin Configuration
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks.json` (lines 3-9)
- **Evidence:**
```json
"SessionStart": [{
  "matcher": ".*",
  "hooks": [{
    "type": "command",
    "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js"
  }]
}]
```
- **Confidence:** HIGH
- **Implication:** The plugin is correctly configured to receive SessionStart hooks if Claude Code sends them

### Finding 2: SessionStart is Recognized as a Known Hook Event
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/config.ts` (lines 8-21)
- **Evidence:**
```typescript
const KNOWN_HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'SubagentStop',
  'UserPromptSubmit',
  'SlashCommandStart',
  'SlashCommandEnd',
  'SkillStart',
  'SkillEnd',
  'SessionStart',  // ← Line 17
  'SessionEnd',
  'Stop',
  'Notification'
];
```
- **Confidence:** HIGH
- **Implication:** The config validation explicitly allows SessionStart - it won't be rejected as unknown

### Finding 3: Context Injection Handles SessionStart
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/context.ts` (lines 167-216)
- **Evidence:**
```typescript
function extractNameAndStage(hookEvent: string, input: HookInput): { name: string; stage: string } | null {
  switch (hookEvent) {
    // ... other cases ...
    case 'SessionStart':
      return { name: 'session', stage: 'start' };
    // ...
  }
}
```
- **Confidence:** HIGH
- **Implication:** If SessionStart fires, the code will:
  1. Map it to context file pattern `session-start.md`
  2. Search for `.claude/context/session-start.md` (project)
  3. Fallback to `${CLAUDE_PLUGIN_ROOT}/context/session-start.md` (plugin)
  4. Inject the content as additional context

### Finding 4: Production Context File Exists
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/context/session-start.md` (lines 1-42)
- **Evidence:** File exists at plugin level with Turboshovel-specific environment context
- **Confidence:** HIGH
- **Implication:** Plugin provides default session-start context that would be injected if hook fires

### Finding 5: Example File Claims "Not Currently Supported"
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/context/session-start.md` (line 37)
- **Evidence:**
```markdown
**Note:** SessionStart is not currently a supported hook in Claude Code. This file serves as a
template for injecting environment context via other hooks (e.g., UserPromptSubmit, SlashCommandStart).
```
- **Confidence:** HIGH (that this is what the file says)
- **Implication:** This creates confusion - the claim is in an EXAMPLE file, not in the production context file

### Finding 6: Documentation Says "May Have Limited Support"
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/README.md` (line 97)
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/CONVENTIONS.md` (line 43)
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/ARCHITECTURE.md` (line 231)
- **Evidence:**
```markdown
**Note:** SessionStart may have limited support in Claude Code. The context file will be
injected if the hook is triggered.
```
- **Confidence:** HIGH
- **Implication:** Documentation uses hedging language ("may have") rather than definitive statements

### Finding 7: SessionStart Registration Added in Recent Commit
- **Source:** Git commit `1d59979fc81df52c14ae6b76792dae90b159f36b` (2025-11-28)
- **Evidence:** Commit message states "fix(hooks): register 8 missing hook types in hooks.json"
- **Confidence:** HIGH
- **Implication:** SessionStart was previously in KNOWN_HOOK_EVENTS but wasn't registered in hooks.json until today. This was a bug fix, not a feature addition.

### Finding 8: "Not Supported" Note Existed From Initial Extraction
- **Source:** Git history, initial commit `ee68b78`
- **Evidence:** The "not currently a supported hook" note was present in the example file when Turboshovel was extracted from cipherpowers
- **Confidence:** HIGH
- **Implication:** The "not supported" claim was inherited from cipherpowers and reflects historical knowledge, possibly outdated

### Finding 9: SessionStart Used in Test Fixtures
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/builtin-gates.test.ts` (line 13)
- **Evidence:**
```typescript
const input: HookInput = {
  hook_event_name: 'SessionStart',
  cwd: '/test'
};
```
- **Confidence:** MEDIUM
- **Implication:** Test uses SessionStart as a valid hook event, suggesting it's expected to work

### Finding 10: No Integration Tests Verify SessionStart Actually Fires
- **Source:** `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/integration.test.ts`
- **Evidence:** Tests verify PostToolUse, SlashCommandStart/End session tracking, but no test simulates SessionStart from Claude Code
- **Confidence:** HIGH
- **Implication:** Tests assume SessionStart would work if triggered, but don't prove Claude Code actually fires it

## Patterns Observed

### Pattern 1: Full Implementation Ready, Uncertain About Claude Code Behavior
The plugin has complete support for SessionStart:
- Registered in hooks.json ✓
- Listed in KNOWN_HOOK_EVENTS ✓
- Handled in context extraction ✓
- Production context file exists ✓
- Would inject context if triggered ✓

But documentation hedges about whether Claude Code actually fires the hook.

### Pattern 2: Inconsistent Documentation
Three different levels of certainty:
1. Example file: "not currently a supported hook" (definitive negative)
2. Main docs: "may have limited support" (hedged uncertainty)
3. Code comments: No warnings or special handling

### Pattern 3: Historical Knowledge vs. Current Reality
The "not supported" claim originated from cipherpowers extraction. It may reflect:
- Historical limitation in an older Claude Code version
- Incomplete testing of SessionStart
- Conservative documentation to avoid promising unverified behavior

## Gaps and Uncertainties

### Gap 1: No Direct Evidence of SessionStart Firing
**What we couldn't verify:**
- Whether Claude Code currently fires SessionStart hooks in production
- Under what conditions SessionStart would fire (new chat? new session? restart?)
- Any Claude Code changelog or documentation about SessionStart support

**Why this matters:**
Without proof that Claude Code fires the hook, we can't confirm it works end-to-end.

### Gap 2: No Logs Showing SessionStart Activity
**What we couldn't find:**
- Log files showing SessionStart hook invocations
- User reports of SessionStart context injection working
- Developer notes about testing SessionStart behavior

**Why this matters:**
Logs would provide concrete evidence of the hook firing in real usage.

### Gap 3: Definition of "Limited Support"
**What remains unclear:**
- What "limited support" means specifically
- Whether it means:
  - Hook fires inconsistently?
  - Hook fires but with incomplete data?
  - Hook is experimental/undocumented in Claude Code?
  - Hook only fires in certain Claude Code versions?

**Why this matters:**
The ambiguity makes it hard to set user expectations.

### Gap 4: Claude Code Official Hook Documentation
**What we don't have:**
- Official Claude Code documentation listing supported hooks
- Claude Code API/plugin specification
- Anthropic's stance on SessionStart support

**Why this matters:**
The ultimate source of truth would be Claude Code's own documentation.

### Gap 5: Original Reason for "Not Supported" Claim
**What we couldn't determine:**
- Did someone test SessionStart and find it didn't fire?
- Was it based on reading Claude Code docs?
- Was it an assumption or precaution?
- Has Claude Code support changed since the claim was made?

**Why this matters:**
Understanding the original reasoning would clarify if it's still valid.

## Root Cause of Discrepancy

### Primary Cause: Conservative Documentation Based on Incomplete Knowledge

**Analysis:**
The discrepancy exists because:

1. **Plugin implements SessionStart optimistically** - "If Claude Code fires it, we'll handle it"
2. **Documentation is conservative** - "We're not sure Claude Code actually fires it"
3. **Example file is most conservative** - "It doesn't work, use alternatives"

**Evidence chain:**
- Code was extracted from cipherpowers with "not supported" note intact (ee68b78)
- Recent bug fix added SessionStart registration (1d59979, today)
- No one has definitively verified whether Claude Code fires SessionStart
- Documentation uses hedging language to avoid false promises

**Why it persists:**
- Testing would require observing actual Claude Code behavior
- SessionStart is edge case (fires once per session, hard to test)
- Conservative approach: implement support but don't promise it works

### Secondary Cause: Hooks.json Registration Was Missing Until Today

**Analysis:**
Before commit 1d59979 (today), SessionStart was:
- In KNOWN_HOOK_EVENTS (would be accepted)
- In context.ts extractNameAndStage (would be handled)
- **NOT in plugin/hooks.json** (wouldn't be registered!)

This means SessionStart **couldn't have worked** until today's bug fix, which supports the "not currently supported" claim being accurate historically.

**Implication:**
The claim may have been accurate when written, but is potentially outdated now that registration is fixed.

## Summary

**SessionStart is now fully implemented** in Turboshovel:
- Registered in hooks.json (as of today)
- Validated as known hook event
- Context injection ready
- Production context file exists

**However, we cannot confirm Claude Code fires it** because:
- No direct evidence of SessionStart firing in production
- No logs showing SessionStart activity
- Documentation hedges with "may have limited support"
- Example file claims "not currently supported"

**The discrepancy likely exists because:**
- Implementation is optimistic ("ready if Claude Code fires it")
- Documentation is conservative ("we're not sure it actually fires")
- Hooks.json registration was missing until today's bug fix
- Original "not supported" claim may be outdated but hasn't been verified

## Recommendations

### Recommendation 1: Test Whether SessionStart Actually Fires
**Action:** Empirical testing to resolve uncertainty

**Test procedure:**
1. Install Turboshovel plugin
2. Enable detailed logging (TURBOSHOVEL_LOG_LEVEL=debug)
3. Create `.claude/context/session-start.md` with distinctive content
4. Start a new Claude Code session
5. Check for:
   - Log entry showing SessionStart hook dispatch
   - Injected context appearing in conversation
   - Hook input JSON in logs

**Expected outcomes:**
- If logs show SessionStart dispatch → It works, update docs to remove hedging
- If no logs → It doesn't fire, keep conservative documentation
- If inconsistent → Document as "experimental" or "version-dependent"

### Recommendation 2: Update Documentation Based on Test Results

**If SessionStart works:**
- Remove "not currently supported" from example file
- Change "may have limited support" to "supported"
- Add example of session-start.md usage to README

**If SessionStart doesn't work:**
- Keep "not currently supported" in example
- Add explanation of why registration exists (future-proofing)
- Document alternative approaches (UserPromptSubmit for session context)

**If SessionStart works inconsistently:**
- Document known conditions where it works/doesn't
- Label as "experimental" or "version-dependent"
- Provide workarounds for when it doesn't fire

### Recommendation 3: Add Integration Test for SessionStart
**Action:** Create test that simulates SessionStart hook

```typescript
test('SessionStart injects session context', async () => {
  // Setup context file
  const contextDir = path.join(testDir, '.claude', 'context');
  await fs.mkdir(contextDir, { recursive: true });
  await fs.writeFile(
    path.join(contextDir, 'session-start.md'),
    '# Session Context\nTest content'
  );

  // Simulate SessionStart hook
  const hookInput = JSON.stringify({
    hook_event_name: 'SessionStart',
    cwd: testDir
  });

  const { stdout } = await execAsync(`echo '${hookInput}' | node ${cliPath}`);
  const output = JSON.parse(stdout);

  expect(output.additionalContext).toContain('Test content');
});
```

**Rationale:** Tests verify the plugin's handling, even if we can't verify Claude Code's behavior.

### Recommendation 4: Align Example and Production Files
**Issue:** Confusing to have:
- Example file saying "not supported"
- Production file existing and working

**Options:**

**Option A: Keep both, clarify purpose**
- Example file: Template with warning that support is unverified
- Production file: Default that injects if hook fires

**Option B: Remove production file until verified**
- Only keep example file with warning
- Add production file after confirming it works

**Option C: Remove example file warning**
- If testing confirms it works
- Example becomes a working template, not a cautionary one

**Recommendation:** Choose Option A as safest approach - keep both but clarify that production file is optimistic implementation.

### Recommendation 5: Document the Uncertainty Honestly
**Action:** Add troubleshooting section to SETUP.md or CONVENTIONS.md

```markdown
### SessionStart Hook Status

**Implementation:** Fully implemented in Turboshovel
**Claude Code Support:** Unverified - may or may not fire depending on Claude Code version

If SessionStart context isn't injecting:
1. Check logs: `mise run hooks:log-tail` for SessionStart dispatch
2. If no SessionStart in logs, Claude Code isn't firing the hook
3. Workaround: Use UserPromptSubmit hook for session-level context

We welcome user reports about SessionStart behavior in different environments.
```

**Rationale:** Honest uncertainty is better than false confidence or unverified claims.

### Recommendation 6: Query Claude Code for Official Hook Support
**Action:** If possible, check:
- Claude Code plugin API documentation
- Hook specification
- Supported hook events list

**Rationale:** The authoritative answer should come from Claude Code itself, not plugin implementation assumptions.

---

## Conclusion

SessionStart is **fully implemented and ready** in Turboshovel, but whether it **actually works** depends on whether Claude Code fires the hook - which remains unverified. The safest recommendation is **empirical testing** to resolve the uncertainty definitively.
