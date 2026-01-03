# Implementation Workflow

Execute implementation plan tasks with quality gates and troubleshooting.

## 1. Implement task

Execute the current task exactly as specified in the plan.

Follow the plan exactly. Allowed without approval:
- Syntax corrections (wrong function name, typos)
- Error handling implementation details
- Variable naming choices
- Code organization within file

Requires STATUS: BLOCKED:
- Different algorithm or approach
- Different library/framework
- Different data structure/API design
- Skipping/adding planned functionality

- PASS: CONTINUE
- FAIL: STOP "Implementation failed"

## 2. Run checks

```bash
tsv test npm run lint && tsv test npm run build
```

- PASS: CONTINUE
- FAIL: GOTO 4

## 3. Run tests

```bash
tsv test npm test
```

- PASS: CONTINUE
- FAIL: GOTO 4

## 4. Troubleshoot

Evaluate the failure:

**Can you fix this without changing the plan's approach?**

Fixable (signal PASS):
- Syntax corrections, typos, import paths
- Error handling implementation details
- Variable naming, code organization

Not fixable (signal FAIL):
- Requires different algorithm or approach
- Requires different library/framework
- Requires different data structure/API

When in doubt, signal FAIL.

- PASS: GOTO 2
- FAIL: STOP "STATUS: BLOCKED - requires plan revision"

## 5. Complete task

Task passed all checks.

Report completion:
```
STATUS: OK
TASK: [Current task identifier]
SUMMARY: [What was implemented]
```

Signal PASS if more tasks remain (continues to next task).
Signal FAIL if all tasks complete (finishes workflow).

- PASS: GOTO 1
- FAIL: DONE
