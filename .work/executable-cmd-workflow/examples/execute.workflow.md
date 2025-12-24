# Execute Workflow

Execute implementation plans in controlled batches with review checkpoints.

## 1. Load plan

Read plan file from path or discover in `.work/` directory.

Review critically for questions or concerns. If concerns exist, raise them before proceeding.

```bash
test -f "${PLAN_PATH:-plan.md}" && echo "Plan loaded"
```

- PASS: CONTINUE
- FAIL: STOP "Plan file not found. Set PLAN_PATH or create plan.md"

## 2. Create task tracking

Create TodoWrite items based on plan tasks.

**Prompt:** Parse the plan and create TodoWrite entries for each task.

- PASS: CONTINUE
- FAIL: STOP "Could not create task tracking"

## 3. Execute batch

Execute next batch of tasks (default: 3 tasks).

For each task:
1. Mark as in_progress in TodoWrite
2. Select agent semantically (NOT keyword matching):
   - Rust → rust-exec-agent
   - General → code-exec-agent
   - Complex debug → ultrathink-debugger
   - Docs → technical-writer
3. Dispatch with following-plans skill embedded
4. Check STATUS in agent completion

**Prompt:** Execute the next batch of tasks. Embed following-plans in agent prompts.

```bash
# Verification: tests should pass after batch
npm test 2>/dev/null || echo "Tests pending"
```

- PASS: CONTINUE
- FAIL: RETRY 3

## 4. Code review

**MANDATORY:** Dispatch code-review-agent to review batch implementation.

**Prompt:** Use cipherpowers:requesting-code-review skill. Fix BLOCKING issues before continuing.

- PASS: CONTINUE
- FAIL: STOP "BLOCKING issues found. Fix before continuing."

## 5. Report and wait

Show what was implemented. Show verification output.

**Prompt:** Say "Ready for feedback." and wait for user input.

- PASS: CONTINUE

## 6. Check more batches

Evaluate: Are there more pending tasks in the plan?

**Prompt:** Check TodoWrite for pending tasks. If more remain, loop back. If done, continue.

```bash
# Agent determines: more tasks pending?
# Exit 1 (FAIL) to loop back, exit 0 (PASS) to continue
echo "Agent evaluates pending tasks"
```

- PASS: CONTINUE
- FAIL: GOTO 3

## 7. Complete development

Verify tests pass, present completion options, execute user choice.

**Prompt:** Use cipherpowers:finishing-a-development-branch skill.

```bash
npm test && npm run build
```

- PASS: DONE
- FAIL: STOP "Tests or build failing. Fix before completing."
