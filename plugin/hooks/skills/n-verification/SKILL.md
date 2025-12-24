---
name: n-verification
description: Dispatch N independent review agents, collate by consensus ratio, cross-check exclusive findings
---

# N-Verification Skill

## Overview

Dispatch N agents to independently review the same subject. Collate findings:
- **Common (N/N):** All agents found → act immediately
- **Exclusive (<N/N):** Some agents found → cross-check validates

## Agent Count Heuristics

| Scope | Default N | Rationale |
|-------|-----------|-----------|
| Single file change | 2 | Focused review, two perspectives sufficient |
| Multi-file feature | 2-3 | More surface area benefits from diversity |
| Architecture change | 3 | Different perspectives valuable |
| Security-sensitive | 3+ | Higher stakes warrant more eyes |

**Override via args:** `--count 3` or `--agents "Explore,Plan,code-agent"`

## Agent Selection

1. **Explicit args:** If user provides `--agents`, use those
2. **Available plugins:** Check for specialized agents (cipherpowers code-review-agent, etc.)
3. **Built-in agents:** Use Claude's Explore, Plan agents with review prompts
4. **Fallback:** N instances of same agent with different perspective prompts

## Process

**Announce:** "I'm using the n-verification skill to verify [subject]."

### Phase 1: Dispatch

1. Determine N (default 2, or from args)
2. Select agents (from args, plugins, or built-ins)
3. Start workflow: `workflow start ${CLAUDE_PLUGIN_ROOT}workflows/verify.workflow.md`
4. For each agent 1..N:
   - Queue task: `workflow start --task N.{i}`
   - Dispatch agent with review prompt
   - Agent writes findings to `.work/{date}-verify-{i}-{timestamp}.md`

### Phase 2: Collate

After all agents complete, dispatch collation:
- Read all N review files
- Compare findings across agents
- Categorize by consensus:
  - **Common (N/N):** All agents found this issue
  - **Exclusive:** Subcategorize by ratio (e.g., 2/3, 1/3)
- Write collation to `.work/{date}-verify-collated-{timestamp}.md`

**Present immediately:**
```
Collation complete.

## Common (N/N)
[Issues all agents found - can implement now]

## Exclusive
### (N-1)/N
[Issues most agents found]
### 1/N
[Issues one agent found]

Cross-check starting for exclusive findings...
```

### Phase 3: Cross-Check

Dispatch cross-check agent to validate ALL exclusive findings:
- For each exclusive issue, verify against ground truth
- Mark as: VALIDATED | INVALIDATED | UNCERTAIN
- Write to `.work/{date}-verify-crosscheck-{timestamp}.md`

**Present when complete:**
```
Cross-check complete.

VALIDATED: X issues (should address)
INVALIDATED: X issues (can skip)
UNCERTAIN: X issues (user decides)
```

### Phase 4: Complete

```bash
workflow complete
```

## Output Files

All files saved to `.work/` with timestamp-based naming:
- `{date}-verify-{agent-index}-{time}.md` - Individual reviews
- `{date}-verify-collated-{time}.md` - Collation report
- `{date}-verify-crosscheck-{time}.md` - Cross-check results

## Templates

Review template: `${CLAUDE_PLUGIN_ROOT}templates/verify-review.md`
Collation template: `${CLAUDE_PLUGIN_ROOT}templates/verify-collation.md`
