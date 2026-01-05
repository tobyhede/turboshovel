# RETRY Success Before Exhaustion

Tests that RETRY succeeds before count is exhausted.

## 1. Flaky step that recovers

```bash
tsv test --result fail --result pass
```

- PASS: DONE
- FAIL: RETRY 3 STOP
