# Executable Command Workflow

This directory contains the implementation plan and validation for adding command execution to the turboshovel workflow system.

## Contents

| File | Purpose |
|------|---------|
| `2025-12-21-workflow-command-execution.md` | Implementation plan with TDD tasks |
| `execute-workflow-validation-v2.md` | Validation mapping cipherpowers → turboshovel |
| `examples/execute.workflow.md` | Main plan execution workflow |
| `examples/code-review.workflow.md` | Code review gate workflow |
| `examples/task-execution.workflow.md` | Single task execution workflow |

## Summary

### What We're Building

Add bash command execution to `workflow next`:

```bash
# Execute command, evaluate exit code, apply action
workflow next

# Skip execution (Claude controls)
workflow next --skip-exec

# Inject exit code without executing
workflow next --exit-code 0

# Jump to step (GOTO)
workflow next --step 3
```

### Exit Code Model

```
Exit 0 → PASS path
Exit ≠0 → FAIL path
```

### Action Handling

| Action | Behavior |
|--------|----------|
| CONTINUE | Advance to next step |
| GOTO N | Jump to step N |
| STOP "msg" | Halt workflow with message |
| DONE | Complete workflow |
| RETRY N | Increment retry count, stay on step |

### Implementation Tasks

1. **Executor module** - `executeCommand(code, cwd)`
2. **Action evaluator** - `evaluateAction(step, success)`
3. **Step runner** - `runStep(step, state, options)`
4. **CLI update** - Add flags and action handling
5. **Documentation** - Update README

### Validation

The `execute-workflow-validation-v2.md` document validates this design by:
- Mapping cipherpowers executing-plans skill to workflow
- Creating executable workflow files
- Defining test cases (basic, batch loop, BLOCKED)
- Identifying required hooks

## Next Steps

1. Implement the plan: `/cipherpowers:execute .work/executable-cmd-workflow/2025-12-21-workflow-command-execution.md`
2. Test with example workflows
3. Migrate cipherpowers skills to use workflows
