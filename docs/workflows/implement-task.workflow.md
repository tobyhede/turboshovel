# Implement Task

Execute a single task from the implementation plan.

## 1. Implement

Execute the task exactly as specified in the plan.

**tsv pass:** Syntax corrections, error handling details, naming, organization
**tsv fail:** Different algorithm, library, data structure, or scope

- PASS: CONTINUE
- FAIL: STOP "BLOCKED"

## 2. Checks

```bash
tsv test npm run lint && tsv test npm run build
```

- PASS: CONTINUE
- FAIL: GOTO 4

## 3. Tests

```bash
tsv test npm test
```

- PASS: CONTINUE
- FAIL: GOTO 4

## 4. Troubleshoot

Can you fix this without changing the plan's approach?

**tsv yes:** Syntax, typos, imports, error handling, naming
**tsv no:** Algorithm, library, data structure, API changes

When in doubt, tsv no.

- PASS: GOTO 2
- FAIL: STOP "BLOCKED"

## 5. Complete

Task passed all checks.

```
STATUS: OK
TASK: {task_id}
SUMMARY: {implementation_summary}
```

- PASS: DONE
- FAIL: STOP
