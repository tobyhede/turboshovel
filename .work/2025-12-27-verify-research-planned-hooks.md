# Research Findings - Planned Hooks for Turboshovel

## Metadata
- Date: 2025-12-27 11:30:00
- Topic: Planned hooks turboshovel could implement with session context capabilities
- Angles Explored:
  1. Documentation analysis (planned vs registered hooks)
  2. Code implementation analysis (session state, context injection)
  3. Claude Code hook system capabilities
  4. Feasibility and implementation requirements

## Findings

### Category 1: Currently Registered Hooks (11 total)

**Finding:** Turboshovel registers 11 hooks in `plugin/hooks.json`
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/hooks.json` lines 1-81
- Confidence: HIGH
- Evidence: hooks.json explicitly registers: SessionStart, SessionEnd, UserPromptSubmit, SubagentStart, SubagentStop, PreToolUse, PostToolUse, Stop, Notification, PreCompact, PermissionRequest

**Finding:** Context injection is implemented for 8 of 11 registered hooks
- Source: `/Users/tobyhede/psrc/turboshovel/README.md` lines 104-117
- Confidence: HIGH
- Evidence: Table shows context injection supported for SessionStart, SessionEnd, UserPromptSubmit, SubagentStop, PreToolUse, PostToolUse, Stop, Notification. NOT implemented for SubagentStart, PreCompact, PermissionRequest (gates work but context files not discovered).

### Category 2: Planned Hooks (Not Yet Registered)

**Finding:** Four hooks are documented as "planned" but not registered in hooks.json
- Source: `/Users/tobyhede/psrc/turboshovel/CONVENTIONS.md` line 44
- Confidence: HIGH
- Evidence: "**Planned hooks:** SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd - recognized by config validation but not yet registered in `hooks.json` for Claude Code routing. Context patterns exist for future use."

**Finding:** These planned hooks ARE included in KNOWN_HOOK_EVENTS for config validation
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/core/src/config.ts` lines 14-17
- Confidence: HIGH
- Evidence:
```typescript
const KNOWN_HOOK_EVENTS = [
  // ...
  'SlashCommandStart',
  'SlashCommandEnd',
  'SkillStart',
  'SkillEnd',
  // ...
];
```

**Finding:** Dispatcher already has session state update logic for planned hooks
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/core/src/dispatcher.ts` lines 156-175
- Confidence: HIGH
- Evidence:
```typescript
case 'SlashCommandStart':
  if (input.command) {
    await session.set('active_command', input.command);
  }
  break;
case 'SlashCommandEnd':
  await session.set('active_command', null);
  break;
case 'SkillStart':
  if (input.skill) {
    await session.set('active_skill', input.skill);
  }
  break;
case 'SkillEnd':
  await session.set('active_skill', null);
  break;
```

**Finding:** Context injection already handles planned hooks in extractNameAndStage()
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/core/src/context.ts` lines 187-201
- Confidence: HIGH
- Evidence:
```typescript
case 'SlashCommandStart':
  return input.command ? { name: input.command.replace(/^\//, '').replace(/^[^:]+:/, ''), stage: 'start' } : null;
case 'SlashCommandEnd':
  return input.command ? { name: input.command.replace(/^\//, '').replace(/^[^:]+:/, ''), stage: 'end' } : null;
case 'SkillStart':
  return input.skill ? { name: input.skill.replace(/^[^:]+:/, ''), stage: 'start' } : null;
case 'SkillEnd':
  return input.skill ? { name: input.skill.replace(/^[^:]+:/, ''), stage: 'end' } : null;
```

**Finding:** Integration tests exist for planned hooks
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/core/__tests__/integration.test.ts` lines 75-129
- Confidence: HIGH
- Evidence: Tests verify SlashCommandStart/End updates active_command, SkillStart/End updates active_skill

### Category 3: Session Context Capabilities

**Finding:** Session state tracks active command and skill
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/core/src/types.ts` lines 71-92
- Confidence: HIGH
- Evidence:
```typescript
interface SessionState {
  session_id: string;
  started_at: string;
  active_command: string | null;   // Currently active slash command
  active_skill: string | null;     // Currently active skill
  edited_files: string[];
  file_extensions: string[];
  metadata: Record<string, unknown>;
}
```

