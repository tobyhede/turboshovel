# Execute Task

Execute one task from the implementation plan.

## 1. Implement

Execute the task exactly as specified.

**tsv pass:** Task implemented
**tsv fail:** Cannot implement without changing approach

- PASS: CONTINUE
- FAIL: STOP "BLOCKED"

## 2. Verify

```bash
npm run lint && npm run build && npm test
```

- PASS: GOTO 4
- FAIL: CONTINUE

## 3. Can you fix this?

**tsv pass:** Syntax, typos, imports, naming
**tsv fail:** Algorithm, library, API, scope

- PASS: GOTO 2
- FAIL: STOP "BLOCKED"

## 4. Complete

```
STATUS: OK
TASK: [task identifier]
SUMMARY: [what was implemented]
```

- PASS: DONE
- FAIL: STOP
