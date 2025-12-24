# Collate Reviews Workflow

Collate two independent reviews and identify common issues, exclusive issues, and divergences.

## 1. Parse reviews

Read both review files completely.
Extract all issues from each reviewer.

- PASS: CONTINUE
- FAIL: STOP "Could not parse reviews"

## 2. Identify patterns

Identify common issues (both found) → VERY HIGH confidence.
Identify exclusive issues (one found) → MODERATE confidence.
Identify divergences (conflicting findings).

- PASS: CONTINUE
- FAIL: STOP "Could not categorize issues"

## 3. Resolve divergences

If divergences exist, dispatch verification agent to determine correct perspective.
Incorporate verification analysis into report.

- PASS: CONTINUE
- FAIL: STOP "Could not resolve divergences"

## 4. Save collation report

Save using collation template structure.
Include confidence levels for all issues.

- PASS: DONE
- FAIL: STOP "Could not save report"
