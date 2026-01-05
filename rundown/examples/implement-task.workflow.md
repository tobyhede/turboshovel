# Implement Task

Execute a single task from the implementation plan.

## 1. Implement

Execute the task exactly as specified in the plan.

**tsv pass:** Implementation complete, approach unchanged
**tsv fail:** Cannot implement without deviating from plan

- PASS: CONTINUE
- FAIL: STOP "BLOCKED"

## 2. Checks

```bash
tsv test npm run lint && tsv test npm run build
```

- PASS: GOTO 3
- FAIL: GOTO 4

## 3. Tests

```bash
tsv test npm test
```

- PASS: GOTO 5
- FAIL: GOTO 4

## 4. Troubleshoot

Can you fix this without changing the plan's approach?

**tsv pass:** Syntax, typos, imports, naming
**tsv fail:** Algorithm, library, API changes

- PASS: GOTO 2
- FAIL: STOP "BLOCKED"

## 5. Complete

```
STATUS: OK
TASK: {task_id}
SUMMARY: {implementation_summary}
```

- PASS: DONE
- FAIL: STOP
