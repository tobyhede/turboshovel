# Verify Code Workflow

Dual-verification for code review with high confidence.

## 1. Initialize verification

Set verification type to "code" and prepare output paths.

- PASS: CONTINUE
- FAIL: STOP "Could not initialize verification"

## 2. Dispatch independent reviewers

Dispatch 2 agents in parallel with identical prompts.

### 2.A First reviewer (code-review-agent)
### 2.B Second reviewer (code-agent)

Both systematically review code against coding standards and requirements.

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
