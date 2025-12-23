# Verify Workflow Examples Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create example workflow markdown files demonstrating the cipherpowers verify command as a turboshovel workflow.

**Architecture:** Each verify type (code, plan, docs) has a main workflow file that orchestrates the 3-phase dual-verification process. Shared subworkflows (collate, crosscheck) are nested for reuse. All Task dispatches and workflow state changes use manual `workflow` CLI calls via Bash.

**Tech Stack:** Markdown workflow files, turboshovel workflow CLI

---

## Background: Verify Command Structure

The cipherpowers verify command implements a 3-phase dual-verification pattern:

1. **Phase 1: Dual Independent Review** - Dispatch 2 agents in parallel with identical prompts
2. **Phase 2: Collation** - Dispatch collation agent to compare findings, present to user
3. **Phase 3: Cross-check** - Dispatch cross-check agent to validate exclusive issues (background)

This plan creates workflow files that encode this process with:
- Manual `workflow` CLI calls (no hooks)
- Task dispatch descriptions matching TaskId pattern (`3.A - Description`)
- Nested workflows for reusable collation and cross-check phases

---

## File Structure

```
plugin/hooks/examples/
├── verify-code.workflow.md      # Main workflow for code review verification
├── verify-plan.workflow.md      # Main workflow for plan review verification
├── verify-docs.workflow.md      # Main workflow for docs review verification
├── collate.workflow.md          # Nested workflow for collation phase
└── crosscheck.workflow.md       # Nested workflow for cross-check phase
```

---

### Task 1: Create collate.workflow.md

**Files:**
- Create: `plugin/hooks/examples/collate.workflow.md`

**Step 1: Create the collation nested workflow file**

```markdown
# Collate Reviews Workflow

Collate two independent reviews and identify common issues, exclusive issues, and divergences.

## 1. Dispatch collation agent

Dispatch review-collation-agent to compare the two reviews.

**Prompt:**
```
You are collating two independent reviews.

**Review #1:** ${REVIEW_1_PATH}
**Review #2:** ${REVIEW_2_PATH}

Read the collation template at ${TEMPLATE_PATH} and follow it exactly.
Save to: .work/${DATE}-verify-${TYPE}-collated-${TIME}.md
```

```bash
workflow start --task 1
```

- PASS: CONTINUE
- FAIL: RETRY 2

## 2. Present results

Present collation summary to user immediately.

Show: Common issues (VERY HIGH), Exclusive issues (MODERATE), Divergences.
Tell user: "Can `/revise common` now. Cross-check starting..."

- PASS: DONE
```

**Step 2: Verify file was created correctly**

Run: `cat plugin/hooks/examples/collate.workflow.md`

**Step 3: Commit**

```bash
git add plugin/hooks/examples/collate.workflow.md
git commit -m "feat(workflow): add collate nested workflow example"
```

---

### Task 2: Create crosscheck.workflow.md

**Files:**
- Create: `plugin/hooks/examples/crosscheck.workflow.md`

**Step 1: Create the cross-check nested workflow file**

```markdown
# Cross-check Exclusive Issues Workflow

Validate exclusive issues from dual-verification against ground truth.

## 1. Load collation report

Load the collation report to identify exclusive issues.

```bash
test -f "${COLLATION_PATH}"
```

- PASS: CONTINUE
- FAIL: STOP "Collation report not found"

## 2. Dispatch cross-check agent

Dispatch appropriate agent to validate exclusive issues.

**Prompt:**
```
You are cross-checking exclusive issues from a dual-verification review.

**Collation report:** ${COLLATION_PATH}

For EACH exclusive issue:
1. Read the issue description
2. Verify against ground truth (codebase/requirements)
3. Assign: VALIDATED / INVALIDATED / UNCERTAIN

Save to: .work/${DATE}-verify-${TYPE}-crosscheck-${TIME}.md
```

```bash
workflow start --task 2
```

- PASS: CONTINUE
- FAIL: RETRY 2

## 3. Update collation with results

Update the collation report with cross-check validation status.

- PASS: CONTINUE
- FAIL: STOP "Could not update collation report"

## 4. Report completion

Tell user: "Cross-check complete. `/revise exclusive` or `/revise all` ready."

- PASS: DONE
```

**Step 2: Verify file was created correctly**

Run: `cat plugin/hooks/examples/crosscheck.workflow.md`

**Step 3: Commit**

```bash
git add plugin/hooks/examples/crosscheck.workflow.md
git commit -m "feat(workflow): add crosscheck nested workflow example"
```

---

### Task 3: Create verify-code.workflow.md

**Files:**
- Create: `plugin/hooks/examples/verify-code.workflow.md`

**Step 1: Create the code verification workflow file**

