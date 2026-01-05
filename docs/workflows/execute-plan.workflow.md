# Execute Plan

Execute an implementation plan in batches with review checkpoints.

## 1. Load plan

Read the implementation plan and review critically.

**tsv pass:** Plan is clear, no blocking concerns
**tsv fail:** Plan has gaps, questions, or blocking concerns

- PASS: CONTINUE
- FAIL: STOP

## 2. Execute batch

### 2.{n}
 - docs/workflows/implement-task.workflow.md

- PASS ALL: CONTINUE
- FAIL ANY: STOP "BLOCKED: Task failed"

## 3. Validate

```bash
tsv test npm run lint && tsv test npm run build && tsv test npm test
```

- PASS: CONTINUE
- FAIL: GOTO 4

## 4. Troubleshoot

Can you fix the validation issues without changing plan approach?

**tsv yes:** Syntax, typos, imports, test fixes
**tsv no:** Algorithm, library, API changes needed

- PASS: GOTO 3
- FAIL: STOP "BLOCKED: Validation failed"

## 5. Batch complete

Batch complete.

**tsv yes:** More batches remaining
**tsv no:** All batches complete

- PASS: GOTO 2
- FAIL: DONE
