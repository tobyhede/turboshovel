# Task Execution Workflow

Execute a single task within a subagent context.

## 1. Load task context

Read plan file and locate the specific task to execute.

```bash
test -f "${PLAN_PATH:-plan.md}"
```

- PASS: CONTINUE
- FAIL: STOP "Could not load plan"

## 2. Follow plan

Execute task exactly as specified in plan.

**Prompt:** Follow the plan step by step. Use the following-plans decision tree:
- Syntax fix only → fix and note in completion
- Approach change → report BLOCKED

**Critical:** Include STATUS in completion report:
- STATUS: OK (task completed as planned)
- STATUS: BLOCKED (plan approach won't work)

- PASS: CONTINUE
- FAIL: RETRY 2

## 3. Run verification

Execute any verification steps specified for this task.

```bash
npm test -- --findRelatedTests
```

- PASS: CONTINUE
- FAIL: RETRY 2

## 4. Report completion

Report with STATUS field.

**Prompt:** Report STATUS: OK if task completed, STATUS: BLOCKED if deviation needed.

- PASS: DONE
