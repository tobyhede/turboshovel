# Build and Deploy Workflow

Basic sequential build & deploy workflow with retry and error handling.

## 1. Install project dependencies

```bash
tsv test npm install
```
- PASS: CONTINUE
- FAIL: STOP "Dependencies installation failed"

## 2. Run lint

```bash
tsv test --result fail --result pass npm run lint
```

- PASS: CONTINUE
- FAIL: STOP "Lint check failed"

## 3. Run tests

```bash
tsv test npm test
```

- PASS: CONTINUE
- FAIL: STOP "Tests failed"

## 4. Build with retry and GOTO

```bash
tsv test --result fail --result fail --result pass npm run build
```

- PASS: CONTINUE
- FAIL: RETRY 3 GOTO 3

## 5. Deploy with exhaustion action

```bash
tsv test npm run deploy
```

- PASS: DONE
- FAIL: RETRY 2 STOP "Deployment failed after retries"
