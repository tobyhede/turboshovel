# Workflow Orchestration Implementation Plans

> **Design Doc:** `.work/workflow-orchestration/design.md`
> **Date:** 2025-12-23
> **Status:** Ready for execution

---

## Overview

Enable main agent workflows to dispatch subagents for tasks, track their execution, and advance the parent workflow based on subagent outcomes.

**Core Features:**
- Task-agent correlation via pending task queue
- CLI commands: `--task`, `--agent`, `--pass`, `--fail`, `stash`, `pop`
- Hook handlers for PostToolUse, SubagentStart, SubagentStop
- Parser support for subtasks and aggregation modifiers

---

## Plans (Execute in Order)

| # | Plan | Focus | Tasks |
|---|------|-------|-------|
| 1 | [01-foundation-types.md](01-foundation-types.md) | Types & TaskId | 5 |
| 2 | [02-state-layer.md](02-state-layer.md) | State manager methods | 7 |
| 3 | [03-cli-commands.md](03-cli-commands.md) | CLI extensions + docs | 7 |
| 4 | [04-hook-handlers.md](04-hook-handlers.md) | Hook integration | 6 |
| 5 | [05-parser-subtasks.md](05-parser-subtasks.md) | Subtasks & aggregation | 8 |

**Total: 33 tasks**

**Each plan includes:**
- Measurable exit criteria table
- Verification commands
- E2E smoke tests to run before proceeding

---

## Critical Files

| File | Changes |
|------|---------|
| `src/workflow/types.ts` | TaskId, AgentBinding, Subtask, Conditions union |
| `src/workflow/task-id.ts` | NEW - TaskId parsing |
| `src/workflow/state.ts` | Queue, binding, stash/pop methods |
| `src/types.ts` | HookInput.agent_id, tool_input; SessionState.stashedWorkflowId |
| `src/cli/workflow-cli.ts` | --task, --agent, --pass, --fail, stash, pop |
| `src/workflow/hooks/task-tracker.ts` | TaskId parsing, enforcement |
| `src/workflow/hooks/subagent-start.ts` | NEW - Agent binding |
| `src/workflow/hooks/subagent-stop.ts` | Agent lookup, status update |
| `src/dispatcher.ts` | Hook integration with blocking |
| `src/workflow/parser/parser.ts` | H3 subtask parsing |
| `src/workflow/parser/helpers.ts` | Aggregation modifiers |
| `src/workflow/evaluation.ts` | NEW - Condition evaluation |

---

## Verification Commands

```bash
# Run tests
cd plugin/hooks/hooks-app && npm test --no-coverage

# Type check
cd plugin/hooks/hooks-app && npm run build

# Lint
cd plugin/hooks/hooks-app && npm run lint
```

---

## Dependencies

Each plan builds on the previous:

```
01-foundation-types
       ↓
02-state-layer
       ↓
03-cli-commands
       ↓
04-hook-handlers
       ↓
05-parser-subtasks
```

---

## Test Scenarios (End-to-End)

After all plans complete, verify:

1. **Sequential Flow**
   ```bash
   workflow start test.workflow.md
   # Dispatch: Task "1 - Review code"
   # -> PostToolUse pushes to queue
   # -> SubagentStart binds agent
   # -> SubagentStop updates binding
   workflow next
   ```

2. **Parallel Tasks**
   ```bash
   workflow start --task 2.A
   workflow start --task 2.B
   # SubagentStart binds each
   # SubagentStop updates each
   # All complete -> workflow next
   ```

3. **Stash/Pop**
   ```bash
   workflow start test.workflow.md
   workflow stash    # Enforcement paused
   # Dispatch ad-hoc tasks freely
   workflow pop      # Enforcement resumed
   ```

4. **Aggregation**
   ```markdown
   ## 1. Dispatch reviewers
   ### 1.A First reviewer
   ### 1.B Second reviewer
   PASS ALL: CONTINUE
   FAIL ANY: STOP
   ```
