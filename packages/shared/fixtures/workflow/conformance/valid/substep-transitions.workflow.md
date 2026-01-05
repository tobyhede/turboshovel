# Substep Transitions Conformance
Tests discrete transitions and navigation at the substep level.

## 1. Complex Parent

### 1.1 Initial
Do first thing.
- PASS: CONTINUE
- FAIL: RETRY 2 STOP

### 1.2 Branch point
Ask a question.
- YES: GOTO 1.4
- NO: CONTINUE

### 1.3 Alternative path
Should be skipped if YES.
- PASS: CONTINUE

### 1.4 Target
Reached via GOTO or CONTINUE.
- PASS: CONTINUE
