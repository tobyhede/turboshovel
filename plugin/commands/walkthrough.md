---
description: Run the turboshovel feature walkthrough
---

# Walkthrough

Run the turboshovel feature walkthrough to see all workflow features in action.

<instructions>
## Instructions

This walkthrough exercises all workflow features:
- Parallel subtask dispatch
- Agent binding and tracking
- Conditional branching (GOTO, RETRY)
- Gate integration
- Context injection
- Verification

## Running the Walkthrough

1. Start the workflow:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/core/dist/cli/workflow-cli.js start ${CLAUDE_PLUGIN_ROOT}/workflows/walkthrough.workflow.md
   ```

2. Check status anytime:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/core/dist/cli/workflow-cli.js status
   ```

3. Follow the workflow prompts to progress through tasks.

4. On completion, the verification script validates the entire execution.

## Outputs

- `.work/walkthrough.log` - Execution trace
- `.claude/turboshovel/workflows/` - Workflow state files

## Troubleshooting

If a task fails:
- Check `.work/walkthrough.log` for the last successful step
- Use `node ${CLAUDE_PLUGIN_ROOT}/core/dist/cli/workflow-cli.js status` to see current state
- Use `node ${CLAUDE_PLUGIN_ROOT}/core/dist/cli/workflow-cli.js stop` to abort and start fresh

</instructions>
