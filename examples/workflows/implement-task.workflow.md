# Implement Task

Execute tasks from the implementation plan sequentially.

## {N}. Task

### {N}.1 Implement

Follow the plan exactly.

Required changes from plan?

- NO: GOTO {N}.3
- YES: GOTO {N}.2

### {N}.2 Evaluate

Assess changes to logic, dependencies, scope, interfaces.

Within implementation boundaries?

- YES: CONTINUE
- NO: STOP "BLOCKED: Changes exceed implementation boundaries"

### {N}.3 Checks

```bash
tsv test npm run lint && tsv test npm run build
```

- PASS: CONTINUE
- FAIL: GOTO {N}.5

### {N}.4 Tests

```bash
tsv test npm test
```

- PASS: CONTINUE
- FAIL: GOTO {N}.5

### {N}.5 Troubleshoot

Can you fix without changing approach?

- YES: GOTO {N}.6
- NO: STOP "BLOCKED: Requires plan revision"

### {N}.6 Apply fixes

Apply inline fixes.

- PASS: GOTO {N}.3
- FAIL: STOP "BLOCKED: Could not apply fixes"

### {N}.7 Complete

```
STATUS: OK
TASK: {N}
```

More tasks?

- YES: NEXT
- NO: DONE
