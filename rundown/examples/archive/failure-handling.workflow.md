# Failure Handling Test

Tests how agents handle workflow failures and retries.

## 1. Succeed first

```bash
echo "Step 1 passed"
```

- PASS: CONTINUE
- FAIL: STOP

## 2. Fail intentionally

This step WILL fail. The agent should handle it correctly.

```bash
exit 1
```

- PASS: CONTINUE
- FAIL: RETRY 2 GOTO 3

## 3. Recovery step

If you're here, the failure was handled correctly.

```bash
echo "Recovery successful - failure was handled"
```

- PASS: DONE
- FAIL: STOP
