# Cipherpowers Execute Workflow → Turboshovel Workflow System

## Goal

Validate the turboshovel workflow system design v2 by mapping the cipherpowers execute workflow to the new system. Create draft workflow files, analyze command/skill changes, and design required hooks.

---

## Part 1: Draft Workflow Markdown Files

### Main Workflow: `execute.workflow.md`

```markdown
# Execute Workflow

Execute implementation plans in controlled batches with review checkpoints.

## 1. Load plan

Load plan from path or discover in `.work/` directory.

Read plan file and review critically for questions or concerns.

- IF: has_concerns
  - STOP "Review concerns with user before proceeding."
- ELSE: CONTINUE

## 2. Create TodoWrite

Create TodoWrite tracking items for plan tasks.

- PASS: CONTINUE
- FAIL: STOP "Could not create task tracking."

## 3. Execute batch

workflow: task-batch.workflow.md

Execute first 3 tasks in batch.

- PASS: CONTINUE
- BLOCKED: STOP
- FAIL: RETRY 3

## 4. Review batch

workflow: code-review.workflow.md

Code review is mandatory between batches.

- PASS: CONTINUE
- BLOCKED: STOP "Fix blocking issues before continuing."
- FAIL: RETRY 2

## 5. Report and wait

Show what was implemented. Say: "Ready for feedback."

- PASS: CONTINUE

## 6. Check progress

- IF: more_batches
  - GOTO: 3
- ELSE: CONTINUE

## 7. Complete development

workflow: finish-branch.workflow.md

Verify tests, present options, execute choice.

- PASS: DONE
- FAIL: STOP "Development completion failed."
```

### Nested Workflow: `task-batch.workflow.md`

```markdown
# Task Batch Workflow

Execute a single batch of tasks from the plan.

## 1. Get next task

Select next task from batch. Mark as in_progress.

- IF: batch_empty
  - DONE
- ELSE: CONTINUE

## 2. Select agent

Analyze task requirements semantically (NOT keyword matching).

Select appropriate agent:
- Rust implementation → rust-exec-agent
- General implementation → code-exec-agent
- Complex debugging → ultrathink-debugger
- Documentation → technical-writer

- PASS: CONTINUE

## 3. Execute task

workflow: task-execution.workflow.md

Dispatch agent with embedded following-plans skill.

- PASS: CONTINUE
- BLOCKED: STOP "Agent reported BLOCKED. Escalate to user."
- FAIL: RETRY 2

## 4. Check agent status

Verify agent completion includes STATUS field.

- IF: status_ok
  - Mark task completed
  - GOTO: 1
- IF: status_blocked
  - STOP "Agent BLOCKED. Present options to user."
- IF: status_missing
  - STOP "Agent violated protocol. Missing STATUS field."
```

### Nested Workflow: `task-execution.workflow.md`

```markdown
# Task Execution Workflow

Execute a single task within a subagent.

## 1. Read plan context

Load plan file and task specification.

- PASS: CONTINUE
- FAIL: STOP "Could not load plan."

## 2. Follow plan

Execute task exactly as specified.

Check against following-plans decision tree:
- Syntax fix only → fix and continue
- Approach change → BLOCKED

- PASS: CONTINUE
- BLOCKED: STOP "Approach deviation requires approval."

## 3. Run verification

Execute any verification steps specified in plan.

- PASS: CONTINUE
- FAIL: RETRY 2

## 4. Report completion

Report with STATUS: OK or STATUS: BLOCKED.

- PASS: DONE
```

### Nested Workflow: `code-review.workflow.md`

```markdown
# Code Review Workflow

Dispatch code-review-agent to review batch implementation.

## 1. Dispatch reviewer

Dispatch code-review-agent subagent.

- PASS: CONTINUE
- FAIL: RETRY 1

## 2. Categorize issues

Categorize feedback as BLOCKING or NON-BLOCKING.

- IF: has_blocking_issues
  - STOP "BLOCKING issues found. Fix before continuing."
- ELSE: CONTINUE

## 3. Address feedback

Address NON-BLOCKING feedback or defer with justification.

- PASS: DONE
```

### Nested Workflow: `finish-branch.workflow.md`

```markdown
# Finish Branch Workflow

Complete development after all tasks done.

## 1. Verify tests

Run project test suite.

- PASS: CONTINUE
- FAIL: STOP "Tests failing. Fix before completing."

## 2. Present options

Present completion options:
1. Merge locally
2. Create PR
3. Keep as-is
4. Discard

- PASS: CONTINUE

## 3. Execute choice

Execute user's selected option.

- PASS: DONE
- FAIL: STOP "Could not execute completion choice."
```

