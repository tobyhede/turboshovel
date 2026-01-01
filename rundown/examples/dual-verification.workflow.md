# Dual Verification Workflow

A workflow with dynamic subtasks that cycles through subworkflows for comprehensive verification.

## 1. Execute verification rounds

Launch parallel verification agents using different subworkflows.

### 1.{n}
 - verify-code.workflow.md
 - verify-docs.workflow.md

Execute the assigned verification workflow.

**Prompt:** You are verification agent $n of $count. Execute your assigned subworkflow thoroughly. Write output to `.work/{date}-verify-$n.md`.

- PASS ALL: CONTINUE
- FAIL ANY: STOP "Verification failed"

## 2. Collate results

Combine all verification results.

**Prompt:** Read all verification outputs from `.work/{date}-verify-*.md` files. Create a collated report at `.work/{date}-verification-collated.md` with:
- Common findings (found by multiple agents)
- Unique findings (found by single agent)
- Overall verification status

- PASS: CONTINUE
- FAIL: STOP

## 3. Final assessment

Determine if verification passed.

**Prompt:** Review the collated verification report. If critical issues exist, report failure. Otherwise, confirm verification passed.

- PASS: DONE
- FAIL: STOP "Critical issues require resolution"
