# RETRY Exhaustion with DONE

Tests that RETRY exhaustion triggers DONE fallback action.

## 1. Flaky step

```bash
tsv echo --result fail --result fail
```

- PASS: CONTINUE
- FAIL: RETRY 1 DONE