---

## Part 2: Command/Skill Changes

### Current State (cipherpowers)

```
/cipherpowers:execute
    ↓
Skill: executing-plans (SKILL.md)
    ↓
Manually tracks: steps, batches, review
    ↓
Embeds: following-plans skill in agent prompts
    ↓
Dispatches: subagents with embedded skill
```

### Proposed State (turboshovel workflows)

```
/cipherpowers:execute  OR  workflow start execute.workflow.md
    ↓
Workflow CLI: starts execute.workflow.md
    ↓
Automatically tracks: step, retry, variables
    ↓
Nested workflows: handle subprocesses
    ↓
Hooks: observe Task tool, inject context
```

### Changes Required

| Component | Current | Proposed |
|-----------|---------|----------|
| **Execute command** | Invokes `executing-plans` skill | Invokes `workflow start execute.workflow.md` |
| **executing-plans skill** | Markdown prose, agent interprets | Executable workflow with formal steps |
| **following-plans skill** | Embedded in agent prompts | Still embedded, but STATUS reported via workflow CLI |
| **Step tracking** | Manual (agent memory) | Workflow state in `.claude/turboshovel/workflows/` |
| **Batch loop** | Agent interprets "more_batches" | `GOTO: 3` with `more_batches` variable |
| **BLOCKED handling** | Agent asks user | Workflow STOP triggers escalation context |
| **Code review gate** | Manual skill invocation | Nested `code-review.workflow.md` |

### Skill Transformation

**executing-plans** skill becomes thin wrapper:

```markdown
# Executing Plans

## Instructions

Start the execute workflow:
```bash
workflow start execute.workflow.md
```

The workflow system handles:
- Step tracking and transitions
- Batch execution loops
- BLOCKED escalation
- Code review gates
- Completion flow
```

**following-plans** skill remains mostly unchanged:
- Still embedded in agent prompts
- STATUS: OK/BLOCKED still required
- But now: agent can call `workflow complete` with status
- Hook observes and updates workflow state

### New Commands

| Command | Purpose |
|---------|---------|
| `workflow start <file>` | Start workflow (via Bash tool) |
| `workflow next` | Advance to next step |
| `workflow next --step N` | Jump to specific step (GOTO) |
| `workflow complete [ok\|blocked]` | Mark subagent workflow done |
| `workflow status` | Show current state |
| `workflow stop` | Abort workflow |

---

## Part 3: Required Hooks

### Hook 1: Task Dispatch Tracker

**Event:** `PostToolUse` (Task tool)

**Purpose:** When agent uses Task tool, register the dispatch in workflow state.

```typescript
// hooks/workflow-task-tracker.ts
export async function trackTaskDispatch(input: HookInput): Promise<void> {
  if (input.tool_name !== 'Task') return;

  const workflow = await loadActiveWorkflow(input.cwd);
  if (!workflow) return;

  // Register task in workflow state
  const taskId = generateTaskId();
  await workflow.addTask({
    id: taskId,
    subagent_type: input.tool_input?.subagent_type,
    status: 'running',
    started_at: new Date().toISOString(),
  });

  await saveWorkflow(workflow);
}
```

**Integration:** Add to dispatcher.ts PostToolUse handling.

### Hook 2: Subagent Completion Handler

**Event:** `SubagentStop`

**Purpose:** When subagent completes, update workflow state and inject next-step context.

```typescript
// hooks/workflow-subagent-stop.ts
export async function handleSubagentStop(input: HookInput): Promise<string | undefined> {
  const workflow = await loadActiveWorkflow(input.cwd);
  if (!workflow) return;

  // Find the task that just completed
  const task = workflow.findRunningTask();
  if (!task) return;

  // Parse subagent output for STATUS
  const status = parseAgentStatus(input.subagent_output);

  // Update task status
  task.status = status === 'BLOCKED' ? 'blocked' : 'complete';
  task.completed_at = new Date().toISOString();
  await saveWorkflow(workflow);

  // Set workflow variables based on status
  if (status === 'BLOCKED') {
    workflow.variables.has_blocked_task = true;
  }

  // Check if all batch tasks done
  const allDone = workflow.tasks.every(t => t.status !== 'running');
  if (allDone) {
    return `All tasks in batch complete. Run: workflow next`;
  }

  return undefined;
}
```