**Finding:** Session state enables SubagentStop to use agent-command scoping
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/core/src/context.ts` lines 246-268
- Confidence: HIGH
- Evidence: SubagentStop context injection uses session.get('active_command') and session.get('active_skill') to enable agent-command context file discovery patterns like `{agent}-{command}-end.md`

**Finding:** Session state persists in `.claude/session/state.json`
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/core/src/session.ts` lines 16-18
- Confidence: HIGH
- Evidence: `this.stateFile = join(cwd, '.claude', 'session', 'state.json');`

### Category 4: Hooks with Incomplete Context Injection

**Finding:** SubagentStart has gates but no context injection
- Source: `/Users/tobyhede/psrc/turboshovel/README.md` line 109
- Confidence: HIGH
- Evidence: "SubagentStart | `{agent}-start.md` | NOT implemented | Gates only"

**Finding:** PreCompact has gates but no context injection
- Source: `/Users/tobyhede/psrc/turboshovel/README.md` line 115
- Confidence: HIGH
- Evidence: "PreCompact | `pre-compact.md` | NOT implemented | Gates only"

**Finding:** PermissionRequest has gates but no context injection
- Source: `/Users/tobyhede/psrc/turboshovel/README.md` line 116
- Confidence: HIGH
- Evidence: "PermissionRequest | `permission-request.md` | NOT implemented | Gates only"

### Category 5: HookInput Schema for Planned Hooks

