# Verify Docs Workflow

Dual-verification for documentation accuracy with high confidence.

## 1. Initialize verification

Set verification type to "docs" and locate documentation files.

- PASS: CONTINUE
- FAIL: STOP "Could not initialize verification"

## 2. Dispatch independent reviewers

Dispatch 2 agents in parallel with identical prompts.

### 2.A First reviewer (technical-writer)
### 2.B Second reviewer (code-agent)

Both verify documentation against current codebase implementation.

Check: file paths exist, commands work, examples accurate.

- PASS (ALL): CONTINUE
- FAIL (ANY): STOP "Reviewer failed"

## 3. Collate findings

workflow: collate.workflow.md

- PASS: CONTINUE
- FAIL: STOP "Collation failed"

## 4. Start cross-check

workflow: crosscheck.workflow.md

- PASS: DONE
- FAIL: STOP "Cross-check failed to start"
