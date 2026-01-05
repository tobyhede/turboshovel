## 1. Retry step

May need multiple attempts.

```bash
tsv test --result fail --result fail --result pass
```

- PASS: CONTINUE
- FAIL: RETRY 3

## 2. Final step

Complete workflow.

```bash
tsv test --result pass
```

- PASS: DONE
- FAIL: STOP
