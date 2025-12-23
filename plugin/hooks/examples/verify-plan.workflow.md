# Verify Plan Workflow

Dual-verification for implementation plan review with high confidence.

## 1. Initialize verification

Set verification type to "plan" and locate plan file.

- PASS: CONTINUE
- FAIL: STOP "Could not initialize verification"

## 2. Dispatch independent reviewers

Dispatch 2 agents in parallel with identical prompts.

### 2.A First reviewer (plan-review-agent)
### 2.B Second reviewer (code-agent)

Both evaluate plan against 35 quality criteria (security, testing, architecture, etc.).

- PASS (ALL): CONTINUE
- FAIL (ANY): STOP "Reviewer failed"

## 3. Collate findings

workflow: collate.workflow.md

- PASS: CONTINUE
- FAIL: STOP "Collation failed"

## 4. Start cross-check

workflow: crosscheck.workflow.md

- PASS: DONE
- FAIL: STOP "Cross-check failed to start"
