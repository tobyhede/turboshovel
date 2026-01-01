# Verify Code Subworkflow

A child workflow for code verification, used by parent workflows.

## 1. Analyze code

Review the assigned code section.

**Prompt:** Analyze the code for correctness, edge cases, and potential bugs. Document your findings.

- PASS: CONTINUE
- FAIL: STOP "Code analysis failed"

## 2. Write report

Document verification results.

**Prompt:** Write a verification report including:
- Issues found (with severity)
- Suggested improvements
- Overall assessment (pass/fail)

- PASS: DONE
- FAIL: STOP
