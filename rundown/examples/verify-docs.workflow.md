# Verify Documentation Subworkflow

A child workflow for documentation verification, used by parent workflows.

## 1. Check accuracy

Verify documentation matches implementation.

**Prompt:** Compare documentation against the actual code. Identify any discrepancies between documented behavior and implementation.

- PASS: CONTINUE
- FAIL: STOP "Documentation verification failed"

## 2. Write report

Document verification results.

**Prompt:** Write a documentation verification report including:
- Inaccuracies found
- Missing documentation
- Suggested updates

- PASS: DONE
- FAIL: STOP
