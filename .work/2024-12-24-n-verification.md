# N-Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `/turboshovel:verify` command that dispatches N independent review agents, collates findings by consensus ratio (N/N = Common, <N/N = Exclusive), and cross-checks exclusive findings.

**Architecture:** Convention-based command triggers workflow. Skill provides heuristics. Workflow orchestrates N parallel agents via dynamic subtasks, then collation agent, then cross-check agent. Templates structure agent outputs.

**Tech Stack:** Markdown (commands/skills/workflows/templates), existing workflow system with dynamic subtasks

---

## Task 1: Create Command Definition

**Files:**
- Create: `plugin/hooks/commands/verify.md`

**Step 1: Create commands directory**

```bash
mkdir -p plugin/hooks/commands
```

**Step 2: Write command file**

Create `plugin/hooks/commands/verify.md`:

```markdown
---
description: N-Verification with independent agents and consensus-based collation
---

# Verify

Dispatch N independent review agents, collate findings by consensus ratio, cross-check exclusive findings.

<instructions>
## Instructions

## MANDATORY: Skill Activation

Use and follow the n-verification skill exactly as written.

Path: `${CLAUDE_PLUGIN_ROOT}skills/n-verification/SKILL.md`
Tool: `Skill(skill: "turboshovel:n-verification")`

Do NOT proceed without completing skill activation.
</instructions>

ARGUMENTS: $ARGUMENTS
```

**Step 3: Commit**

```bash
git add plugin/hooks/commands/verify.md
git commit -m "feat(verify): add verify command definition"
```

---

## Task 2: Create Skill with Heuristics

**Files:**
- Create: `plugin/hooks/skills/n-verification/SKILL.md`

**Step 1: Create skills directory**

```bash
mkdir -p plugin/hooks/skills/n-verification
```

**Step 2: Write skill file**

Create `plugin/hooks/skills/n-verification/SKILL.md`:

```markdown
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
```

**Step 3: Commit**

```bash
git add plugin/hooks/skills/n-verification/SKILL.md
git commit -m "feat(verify): add n-verification skill with heuristics"
```

---

## Task 3: Create Workflow File

**Files:**
- Create: `plugin/hooks/workflows/verify.workflow.md`

**Step 1: Create workflows directory**

```bash
mkdir -p plugin/hooks/workflows
```

**Step 2: Write workflow file**

Create `plugin/hooks/workflows/verify.workflow.md`:

```markdown
# N-Verification Workflow

Orchestrate N independent reviews, collation, and cross-check.

## 1. Dispatch review agents

Dispatch $count review agents in parallel. Each agent independently reviews
the subject using verify-review.md template.

### 1.{n}

Dispatch review agent.

**Prompt:** Review the subject independently. Write findings to
`.work/{date}-verify-{agent-index}-{timestamp}.md` using the template.

- PASS: CONTINUE
- FAIL: RETRY 1

## 2. Collate findings

Compare all agent reviews. Categorize by consensus ratio:
- Common (N/N): All agents found
- Exclusive: (N-1)/N, (N-2)/N, ... 1/N

**Prompt:** Read all review files from step 1. Use verify-collation.md template.
Write collation to `.work/{date}-verify-collated-{timestamp}.md`.

Present Common findings to user immediately.

- PASS: CONTINUE
- FAIL: STOP "Collation failed"

## 3. Cross-check exclusive findings

Validate ALL exclusive findings against ground truth.
Mark each as VALIDATED, INVALIDATED, or UNCERTAIN.

**Prompt:** For each exclusive finding, verify against the actual implementation/docs/plan.
Write results to `.work/{date}-verify-crosscheck-{timestamp}.md`.

- PASS: CONTINUE
- FAIL: CONTINUE

## 4. Present summary

Present final verification summary with all findings and their status.

**Prompt:** Summarize:
- Common (N/N): Ready to implement
- Exclusive VALIDATED: Should implement
- Exclusive INVALIDATED: Can skip
- Exclusive UNCERTAIN: User decides

- PASS: DONE
```

**Step 3: Commit**

```bash
git add plugin/hooks/workflows/verify.workflow.md
git commit -m "feat(verify): add verify workflow with dynamic subtasks"
```

---

## Task 4: Create Review Template

**Files:**
- Create: `plugin/hooks/templates/verify-review.md`

**Step 1: Create templates directory**

```bash
mkdir -p plugin/hooks/templates
```

**Step 2: Write review template**

Create `plugin/hooks/templates/verify-review.md`:

```markdown
# Review: [Subject]

**Reviewer:** [Agent type/name]
**Date:** [YYYY-MM-DD HH:mm]
**Review Index:** [N of M]

## Ground Truth

[What this review is verifying against - implementation, docs, plan, etc.]

## Findings

### BLOCKING Issues

Issues that must be addressed before proceeding.

#### Issue 1: [Title]

**Location:** [file:line or section]
**Description:** [What's wrong]
**Evidence:** [Quote or reference]
**Recommendation:** [How to fix]

### SUGGESTIONS

Issues that should be considered but don't block.

#### Suggestion 1: [Title]

**Location:** [file:line or section]
**Description:** [What could be improved]
**Recommendation:** [How to improve]

## Summary

**BLOCKING count:** X
**SUGGESTION count:** X

**Conclusion:** [PASS | FAIL | NEEDS_WORK]
```

**Step 3: Commit**

