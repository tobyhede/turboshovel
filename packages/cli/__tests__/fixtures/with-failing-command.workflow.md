## 1. Execute failing command

Run a command that fails then succeeds.

```bash
tsv test --result fail --result fail --result pass
```

- PASS: CONTINUE
- FAIL: RETRY 2

## 2. Complete step

```bash
tsv test --result pass
```

- PASS: DONE
- FAIL: STOP