```markdown
# Verify Code Workflow

Dual-verification for code review with high confidence.

## 1. Initialize verification

Set verification type and prepare output paths.

```bash
workflow start verify-code.workflow.md
export VERIFY_TYPE="code"
export DATE=$(date +%Y-%m-%d)
export TIME=$(date +%H%M%S)
```

- PASS: CONTINUE
- FAIL: STOP "Could not initialize verification"

## 2. Dispatch independent reviewers

Dispatch 2 code-review-agent agents in parallel with identical prompts.

### 2.A First reviewer

```bash
workflow start --task 2.A
```

**Task prompt:**
```
You are cipherpowers:code-review-agent conducting an independent verification review.

**Context:** You are one of two agents performing parallel independent reviews.

**Your task:** Systematically review the code against coding standards and requirements.

**Template:** /Users/tobyhede/src/cipherpowers/plugin/templates/verify-template.md
**Save to:** .work/${DATE}-verify-code-${TIME}.md

Work completely independently.
```

### 2.B Second reviewer

```bash
workflow start --task 2.B
```

**Task prompt:**
```
You are cipherpowers:code-agent conducting an independent verification review.

**Context:** You are one of two agents performing parallel independent reviews.

**Your task:** Systematically review the code against coding standards and requirements.

**Template:** /Users/tobyhede/src/cipherpowers/plugin/templates/verify-template.md
**Save to:** .work/${DATE}-verify-code-${TIME}.md

Work completely independently.
```

- PASS (ALL): CONTINUE
- FAIL (ANY): STOP "Reviewer failed"

## 3. Collate findings

workflow: collate.workflow.md

```bash
export REVIEW_1_PATH=".work/${DATE}-verify-code-*-1.md"
export REVIEW_2_PATH=".work/${DATE}-verify-code-*-2.md"
export TEMPLATE_PATH="/Users/tobyhede/src/cipherpowers/plugin/templates/verify-collation-template.md"
workflow next --pass --task 3
```

- PASS: CONTINUE
- FAIL: STOP "Collation failed"

## 4. Start cross-check

Start cross-check in background while user can proceed with common issues.

workflow: crosscheck.workflow.md

```bash
export COLLATION_PATH=".work/${DATE}-verify-code-collated-*.md"
workflow next --pass --task 4
```

- PASS: DONE
- FAIL: STOP "Cross-check failed to start"
```

**Step 2: Verify file was created correctly**

Run: `cat plugin/hooks/examples/verify-code.workflow.md`

**Step 3: Commit**

```bash
git add plugin/hooks/examples/verify-code.workflow.md
git commit -m "feat(workflow): add verify-code workflow example"
```

---

### Task 4: Create verify-plan.workflow.md

**Files:**
- Create: `plugin/hooks/examples/verify-plan.workflow.md`

**Step 1: Create the plan verification workflow file**

```markdown
# Verify Plan Workflow

Dual-verification for implementation plan review with high confidence.

## 1. Initialize verification

Set verification type and prepare output paths.

```bash
workflow start verify-plan.workflow.md
export VERIFY_TYPE="plan"
export DATE=$(date +%Y-%m-%d)
export TIME=$(date +%H%M%S)
export PLAN_PATH="${1:-.work/*.md}"
```

- PASS: CONTINUE
- FAIL: STOP "Could not initialize verification"

## 2. Dispatch independent reviewers

Dispatch 2 plan-review-agent agents in parallel with identical prompts.

### 2.A First reviewer

```bash
workflow start --task 2.A
```

**Task prompt:**
```
You are cipherpowers:plan-review-agent conducting an independent verification review.

**Context:** You are one of two agents performing parallel independent reviews.

**Your task:** Systematically evaluate the implementation plan against 35 quality criteria.

**Plan:** ${PLAN_PATH}
**Template:** /Users/tobyhede/src/cipherpowers/plugin/templates/verify-plan-template.md
**Save to:** .work/${DATE}-verify-plan-${TIME}.md

Work completely independently.
```

### 2.B Second reviewer

```bash
workflow start --task 2.B
```

**Task prompt:**
```
You are cipherpowers:code-agent conducting an independent verification review.

**Context:** You are one of two agents performing parallel independent reviews.

**Your task:** Systematically evaluate the implementation plan against 35 quality criteria.

**Plan:** ${PLAN_PATH}
**Template:** /Users/tobyhede/src/cipherpowers/plugin/templates/verify-plan-template.md
**Save to:** .work/${DATE}-verify-plan-${TIME}.md

Work completely independently.
```

- PASS (ALL): CONTINUE
- FAIL (ANY): STOP "Reviewer failed"

## 3. Collate findings

workflow: collate.workflow.md

```bash
export REVIEW_1_PATH=".work/${DATE}-verify-plan-*-1.md"
export REVIEW_2_PATH=".work/${DATE}-verify-plan-*-2.md"
export TEMPLATE_PATH="/Users/tobyhede/src/cipherpowers/plugin/templates/verify-collation-template.md"
workflow next --pass --task 3
```

- PASS: CONTINUE
- FAIL: STOP "Collation failed"

## 4. Start cross-check

Start cross-check in background while user can proceed with common issues.

workflow: crosscheck.workflow.md

```bash
export COLLATION_PATH=".work/${DATE}-verify-plan-collated-*.md"
workflow next --pass --task 4
```

- PASS: DONE
- FAIL: STOP "Cross-check failed to start"
```

