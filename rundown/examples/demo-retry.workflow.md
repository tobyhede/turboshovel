# Demo Retry Workflow

Demonstrates retry behavior using the new RETRY syntax with configurable exhaustion actions.

## 1. Flaky operation with GOTO

Simulates a command that fails and retries 3 times before going to step 2.

```bash
tsv test --result fail --result fail --result pass npm test
```

- PASS: CONTINUE
- FAIL: RETRY 3 GOTO 2

## 2. Always passes with exhaustion message

Simulates a reliable command that stops with a message if it fails.

```bash
tsv test npm install
```

- PASS: DONE
- FAIL: RETRY "Unexpected failure"

## 3. Flaky build with continuation

Simulates a build command that retries 5 times and continues if all retries fail.

```bash
tsv test --result fail --result fail --result pass npm run build
```

- PASS: CONTINUE
- FAIL: RETRY 5 CONTINUE
