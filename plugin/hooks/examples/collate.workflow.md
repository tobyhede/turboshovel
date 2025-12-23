# Collate Reviews Workflow

Collate two independent reviews and identify common issues, exclusive issues, and divergences.

## 1. Dispatch collation agent

Dispatch review-collation-agent to compare the two review files.

Use collation template to structure output.

- PASS: CONTINUE
- FAIL: RETRY 2

## 2. Present results

Present collation summary to user immediately.

Show: Common issues (VERY HIGH), Exclusive issues (MODERATE), Divergences.

Tell user: "Can `/revise common` now. Cross-check starting..."

- PASS: DONE
