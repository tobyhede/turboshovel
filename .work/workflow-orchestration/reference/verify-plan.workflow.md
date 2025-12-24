# Verify Plan Workflow

Dual-verification for implementation plan review with high confidence.

## 1. Dispatch independent reviewers

Dispatch 2 agents in parallel with identical prompts.
Both evaluate plan against 35 quality criteria (security, testing, architecture, etc.).

### 1.A First reviewer (plan-review-agent)
### 1.B Second reviewer (code-agent)

- PASS ALL: CONTINUE
- FAIL ANY: STOP "Reviewer failed"

## 2. Collate findings

Dispatch review-collation-agent to compare the two review files.
Present collation summary to user immediately.

- PASS: CONTINUE
- FAIL: STOP "Collation failed"

## 3. Cross-check exclusive issues

Dispatch plan-review-agent to validate exclusive issues against requirements.
Update collation report with validation status.

- PASS: CONTINUE
- FAIL: STOP "Cross-check failed"

## 4. Report completion

Present final summary with confidence levels.
Tell user: "Verification complete. `/revise common` or `/revise all` ready."

- PASS: DONE
