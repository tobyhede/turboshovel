# Substep Transitions Conformance
Tests discrete transitions and navigation at the substep level.

## 1. Complex Parent

### 1.1 Initial

```bash
tsv test --result pass
```

Do first thing.
- PASS: CONTINUE
- FAIL: RETRY 2 STOP

### 1.2 Branch point

```bash
tsv test --result pass
```

Ask a question.
- YES: GOTO 1.4
- NO: CONTINUE

### 1.3 Alternative path

```bash
tsv test --result pass
```

Should be skipped if YES.
- PASS: CONTINUE

### 1.4 Target

```bash
tsv test --result pass
```

Reached via GOTO or CONTINUE.
- PASS: CONTINUE
