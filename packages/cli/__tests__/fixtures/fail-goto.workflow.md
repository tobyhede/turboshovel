## 1. First step

May fail and jump to recovery.

- PASS: CONTINUE
- FAIL: GOTO 3

## 2. Normal path

Skipped on failure.

- PASS: CONTINUE
- FAIL: STOP

## 3. Recovery step

Jumped here on failure.

- PASS: DONE
- FAIL: STOP