**Step 2: Verify file was created correctly**

Run: `cat plugin/hooks/examples/verify-plan.workflow.md`

**Step 3: Commit**

```bash
git add plugin/hooks/examples/verify-plan.workflow.md
git commit -m "feat(workflow): add verify-plan workflow example"
```

---

### Task 5: Create verify-docs.workflow.md

**Files:**
- Create: `plugin/hooks/examples/verify-docs.workflow.md`

**Step 1: Create the docs verification workflow file**

```markdown
# Verify Docs Workflow

Dual-verification for documentation accuracy with high confidence.

## 1. Initialize verification

Set verification type and prepare output paths.

```bash
workflow start verify-docs.workflow.md
export VERIFY_TYPE="docs"
export DATE=$(date +%Y-%m-%d)
export TIME=$(date +%H%M%S)
export DOCS_PATH="${1:-README.md CLAUDE.md}"
```

- PASS: CONTINUE
- FAIL: STOP "Could not initialize verification"

## 2. Dispatch independent reviewers

Dispatch 2 technical-writer agents in parallel with identical prompts.

### 2.A First reviewer

```bash
workflow start --task 2.A
```

**Task prompt:**
```
You are cipherpowers:technical-writer conducting an independent verification review.

**Context:** You are one of two agents performing parallel independent reviews.

**Your task:** Systematically verify documentation against current codebase implementation.

**Docs:** ${DOCS_PATH}
**Ground truth:** Current codebase
**Template:** /Users/tobyhede/src/cipherpowers/plugin/templates/verify-template.md
**Save to:** .work/${DATE}-verify-docs-${TIME}.md

Check: file paths exist, commands work, examples accurate.
Work completely independently.
```

### 2.B Second reviewer

```bash
workflow start --task 2.B
```

**Task prompt:**
```
You are cipherpowers:code-agent conducting an independent verification review.

**Context:** You are one of two agents performing parallel independent reviews.

**Your task:** Systematically verify documentation against current codebase implementation.

**Docs:** ${DOCS_PATH}
**Ground truth:** Current codebase
**Template:** /Users/tobyhede/src/cipherpowers/plugin/templates/verify-template.md
**Save to:** .work/${DATE}-verify-docs-${TIME}.md

Check: file paths exist, commands work, examples accurate.
Work completely independently.
```

- PASS (ALL): CONTINUE
- FAIL (ANY): STOP "Reviewer failed"

## 3. Collate findings

workflow: collate.workflow.md

```bash
export REVIEW_1_PATH=".work/${DATE}-verify-docs-*-1.md"
export REVIEW_2_PATH=".work/${DATE}-verify-docs-*-2.md"
export TEMPLATE_PATH="/Users/tobyhede/src/cipherpowers/plugin/templates/verify-collation-template.md"
workflow next --pass --task 3
```

- PASS: CONTINUE
- FAIL: STOP "Collation failed"

## 4. Start cross-check

Start cross-check in background while user can proceed with common issues.

workflow: crosscheck.workflow.md

```bash
export COLLATION_PATH=".work/${DATE}-verify-docs-collated-*.md"
workflow next --pass --task 4
```

- PASS: DONE
- FAIL: STOP "Cross-check failed to start"
```

**Step 2: Verify file was created correctly**

Run: `cat plugin/hooks/examples/verify-docs.workflow.md`

**Step 3: Commit**

```bash
git add plugin/hooks/examples/verify-docs.workflow.md
git commit -m "feat(workflow): add verify-docs workflow example"
```

---

## Summary

This plan creates 5 workflow files demonstrating the cipherpowers verify command:

| File | Purpose |
|------|---------|
| `collate.workflow.md` | Reusable nested workflow for Phase 2 collation |
| `crosscheck.workflow.md` | Reusable nested workflow for Phase 3 cross-check |
| `verify-code.workflow.md` | Main workflow for code verification |
| `verify-plan.workflow.md` | Main workflow for plan verification |
| `verify-docs.workflow.md` | Main workflow for docs verification |

**Key patterns demonstrated:**
- TaskId format in step headers (`2.A First reviewer`, `2.B Second reviewer`)
- Parallel task syntax with `PASS (ALL)` / `FAIL (ANY)` aggregation
- Nested workflow references (`workflow: collate.workflow.md`)
- Manual CLI calls (`workflow start --task 2.A`)
- Variable passing between workflows via environment exports
- Cipherpowers plugin path references

**Not included (out of scope):**
- Hook automation (explicitly excluded per requirements)
- Actual execution logic (workflow files are declarative)
- Template file creation (references existing cipherpowers templates)
