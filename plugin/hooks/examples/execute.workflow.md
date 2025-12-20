# Execute Workflow

Execute implementation plans in controlled batches with review checkpoints.

## 1. Load plan

Load plan from path or discover in `.work/` directory.

Read plan file and review critically for questions or concerns.

- PASS: CONTINUE
- FAIL: STOP "No plan file found."

## 2. Create tracking

Create TodoWrite tracking items for plan tasks.

- PASS: CONTINUE
- FAIL: STOP "Could not create task tracking."

## 3. Execute batch

Execute next batch of tasks (3 tasks per batch).

Dispatch subagent for each task with embedded following-plans skill.

- PASS: CONTINUE
- BLOCKED: STOP "Agent reported BLOCKED. Escalate to user."
- FAIL: RETRY 3

## 4. Review batch

Dispatch code-review-agent to review batch implementation.

- PASS: CONTINUE
- FAIL: STOP "BLOCKING issues found. Fix before continuing."

## 5. Report progress

Show what was implemented. Say: "Ready for feedback."

- PASS: CONTINUE

## 6. Check progress

- IF: more_batches
  - GOTO: 3
- ELSE: CONTINUE

## 7. Complete

Verify tests pass. Present completion options.

- PASS: DONE
- FAIL: STOP "Tests failing. Fix before completing."
