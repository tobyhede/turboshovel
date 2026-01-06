# E2E Workflow Test Plan

## Goal
Validate workflow orchestration with parallel agent dispatch. Includes deliberate errors to stress test verification.

## Architecture
Main agent dispatches 12 parallel subagents. Each creates a JSON file in `.work/tasks/`. Three tasks contain deliberate errors to test verification catches mismatches.

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

### 2. Create task-02.json [DELIBERATE ERROR]
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

### 7. Create task-08.json [DELIBERATE ERROR]
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

### 11. Create task-11.json [DELIBERATE ERROR]
**File:** `.work/tasks/task-11.json`
**Content:** `{"task": 11, "value": "kilo", "agent_id": "{AGENT_ID}"}`

### 12. Create task-12.json
**File:** `.work/tasks/task-12.json`
**Content:** `{"task": 12, "value": "lima", "agent_id": "{AGENT_ID}"}`

## Deliberate Errors Summary

| Task | Error Type | Expected | Actual |
|------|------------|----------|--------|
| 2 | Wrong task field | `task: 2` | `task: 3` |
| 7 | Wrong filename | `task-07.json` | `task-08.json` |
| 11 | Wrong value | `value: "lima"` | `value: "kilo"` |

**Batch distribution (errors at 2, 7, 11):**
- Batch÷3: hits batches 1, 3, 4
- Batch÷4: hits all 3 batches
- Batch÷6: hits both batches

## Success Criteria

**Execution:**
- 12 files created in `.work/tasks/`
- All 12 AGENT_IDs are unique (proves parallel dispatch)
- Workflow completes without BLOCKED

**Verification must detect:**
- Task 2: `task` field mismatch (3 ≠ 2)
- Task 7: missing `task-07.json`, duplicate `task-08.json`
- Task 11: `value` mismatch ("kilo" ≠ "lima")

## Workflow Architecture

**Two-tier orchestration:**

```
execute-plan.runbook.md (9 steps)
└── Step 2: Execute batch
    └── 2.{n} → implement-task.runbook.md (per batch)
          └── {N}.1-{N}.7 (implement → evaluate → checks → tests → troubleshoot → fix → complete)
```

**Control flow:**
- execute-plan: `3→4→5→3` (validate → handle failures → fix → revalidate)
- implement-task: `{N}.3→{N}.5→{N}.6→{N}.3` (checks → troubleshoot → fix → recheck)

**Decision points:**
- {N}.1: Required changes? NO→skip evaluate, YES→evaluate
- {N}.2: Changes within parameters? (logic, deps, scope, interfaces)

**STOP propagation:** Any `tsv fail` at decision points stops with "BLOCKED:" message for orchestrator intervention.

## Usage
Use `/turboshovel:test-end-to-end` to execute this test plan.
