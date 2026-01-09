# E2E Workflow Test Plan

## Goal
Validate workflow orchestration with parallel agent dispatch.

## Architecture
Main agent dispatches 12 parallel subagents.
Each creates a JSON file in `.work/tasks/`.

## Output Format
Each task creates `.work/tasks/task-{NN}.json`:
```json
{
  "task": {N},
  "value": "{unique_value}",
  "agent_id": "{AGENT_ID}"
}
```

## Tasks

### 1. Create task-01.json
**File:** `.work/tasks/task-01.json`
**Content:** `{"task": 1, "value": "alpha", "agent_id": "{AGENT_ID}"}`

### 2. Create task-02.json
**File:** `.work/tasks/task-02.json`
**Content:** `{"task": 3, "value": "bravo", "agent_id": "{AGENT_ID}"}`
*Error: task field says 3 instead of 2*

### 3. Create task-03.json
**File:** `.work/tasks/task-03.json`
**Content:** `{"task": 3, "value": "charlie", "agent_id": "{AGENT_ID}"}`

### 4. Create task-04.json
**File:** `.work/tasks/task-04.json`
**Content:** `{"task": 4, "value": "delta", "agent_id": "{AGENT_ID}"}`

### 5. Create task-05.json
**File:** `.work/tasks/task-05.json`
**Content:** `{"task": 5, "value": "echo", "agent_id": "{AGENT_ID}"}`

### 6. Create task-06.json
**File:** `.work/tasks/task-06.json`
**Content:** `{"task": 6, "value": "foxtrot", "agent_id": "{AGENT_ID}"}`

### 7. Create task-08.json
**File:** `.work/tasks/task-08.json`
**Content:** `{"task": 7, "value": "golf", "agent_id": "{AGENT_ID}"}`

### 8. Create task-08.json
**File:** `.work/tasks/task-08.json`
**Content:** `{"task": 8, "value": "hotel", "agent_id": "{AGENT_ID}"}`

### 9. Create task-09.json
**File:** `.work/tasks/task-09.json`
**Content:** `{"task": 9, "value": "india", "agent_id": "{AGENT_ID}"}`

### 10. Create task-10.json
**File:** `.work/tasks/task-10.json`
**Content:** `{"task": 10, "value": "juliet", "agent_id": "{AGENT_ID}"}`

### 11. Create task-11.json
**File:** `.work/tasks/task-11.json`
**Content:** `{"task": 11, "value": "kilo", "agent_id": "{AGENT_ID}"}`

### 12. Create task-12.json
**File:** `.work/tasks/task-12.json`
**Content:** `{"task": 12, "value": "lima", "agent_id": "{AGENT_ID}"}`


## Success Criteria

**Execution:**
- 12 files created in `.work/tasks/`
- Files contain the right values
- AGENT_IDs correspond to batches (proves parallel dispatch)
- Any errors caught and addressed

