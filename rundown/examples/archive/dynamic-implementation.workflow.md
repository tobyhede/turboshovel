# Dynamic Implementation Workflow

Execute batch tasks using dynamic step with substep control flow.

## {N}. Execute task

### {N}.1 Implement

Execute the task exactly as specified in the plan.

**tsv pass:** Implementation complete
**tsv fail:** Cannot implement without changing approach

- PASS: CONTINUE
- FAIL: STOP "BLOCKED"

### {N}.2 Run checks

```bash
npm run lint && npm run build
```

- PASS: CONTINUE
- FAIL: GOTO {N}.4

### {N}.3 Run tests

```bash
npm test
```

- PASS: GOTO {N}.5
- FAIL: GOTO {N}.4

### {N}.4 Troubleshoot

Can you fix without changing the plan's approach?

**tsv pass:** Syntax, typos, imports, naming
**tsv fail:** Algorithm, library, API, scope changes

- PASS: GOTO {N}.2
- FAIL: STOP "BLOCKED"

### {N}.5 Complete

Task complete.

**tsv pass:** More tasks in batch
**tsv fail:** Batch complete

- PASS: NEXT
- FAIL: DONE
