# Build and Deploy Workflow

Basic sequential build & deploy workflow

## 1. Install project dependencies

```bash
tsv test npm install
```

## 2. Run lint

```bash
tsv test npm run lint
```

- PASS: CONTINUE
- FAIL: STOP

## 3. Run tests

```bash
tsv test npm test
```

- PASS: CONTINUE
- FAIL: STOP "Failed to run tests"

## 4. Build

```bash
tsv test --result fail --result pass npm run build
```

- PASS: CONTINUE
- FAIL: RETRY

## 5. Deploy


```bash
tsv test --result fail --result fail --result pass npm run deploy
```

- PASS: DONE
- FAIL: RETRY 3
