# Demo Retry Workflow

Demonstrates retry behavior using the test command.

## 1. Flaky operation

Simulates a command that fails twice before succeeding.

```bash
tsv test --result fail --result fail --result pass npm test
```

- PASS: CONTINUE
- FAIL: RETRY 3

## 2. Always passes

Simulates a reliable command.

```bash
tsv test npm install
```

- PASS: DONE
- FAIL: STOP "Unexpected failure"
