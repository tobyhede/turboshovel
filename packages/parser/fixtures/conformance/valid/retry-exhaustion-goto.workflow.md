# RETRY Exhaustion with GOTO

Tests that RETRY exhaustion triggers GOTO fallback action.

## 1. Flaky step

```bash
tsv test --result fail --result fail --result fail
```

- PASS: CONTINUE
- FAIL: RETRY 2 GOTO 3

## 2. Skipped step

```bash
tsv test --result pass
```

- PASS: DONE

## 3. Recovery step

```bash
tsv test --result pass
```

- PASS: DONE
