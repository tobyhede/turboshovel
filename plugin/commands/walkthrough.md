---
description: Run the turboshovel feature walkthrough
---

# Walkthrough

Run the turboshovel feature walkthrough to see all workflow features in action.

<instructions>
## Instructions

This walkthrough exercises all workflow features:
- Parallel substep dispatch
- Agent binding and tracking
- Conditional branching (GOTO, RETRY)
- Gate integration
- Context injection
- Verification

## Running the Walkthrough

1. Start the workflow:
   ```bash
   tsv start ${CLAUDE_PLUGIN_ROOT}/workflows/walkthrough.workflow.md
   ```

2. Check status anytime:
   ```bash
   tsv status
   ```

3. Follow the workflow prompts to progress through steps.

4. On completion, the verification script validates the entire execution.

## Outputs

- `.work/walkthrough.log` - Execution trace
- `.claude/turboshovel/workflows/` - Workflow state files

## Troubleshooting

If a step fails:
- Check `.work/walkthrough.log` for the last successful step
- Use `tsv status` to see current state
- Use `tsv stop` to abort and start fresh

</instructions>