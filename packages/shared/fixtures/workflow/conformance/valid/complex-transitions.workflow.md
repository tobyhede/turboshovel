## 1. Aggregation

```bash
tsv test --result pass
```

- PASS ALL: CONTINUE
- FAIL ANY: STOP "Failed"

## 2. Optimistic

```bash
tsv test --result pass
```

- PASS ANY: GOTO 4
- FAIL ALL: RETRY 3

## 3. Empty

```bash
tsv test --result pass
```

- PASS: CONTINUE

## 4. End

```bash
tsv test --result pass
```

- PASS: DONE
