# Code Review Workflow

Dispatch code-review-agent to review implementation.

## 1. Dispatch reviewer

Dispatch code-review-agent subagent to review recent changes.

**Prompt:** Dispatch cipherpowers:code-review-agent with the files modified in this batch.

- PASS: CONTINUE
- FAIL: RETRY 1

## 2. Parse review

Agent parses review output and categorizes issues.

**Prompt:** Categorize feedback as BLOCKING or NON-BLOCKING per code-review standards.

- PASS: CONTINUE
- FAIL: STOP "Review parsing failed"

## 3. Check blocking issues

Evaluate: Does the review contain BLOCKING issues?

```bash
# Agent determines: any BLOCKING issues?
# Exit 1 if BLOCKING issues exist
echo "Agent evaluates blocking issues"
```

- PASS: CONTINUE
- FAIL: STOP "BLOCKING issues found. Fix before continuing."

## 4. Address feedback

Address NON-BLOCKING feedback or defer with justification.

**Prompt:** Fix NON-BLOCKING issues or document why they're deferred.

- PASS: DONE