**Integration:** Add to dispatcher.ts SubagentStop handling.

### Hook 3: Workflow CLI Observer

**Event:** `PostToolUse` (Bash tool)

**Purpose:** When agent runs `workflow` command, observe and update session state.

```typescript
// hooks/workflow-cli-observer.ts
export async function observeWorkflowCli(input: HookInput): Promise<void> {
  if (input.tool_name !== 'Bash') return;

  const command = input.tool_input?.command;
  if (!command?.startsWith('workflow ')) return;

  // Parse workflow command
  const parsed = parseWorkflowCommand(command);

  // The CLI tool itself updates state, but we can:
  // 1. Log the transition
  // 2. Fire additional gates based on step
  // 3. Update session state for context injection

  await logger.event('info', 'WorkflowCLI', {
    command: parsed.action,
    step: parsed.step,
  });
}
```

### Hook 4: Workflow Context Injector

**Event:** All hooks (via existing context injection)

**Purpose:** Inject workflow state context based on current step.

```typescript
// hooks/workflow-context-injector.ts
export async function injectWorkflowContext(
  hookEvent: string,
  input: HookInput
): Promise<string | undefined> {
  const workflow = await loadActiveWorkflow(input.cwd);
  if (!workflow) return;

  const step = workflow.currentStep();
  const stepDef = workflow.definition.steps[step - 1];

  // Build context block
  let context = `## Active Workflow: ${workflow.name}\n`;
  context += `**Step ${step}:** ${stepDef.name}\n\n`;
  context += stepDef.prompt || '';

  // Add action guidance
  if (stepDef.actions) {
    context += '\n\n**Next actions:**\n';
    for (const [condition, action] of Object.entries(stepDef.actions)) {
      context += `- ${condition}: ${action}\n`;
    }
  }

  // Add BLOCKED warning if relevant
  if (workflow.variables.has_blocked_task) {
    context += '\n\n⚠️ TASK BLOCKED - Present options to user before continuing.';
  }

  return context;
}
```

**Integration:** Extend existing `context.ts` to check for workflow state.

---

## Part 4: Required Hook Scripts

### Script 1: `workflow` CLI Tool

Location: `plugin/hooks/hooks-app/src/cli/workflow.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { WorkflowRunner } from '../workflow/runner';
import { WorkflowParser } from '../workflow/parser';

const program = new Command();

program
  .name('workflow')
  .description('Manage workflow execution');

program
  .command('start <file>')
  .description('Start a new workflow')
  .action(async (file) => {
    const parser = new WorkflowParser();
    const definition = await parser.parseFile(file);
    const runner = new WorkflowRunner();
    await runner.start(definition);
  });

program
  .command('next')
  .option('--step <n>', 'Jump to specific step')
  .description('Advance to next step')
  .action(async (options) => {
    const runner = new WorkflowRunner();
    await runner.next(options.step ? parseInt(options.step) : undefined);
  });

program
  .command('complete')
  .option('--status <status>', 'Completion status (ok|blocked)')
  .description('Mark workflow complete')
  .action(async (options) => {
    const runner = new WorkflowRunner();
    await runner.complete(options.status || 'ok');
  });

program
  .command('status')
  .description('Show current workflow state')
  .action(async () => {
    const runner = new WorkflowRunner();
    const state = await runner.getStatus();
    console.log(JSON.stringify(state, null, 2));
  });

program
  .command('stop')
  .description('Abort current workflow')
  .action(async () => {
    const runner = new WorkflowRunner();
    await runner.stop();
  });

program.parse();
```

### Script 2: Workflow State Manager

Location: `plugin/hooks/hooks-app/src/workflow/state.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export interface WorkflowState {
  id: string;
  workflow: string;
  step: number;
  step_name: string;
  retry_count: number;
  retry_max: number;
  variables: Record<string, boolean | number | string>;
  tasks: TaskState[];
  nested?: NestedWorkflowState;
}

export interface TaskState {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'blocked';
  subagent_type?: string;
  started_at?: string;
  completed_at?: string;
}

const STATE_DIR = '.claude/turboshovel/workflows';

export async function loadState(cwd: string): Promise<WorkflowState | null> {
  // Load active workflow from session
  const sessionPath = path.join(cwd, '.claude/.session.json');
  try {
    const session = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    if (!session.active_workflow) return null;

    const statePath = path.join(cwd, STATE_DIR, `${session.active_workflow}.json`);
    const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
    return state;
  } catch {
    return null;
  }
}

