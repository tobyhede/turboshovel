---
description: Run the full E2E workflow test with parallel agent dispatch
---

# Test: End-to-End

Run the E2E workflow test that validates parallel agent dispatch and workflow orchestration.

<instructions>
## Instructions

## Overview

This test validates:
1. Main workflow starts correctly
2. 3 parallel subagents can be dispatched
3. Each subagent gets unique AGENT_ID
4. Subagents execute independently
5. JSON results verify correctly (including deliberate error detection)

## Steps

1. **Clear previous results** (if any):
   ```bash
   rm -rf .work/tasks && mkdir -p .work/tasks
   ```

2. **Start main workflow**:
   ```bash
   npm run cli -- start examples/workflows/execute-plan.workflow.md
   ```

3. **Read the test plan** at `docs/plans/e2e-test.md`

4. **Advance workflow**:
   ```bash
   npm run cli -- pass
   ```

5. **Dispatch 3 parallel subagents** using Task tool with descriptions:
   - "2.1 - Execute Task 1"
   - "2.2 - Execute Task 2"
   - "2.3 - Execute Task 3"

   Each subagent prompt (substitute task number and values from plan):
   ```
   You are executing a task from the E2E test plan.

   Your AGENT_ID will be injected by the workflow system.

   TASK: Create task-{NN}.json

   INSTRUCTIONS:
   1. Start workflow: npm run cli -- start examples/workflows/implement-task.workflow.md --agent {YOUR_AGENT_ID}
   2. Create file .work/tasks/task-{NN}.json with content:
      {"task": {N}, "value": "{value}", "agent_id": "{YOUR_AGENT_ID}"}
   3. Complete workflow: npm run cli -- pass --agent {YOUR_AGENT_ID}
   4. Report STATUS: OK

   IMPORTANT: Follow the plan EXACTLY, even if values seem wrong.
   ```

6. **Verify results**:
   ```bash
   # Check file count
   ls -la .work/tasks/

   # Check each file content
   cat .work/tasks/task-01.json
   cat .work/tasks/task-02.json
   cat .work/tasks/task-03.json

   # Extract and verify unique AGENT_IDs
   grep -h agent_id .work/tasks/*.json | sort -u
   ```

7. **Verify deliberate error** (Task 2 should have wrong task field):
   ```bash
   # Task 2 should show "task": 3 (deliberate error)
   jq '.task' .work/tasks/task-02.json
   ```

8. **Complete workflow**:
   ```bash
   npm run cli -- pass
   npm run cli -- complete
   ```

## Success Criteria

**Execution:**
- 3 JSON files in `.work/tasks/` (task-01.json, task-02.json, task-03.json)
- All 3 AGENT_IDs are unique
- Workflow completes with DONE

**Verification detects:**
- Task 2: `task` field is 3 instead of 2 (deliberate error from plan)

</instructions>

ARGUMENTS: $ARGUMENTS
