## 1. Setup

```bash
tsv test --result pass
```

- PASS: CONTINUE
- FAIL: STOP

## 2. Test

```bash
tsv test --result fail --result fail --result pass
```

- PASS: DONE
- FAIL: RETRY 2