export async function saveState(cwd: string, state: WorkflowState): Promise<void> {
  const dir = path.join(cwd, STATE_DIR);
  await fs.mkdir(dir, { recursive: true });

  const statePath = path.join(dir, `${state.id}.json`);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));

  // Update session with active workflow
  const sessionPath = path.join(cwd, '.claude/.session.json');
  const session = await loadOrCreateSession(sessionPath);
  session.active_workflow = state.id;
  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
}
```

---

## Part 5: Validation Against Real-World Workflow

### Current Execute Flow (cipherpowers)

1. User: `/execute plan.md`
2. Agent reads executing-plans skill
3. Agent manually tracks: which step, which batch, which task
4. Agent embeds following-plans in subagent prompts
5. Agent dispatches subagents, checks STATUS manually
6. Agent manually loops batches
7. Agent invokes code-review skill manually
8. Agent invokes finish-branch skill manually

**Problems:**
- Agent can skip steps under pressure
- No enforcement of code review
- STATUS checking is manual/fallible
- Batch tracking relies on agent memory

### Proposed Execute Flow (turboshovel)

1. User: `/execute plan.md` → `workflow start execute.workflow.md`
2. CLI creates workflow state in `.claude/turboshovel/workflows/`
3. Step 1: Load plan (hook injects current step context)
4. Step 3: Execute batch
   - Agent uses Task tool → **Hook registers task**
   - Subagent runs task-execution.workflow.md
   - Subagent completes → **Hook captures STATUS**
   - Hook sets `has_blocked_task` variable if BLOCKED
5. When batch tasks done → **Hook injects: "Run: workflow next"**
6. Agent: `workflow next`
7. Step 4: Code review (workflow enforces this step)
   - BLOCKED? Can't proceed to step 5
8. Loop via GOTO until `more_batches = false`
9. Step 7: Finish branch (enforced)

**Improvements:**
- Steps are enforced, not suggested
- Code review step cannot be skipped
- STATUS is captured by hooks, not agent interpretation
- Batch loop is formal GOTO, not agent memory
- BLOCKED status triggers automatic escalation context

---

## Part 6: Testing Examples

### Test 1: Basic Execute Flow

```markdown
# Test: Basic Execute Flow

**Setup:**
- Create plan.md with 2 tasks
- Run: workflow start execute.workflow.md

**Expected:**
1. Step 1: Load plan → CONTINUE
2. Step 2: Create TodoWrite → CONTINUE
3. Step 3: Execute batch
   - Task tool dispatched → Hook registers
   - Subagent completes with STATUS: OK → Hook updates
4. Step 4: Review batch → CONTINUE
5. Step 5: Report → CONTINUE
6. Step 6: more_batches = false → CONTINUE
7. Step 7: Finish → DONE
```

### Test 2: BLOCKED Escalation

```markdown
# Test: BLOCKED Escalation

**Setup:**
- Create plan.md with task that triggers BLOCKED
- Run: workflow start execute.workflow.md

**Expected:**
1. Step 3: Execute batch
   - Subagent reports STATUS: BLOCKED
   - Hook sets has_blocked_task = true
   - Workflow STOP: "Agent BLOCKED. Escalate to user."
2. Context injection shows BLOCKED reason + options
3. User selects action
4. workflow resume with updated state
```

### Test 3: Batch Loop

```markdown
# Test: Batch Loop

**Setup:**
- Create plan.md with 7 tasks (3 + 3 + 1)
- Run: workflow start execute.workflow.md

**Expected:**
1. Batch 1 (tasks 1-3): Execute → Review → Report
2. Step 6: more_batches = true → GOTO: 3
3. Batch 2 (tasks 4-6): Execute → Review → Report
4. Step 6: more_batches = true → GOTO: 3
5. Batch 3 (task 7): Execute → Review → Report
6. Step 6: more_batches = false → CONTINUE
7. Step 7: Finish → DONE
```

---

## Summary

This exercise validates the workflow system design v2 against a real complex workflow:

1. **Workflow files work:** The execute workflow maps cleanly to the markdown syntax
2. **Nested workflows needed:** task-batch, task-execution, code-review, finish-branch
3. **Hooks are essential:** Task tracking, SubagentStop handling, context injection
4. **CLI tool required:** workflow start/next/complete/status/stop
5. **Skills become thin:** executing-plans becomes workflow invocation
6. **Enforcement improves:** Mandatory code review step cannot be skipped
7. **State survives:** Workflow state in files, not agent memory

**Ready for implementation once workflow system is built.**
