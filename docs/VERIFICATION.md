# Verifying by Consensus (N-Verification)

**Skill:** `verifying-by-consensus`
**Command:** `/verify` (or `/turboshovel:verify`)

## Overview

Dispatch N independent review agents to independently review the same subject. Collate findings by consensus to reduce false positives and increase confidence.

**Logic:**
- **Common (N/N):** All agents found the issue → High confidence, act immediately.
- **Exclusive (<N/N):** Only some agents found the issue → Needs cross-check validation.

## Usage

```bash
# Default (2 agents)
/verify

# Specify count
/verify --count 3

# Specify agents
/verify --agents "Explore,Plan"
```

## Process Phases

### Phase 1: Dispatch
1. Determine N (default 2).
2. Start the verification workflow (`verify.runbook.md`).
3. Dispatch N agents in parallel. Each agent produces a review file: `.work/{date}-verify-{agentId}.md`.

### Phase 2: Collate
After all agents complete, the system:
1. Reads all N review files.
2. Compares findings across agents.
3. Categorizes issues into:
   - **Common (N/N)**
   - **Exclusive (e.g. 1/N)**
4. Writes collation report: `.work/{date}-verify-collated.md`.

### Phase 3: Cross-Check
For every **exclusive** finding (where agents disagreed), a new "Cross-Check Agent" is dispatched to validate the finding against ground truth.
- Result: VALIDATED, INVALIDATED, or UNCERTAIN.
- Writes cross-check report: `.work/{date}-verify-crosscheck.md`.

### Phase 4: Presentation
The final summary is presented to the user, showing validated issues to address and invalidated noise to ignore.

## Agent Count Heuristics

| Scope | Default N | Rationale |
|-------|-----------|-----------|
| Single file change | 2 | Focused review, two perspectives sufficient |
| Multi-file feature | 2-3 | More surface area benefits from diversity |
| Architecture change | 3 | Different perspectives valuable |
| Security-sensitive | 3+ | Higher stakes warrant more eyes |

## Output Files

All artifacts are saved to `.work/` for audit and review:
- `{date}-verify-{agentId}.md` - Individual reviews
- `{date}-verify-collated.md` - Collation report
- `{date}-verify-crosscheck.md` - Cross-check results
