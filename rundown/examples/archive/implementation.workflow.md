# Implementation Workflow

Execute your assigned batch of tasks from the implementation plan.

**Batch:** You have been assigned N tasks. Execute each one, then signal batch complete.

## 1. Implement task

Execute the current task exactly as specified in the plan.

**tsv pass:** Syntax corrections, error handling details, naming, organization
**tsv fail:** Different algorithm, library, data structure, or scope

- PASS: CONTINUE
- FAIL: STOP "BLOCKED"

## 2. Run checks

```bash
tsv test npm run lint && tsv test npm run build
```

- PASS: GOTO 3
- FAIL: GOTO 4

## 3. Run tests

```bash
tsv test npm test
```

- PASS: GOTO 5
- FAIL: GOTO 4

## 4. Troubleshoot

**Can you fix this without changing the plan's approach?**

**tsv pass:** Syntax, typos, imports, error handling, naming
**tsv fail:** Algorithm, library, data structure, API changes

When in doubt, tsv fail.

- PASS: GOTO 2
- FAIL: STOP "BLOCKED"

## 5. Task complete

Task passed all checks.

```
STATUS: OK
TASK: [task identifier]
SUMMARY: [what was implemented]
```

**tsv pass:** More tasks in batch
**tsv fail:** Batch complete

- PASS: GOTO 1
- FAIL: DONE
