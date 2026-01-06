---
description: Execute implementation plans in batches with specialised agents
argument-hint: [plan-file]
---

# Test: End-to-End

Execute implementation plans with workflow orchestration.

## Usage

```
/turboshovel:test-end-to-end [plan-file]
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
