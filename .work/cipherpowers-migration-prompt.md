# Cipherpowers Migration to Turboshovel Workflows

## Critical: Execution Paradigm

**Workflows are state trackers, NOT executors.**

| Component | Role |
|-----------|------|
| Workflow file | Instructions for Claude (like a skill) |
| Workflow CLI | Tracks state: current step, variables, retry count |
| Claude | Executes steps using Task, Bash, Edit tools |

**Workflow = Skill with persistent state + CLI control**

The workflow system does NOT:
- Auto-execute bash commands (Claude runs them)
- Auto-dispatch agents (Claude uses Task tool)
- Auto-make decisions (Claude interprets outcomes)

The workflow system DOES:
- Persist state across context clears
- Track progress (step, retries, variables)
- Provide CLI control for humans
- Auto-inject active workflow prompt into conversation

## File References

### Primary Documentation
- `plugin/hooks/README.md:403-435` - **Execution Paradigm section (START HERE)**
- `plugin/hooks/README.md:389-700` - Complete Workflow System documentation
- `plugin/hooks/README.md:555-600` - Agent-Controlled Branching pattern

### Examples
- `plugin/hooks/examples/execute.workflow.md` - Batch execution workflow
- `plugin/hooks/examples/code-review.workflow.md` - Code review workflow

### Implementation
- `plugin/hooks/hooks-app/src/workflow/` - Core workflow system
  - `types.ts` - Type definitions
  - `state.ts` - State management
  - `parser.ts` - Workflow parser
- `plugin/hooks/hooks-app/src/cli/workflow-cli.ts` - CLI implementation

### State Files (runtime)
- `.claude/turboshovel/session.json` - Active workflow tracking
- `.claude/turboshovel/workflows/{id}.json` - Workflow state files

## Workflow Syntax Quick Reference

```markdown
# Workflow Name

Description (optional).

## 1. First step

Step description becomes implicit prompt.

- PASS: CONTINUE
- FAIL: STOP "Error message"

## 2. Second step

\`\`\`bash
npm test
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 3

## 3. Final step

- PASS: DONE
```

## CLI Commands

```bash
workflow start <file>      # Start workflow
workflow status            # Show current state
workflow next              # Advance to next step
workflow next --step N     # Jump to specific step (for loops)
workflow list              # List all workflows
workflow stop              # Abort workflow
workflow complete          # Mark complete
workflow complete --status blocked  # Mark blocked
```

## Actions Reference

| Action | Effect |
|--------|--------|
| `CONTINUE` | Proceed to next step |
| `STOP` / `STOP "message"` | Halt workflow with message |
| `DONE` | Mark workflow complete |
| `GOTO N` | Jump to step N |
| `RETRY N` | Retry step up to N times |

## Agent-Controlled Branching

Since IF/ELSE is NOT YET IMPLEMENTED, use agent decisions:

```markdown
## 5. Check if more batches

Agent evaluates: Are there more tasks?

- PASS: `workflow next --step 3` (loop back)
- FAIL: `workflow next` (proceed to cleanup)
```

Claude makes the decision, then runs the appropriate CLI command.

## Migration Strategy

1. **Read paradigm section** (`plugin/hooks/README.md:403-435`)
2. **Identify skill to migrate** - Which cipherpowers skill?
3. **Extract steps** - Break skill logic into numbered steps
4. **Write workflow.md** - Use syntax above
5. **Test with CLI** - `workflow start`, `workflow next`
6. **Integrate context** - Add `.claude/context/{workflow}-start.md` if needed

## Key Differences from Skills

| Aspect | Skills | Workflows |
|--------|--------|-----------|
| State | In-memory (lost on clear) | Persisted to disk |
| Control | Embedded in conversation | CLI-controlled |
| Steps | Implicit | Explicit numbered |
| Retry | Manual handling | Built-in counts |
| Variables | None | Key-value store |
| Execution | Claude reads skill | Claude reads workflow + CLI tracks |

## Notes

- IF/ELSE conditionals are NOT YET IMPLEMENTED
- Commands in code blocks are NOT auto-executed
- PASS/FAIL outcomes are agent-interpreted
- Workflow context auto-injects when active
