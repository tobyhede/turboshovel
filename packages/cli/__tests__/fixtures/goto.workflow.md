## 1. Start

Initial step.

```bash
tsv test --result pass
```

- PASS: GOTO 3
- FAIL: STOP

## 2. Skipped

This gets skipped by GOTO.

```bash
tsv test --result pass
```

- PASS: CONTINUE
- FAIL: STOP

## 3. Jump target

Jumped here from step 1.

```bash
tsv test --result pass
```

- PASS: DONE
- FAIL: STOP
