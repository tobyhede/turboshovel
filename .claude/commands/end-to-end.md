---
description: Run turboshovel end-to-end test
argument-hint: [plan-file]
---

# End-to-End Test

Run turboshovel's own end-to-end test plan.

## Usage

```
/end-to-end [plan-file]
```

- `$1` - plan file path (default: `docs/plans/e2e-test.md`)

<instructions>
## Instructions

## MANDATORY: Skill Activation

Use and follow the executing-plans skill exactly as written.

Path: `${CLAUDE_PLUGIN_ROOT}skills/executing-plans/SKILL.md`
Tool: `Skill(skill: "turboshovel:executing-plans")`

Do NOT proceed without completing skill activation.
</instructions>

ARGUMENTS: $ARGUMENTS