**Finding:** HookInputSchema already supports command and skill fields
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/core/src/schemas.ts` lines 37-38
- Confidence: HIGH
- Evidence:
```typescript
// SlashCommand/Skill
command: z.string().optional(),
skill: z.string().optional()
```

## Implementation Requirements Assessment

### Planned Hook: SlashCommandStart

| Requirement | Status | Notes |
|-------------|--------|-------|
| hooks.json registration | MISSING | Add to `plugin/hooks.json` |
| Session state update | IMPLEMENTED | dispatcher.ts lines 156-160 |
| Context injection | IMPLEMENTED | context.ts lines 187-190 |
| HookInput schema | IMPLEMENTED | schemas.ts line 37 |
| Tests | IMPLEMENTED | integration.test.ts lines 75-88 |

**Implementation effort:** MINIMAL - just add to hooks.json

### Planned Hook: SlashCommandEnd

| Requirement | Status | Notes |
|-------------|--------|-------|
| hooks.json registration | MISSING | Add to `plugin/hooks.json` |
| Session state update | IMPLEMENTED | dispatcher.ts lines 162-164 |
| Context injection | IMPLEMENTED | context.ts lines 192-194 |
| HookInput schema | IMPLEMENTED | schemas.ts line 37 |
| Tests | IMPLEMENTED | integration.test.ts lines 89-100 |

**Implementation effort:** MINIMAL - just add to hooks.json

### Planned Hook: SkillStart

| Requirement | Status | Notes |
|-------------|--------|-------|
| hooks.json registration | MISSING | Add to `plugin/hooks.json` |
| Session state update | IMPLEMENTED | dispatcher.ts lines 166-170 |
| Context injection | IMPLEMENTED | context.ts lines 197-198 |
| HookInput schema | IMPLEMENTED | schemas.ts line 38 |
| Tests | IMPLEMENTED | integration.test.ts lines 103-116 |

**Implementation effort:** MINIMAL - just add to hooks.json

### Planned Hook: SkillEnd

| Requirement | Status | Notes |
|-------------|--------|-------|
| hooks.json registration | MISSING | Add to `plugin/hooks.json` |
| Session state update | IMPLEMENTED | dispatcher.ts lines 172-174 |
| Context injection | IMPLEMENTED | context.ts lines 200-201 |
| HookInput schema | IMPLEMENTED | schemas.ts line 38 |
| Tests | IMPLEMENTED | integration.test.ts lines 117-128 |

**Implementation effort:** MINIMAL - just add to hooks.json

### Incomplete Hook: SubagentStart (context injection)

| Requirement | Status | Notes |
|-------------|--------|-------|
| hooks.json registration | IMPLEMENTED | Already registered |
| Session state update | N/A | Note in code: agent tracking not reliable |
| Context injection | MISSING | Not in extractNameAndStage() |
| Workflow integration | IMPLEMENTED | handleSubagentStart() exists |

**Implementation effort:** MEDIUM - need to add context file discovery for `{agent}-start.md`

### Incomplete Hook: PreCompact (context injection)

| Requirement | Status | Notes |
|-------------|--------|-------|
| hooks.json registration | IMPLEMENTED | Already registered |
| Context injection | MISSING | Not in extractNameAndStage() |

**Implementation effort:** LOW - add case to extractNameAndStage() returning `{ name: 'pre', stage: 'compact' }` or similar

### Incomplete Hook: PermissionRequest (context injection)

| Requirement | Status | Notes |
|-------------|--------|-------|
| hooks.json registration | IMPLEMENTED | Already registered |
| Context injection | MISSING | Not in extractNameAndStage() |

**Implementation effort:** LOW - add case to extractNameAndStage() returning `{ name: 'permission', stage: 'request' }`

## How Session Context Enables These Hooks

**Finding:** Session context enables command/skill scoped context injection
- Source: `/Users/tobyhede/psrc/turboshovel/plugin/core/src/context.ts` lines 246-268
- Confidence: HIGH
- Evidence: The SubagentStop handler already uses `session.get('active_command')` and `session.get('active_skill')` to enable context file patterns like `{agent}-{command}-end.md`. This same pattern could be used by other hooks.

**Key capability:** Once SlashCommandStart/SkillStart are registered, they will set `active_command`/`active_skill` in session state. This enables:
1. SubagentStop to know which command/skill triggered the agent
2. Other hooks to apply command/skill-specific context
3. Gates to filter based on active command/skill

## Gaps and Unanswered Questions

### Gap 1: Claude Code Hook Event Availability
- **Question:** Does Claude Code actually fire SlashCommandStart, SlashCommandEnd, SkillStart, SkillEnd events?
- **Status:** UNCERTAIN - documentation refers to these as "planned" but implementation code is ready
- **Impact:** If Claude Code doesn't fire these events, registering them would have no effect

### Gap 2: Why Are Planned Hooks Not Registered?
- **Question:** Why are 4 hooks implemented in code but not registered in hooks.json?
- **Status:** UNKNOWN - no explicit explanation found in documentation
- **Possible reasons:**
  - Waiting for Claude Code to support these events
  - Intentionally disabled pending testing
  - Oversight

### Gap 3: SubagentStart Context Injection Complexity
- **Question:** What context file pattern should SubagentStart use?
- **Status:** The `{agent}-start.md` pattern exists in documentation but no implementation
- **Complication:** Unlike SubagentStop which has session context for command/skill, SubagentStart may not have this context available yet

## Summary

### Planned Hooks Ready for Registration (MINIMAL effort)
1. **SlashCommandStart** - All implementation exists, just needs hooks.json entry
2. **SlashCommandEnd** - All implementation exists, just needs hooks.json entry
3. **SkillStart** - All implementation exists, just needs hooks.json entry
4. **SkillEnd** - All implementation exists, just needs hooks.json entry

### Registered Hooks Needing Context Injection (LOW-MEDIUM effort)
1. **SubagentStart** - Context injection not implemented (MEDIUM - needs agent context pattern)
2. **PreCompact** - Context injection not implemented (LOW - add extractNameAndStage case)
3. **PermissionRequest** - Context injection not implemented (LOW - add extractNameAndStage case)

### Session Context Value
The session tracking in `session.ts` is critical for:
- Tracking `active_command` set by SlashCommandStart
- Tracking `active_skill` set by SkillStart
- Enabling agent-command context scoping in SubagentStop
- Tracking `edited_files` and `file_extensions` for PostToolUse filtering

Without SlashCommandStart/SkillStart hooks registered, the session state for active_command/active_skill never gets set, reducing the effectiveness of the agent-command scoping feature.

STATUS: COMPLETE
