# RETRY Exhaustion with CONTINUE

Tests that RETRY exhaustion triggers CONTINUE fallback action.

## 1. Flaky step

```bash
tsv test --result fail --result fail
```

- PASS: DONE
- FAIL: RETRY 1 CONTINUE

## 2. Fallback step

```bash
tsv test --result pass
```

- PASS: DONE
