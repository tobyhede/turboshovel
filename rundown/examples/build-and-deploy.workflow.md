# Build and Deploy Workflow

A sequential workflow demonstrating task execution, commands, conditions, retries, and branching.

## 1. Install dependencies

Install project dependencies.

```bash
tsv test npm install
```

- PASS: CONTINUE
- FAIL: STOP "Failed to install dependencies"

## 2. Run linting

Check code style and formatting.

```bash
tsv test --result fail --result pass npm run lint
```

- PASS: CONTINUE
- FAIL: RETRY 2

## 3. Run tests

Execute the test suite.

```bash
tsv test npm test
```

- PASS: CONTINUE
- FAIL: GOTO 5

## 4. Build project

Compile the project for production.

```bash
tsv test --result fail --result fail --result pass npm run build
```

- PASS: CONTINUE
- FAIL: RETRY 3

## 5. Deploy to staging

Deploy the build artifacts to staging environment.

```bash
tsv test npm run deploy:staging
```

- PASS: DONE
- FAIL: STOP "Deployment failed"
