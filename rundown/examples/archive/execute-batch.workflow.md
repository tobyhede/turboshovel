# Execute Batch

Execute a batch of tasks from the implementation plan.

## 1. Execute tasks

### 1.{n}
 - execute-task.workflow.md

Execute the assigned task following the plan exactly.

- PASS ALL: CONTINUE
- FAIL ANY: STOP "BLOCKED"

## 2. Batch complete

All tasks in batch passed.

```
STATUS: OK
BATCH: [batch identifier]
TASKS: [list of completed tasks]
```

- PASS: DONE
- FAIL: STOP
