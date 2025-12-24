# Cross-check Exclusive Issues Workflow

Validate exclusive issues from dual-verification against ground truth.

## 1. Load collation report

Load the collation report to identify exclusive issues.

- PASS: CONTINUE
- FAIL: STOP "Collation report not found"

## 2. Validate each issue

For each exclusive issue:
- Read the issue description
- Verify against ground truth (codebase/requirements)
- Assign: VALIDATED / INVALIDATED / UNCERTAIN

- PASS: CONTINUE
- FAIL: STOP "Validation failed"

## 3. Update collation

Update the collation report with cross-check validation status.

- PASS: CONTINUE
- FAIL: STOP "Could not update collation report"

## 4. Report completion

Summarize validation results.
Tell user: "Cross-check complete. `/revise exclusive` or `/revise all` ready."

- PASS: DONE
