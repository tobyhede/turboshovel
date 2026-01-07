## 1. Retry step

May need multiple attempts.

```bash
tsv echo --result fail --result fail --result pass
```

- PASS: CONTINUE
- FAIL: RETRY 3

## 2. Final step

Complete workflow.

```bash
tsv echo --result pass
```

- PASS: COMPLETE
- FAIL: STOP
