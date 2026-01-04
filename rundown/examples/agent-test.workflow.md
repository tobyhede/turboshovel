# Agent Compliance Test

Tests whether an agent can follow a workflow correctly.

## 1. Read the instructions

Read the workflow file and understand the process.

**Prompt:** Read rundown/examples/agent-test.workflow.md and confirm you understand the steps.

- PASS: CONTINUE
- FAIL: STOP "Agent failed to read instructions"

## 2. Create a test file

```bash
echo "Agent was here: $(date)" > /tmp/agent-test-output.txt
```

- PASS: CONTINUE
- FAIL: RETRY 2

## 3. Verify the file exists

```bash
cat /tmp/agent-test-output.txt
```

- PASS: CONTINUE
- FAIL: STOP "File was not created"

## 4. Clean up

```bash
rm /tmp/agent-test-output.txt
```

- PASS: DONE
- FAIL: STOP "Failed to clean up"