```bash
git add plugin/hooks/templates/verify-review.md
git commit -m "feat(verify): add review template"
```

---

## Task 5: Create Collation Template

**Files:**
- Create: `plugin/hooks/templates/verify-collation.md`

**Step 1: Write collation template**

Create `plugin/hooks/templates/verify-collation.md`:

```markdown
# Verification Collation Report

**Date:** [YYYY-MM-DD HH:mm]
**Agent Count:** [N]
**Reviews Collated:** [List of review files]
**Cross-Check Status:** [PENDING | COMPLETE]

## Executive Summary

| Category | Count |
|----------|-------|
| Common (N/N) | X |
| Exclusive Total | X |

## Common (N/N)

Issues all agents independently found. Very high confidence - implement immediately.

### Issue 1: [Title]

**Found by:** All [N] agents
**Consensus:** N/N
**Location:** [file:line]
**Description:** [What's wrong]
**Action:** Implement fix

## Exclusive

Issues found by fewer than all agents. Requires cross-check validation.

### (N-1)/N

#### Issue X: [Title]

**Found by:** [Agent 1, Agent 2] (not Agent 3)
**Consensus:** 2/3
**Location:** [file:line]
**Description:** [What's wrong]
**Cross-Check Status:** [PENDING | VALIDATED | INVALIDATED | UNCERTAIN]

### 1/N

#### Issue Y: [Title]

**Found by:** [Agent 2 only]
**Consensus:** 1/3
**Location:** [file:line]
**Description:** [What's wrong]
**Cross-Check Status:** [PENDING | VALIDATED | INVALIDATED | UNCERTAIN]

## Recommendations

### Immediate (Common)
- [ ] Fix issue 1
- [ ] Fix issue 2

### Pending Cross-Check (Exclusive)
- [ ] Issue X (awaiting validation)
- [ ] Issue Y (awaiting validation)
```

**Step 2: Commit**

```bash
git add plugin/hooks/templates/verify-collation.md
git commit -m "feat(verify): add collation template with ratio categories"
```

---

## Task 6: Register Command in Plugin

**Files:**
- Modify: `plugin/hooks/hooks.json`

**Step 1: Read current hooks.json**

Read `plugin/hooks/hooks.json` to understand current structure.

**Step 2: Add commands registration**

If hooks.json doesn't already have a commands section, the command discovery happens via directory convention. Verify that `commands/` directory is recognized.

Check if turboshovel's plugin structure already supports command discovery via the `commands/` directory pattern. If yes, no modification needed.

If not, document how commands are discovered and whether hooks.json needs updating.

**Step 3: Commit if changes needed**

```bash
git add plugin/hooks/hooks.json
git commit -m "feat(verify): register verify command"
```

---

## Task 7: Update Documentation

**Files:**
- Modify: `plugin/hooks/README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README.md**

Add verify command documentation to README:

```markdown
## N-Verification

Dispatch N independent agents to review, collate by consensus, cross-check exclusive findings.

### Usage

```bash
/turboshovel:verify                    # Default: 2 agents
/turboshovel:verify --count 3          # Use 3 agents
/turboshovel:verify --agents "Explore,Plan"  # Specify agents
```

### Phases

1. **Dispatch** - N agents review independently in parallel
2. **Collate** - Compare findings:
   - Common (N/N): All agree → implement immediately
   - Exclusive (<N/N): Some found → pending cross-check
3. **Cross-check** - Validate all exclusive findings
4. **Present** - Summary with confidence levels

### Output

Files saved to `.work/`:
- `{date}-verify-{index}-{time}.md` - Individual reviews
- `{date}-verify-collated-{time}.md` - Collation report
- `{date}-verify-crosscheck-{time}.md` - Cross-check results
```

**Step 2: Update CLAUDE.md**

Add brief mention to project instructions:

```markdown
## Commands

- `/turboshovel:verify` - N-Verification with consensus-based collation
```

**Step 3: Commit**

```bash
git add plugin/hooks/README.md CLAUDE.md
git commit -m "docs(verify): add verify command documentation"
```

---

## Task 8: Integration Test

**Files:**
- Create: `plugin/hooks/examples/verify-test.workflow.md` (temporary test workflow)

**Step 1: Create test scenario**

Create a simple test that exercises the verify command:

1. Create a small test subject (e.g., a file with known issues)
2. Run `/turboshovel:verify --count 2`
3. Verify:
   - Two review files created
   - Collation file created with Common/Exclusive sections
   - Cross-check file created
   - Workflow completes successfully

**Step 2: Run test**

```bash
# Start fresh session
# Run verify command
# Check .work/ for expected output files
```

**Step 3: Document any issues found**

If issues found, create follow-up tasks.

**Step 4: Clean up test files**

```bash
rm plugin/hooks/examples/verify-test.workflow.md
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "test(verify): verify command integration test passed"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Command definition | `commands/verify.md` |
| 2 | Skill with heuristics | `skills/n-verification/SKILL.md` |
| 3 | Workflow orchestration | `workflows/verify.workflow.md` |
| 4 | Review template | `templates/verify-review.md` |
| 5 | Collation template | `templates/verify-collation.md` |
| 6 | Plugin registration | `hooks.json` (if needed) |
| 7 | Documentation | `README.md`, `CLAUDE.md` |
| 8 | Integration test | Manual verification |

**Total new files:** 5
**Total modified files:** 2-3
