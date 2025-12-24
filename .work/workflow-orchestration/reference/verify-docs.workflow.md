# Verify Docs Workflow

Dual-verification for documentation accuracy with high confidence.

## 1. Dispatch independent reviewers

Dispatch 2 agents in parallel with identical prompts.
Both verify documentation against current codebase implementation.
Check: file paths exist, commands work, examples accurate.

### 1.A First reviewer (technical-writer)
### 1.B Second reviewer (code-agent)

- PASS ALL: CONTINUE
- FAIL ANY: STOP "Reviewer failed"

## 2. Collate findings

Dispatch review-collation-agent to compare the two review files.
Present collation summary to user immediately.

- PASS: CONTINUE
- FAIL: STOP "Collation failed"

## 3. Cross-check exclusive issues

Dispatch code-agent to validate exclusive issues against codebase.
Update collation report with validation status.

- PASS: CONTINUE
- FAIL: STOP "Cross-check failed"

## 4. Report completion

Present final summary with confidence levels.
Tell user: "Verification complete. `/revise common` or `/revise all` ready."

- PASS: DONE
