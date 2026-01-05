# Execute Plan

Execute an implementation plan in batches with review checkpoints.

## 1. Load plan

Read the implementation plan and review critically.

**tsv pass:** Plan is clear, no blocking concerns
**tsv fail:** Plan has gaps, questions, or blocking concerns

- PASS: CONTINUE
- FAIL: STOP "BLOCKED: Plan review"

## 2. Execute batch

Dispatch subagent(s) to implement current batch of tasks.

**Batch size:** {batch_size} tasks (default: 3)

For each task in batch, dispatch subagent with:
- Task specification from plan
- implement-task.workflow.md

**tsv pass:** All tasks returned STATUS: OK
**tsv fail:** Any task returned STATUS: BLOCKED

- PASS: CONTINUE
- FAIL: STOP "BLOCKED: Batch execution"

## 3. Validate batch

Run project verification commands.

```bash
tsv test npm run lint && tsv test npm run build && tsv test npm test
```

- PASS: CONTINUE
- FAIL: GOTO 4

## 4. Review issues

Can you fix the validation issues without changing plan approach?

**tsv pass:** Syntax, typos, imports, test fixes
**tsv fail:** Algorithm, library, API changes needed

- PASS: GOTO 3
- FAIL: STOP "BLOCKED: Validation failed"

## 5. Batch complete

Batch {N} completed successfully.

**tsv pass:** More tasks remaining in plan
**tsv fail:** All tasks complete

- PASS: GOTO 2
- FAIL: DONE
