# Variable Substitution in SubagentStart Hook

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substitute `$n` placeholders in workflow prompts with subtask numbers when injecting context to subagents.

**Architecture:** The SubagentStart hook loads the workflow file, finds the matching task/subtask prompt, substitutes `$n` → subtask number, and injects the result as part of agent context.

**Tech Stack:** TypeScript, Node.js fs/promises, existing parseWorkflow from parser.ts

---

## Task 1: Add substituteVariables Helper

**Files:**
- Create: `src/workflow/hooks/substitute.ts`
- Test: `__tests__/workflow/hooks/substitute.test.ts`

**Step 1: Write the failing test**

Create `__tests__/workflow/hooks/substitute.test.ts`:

```typescript
import { substituteVariables } from '../../../src/workflow/hooks/substitute';
import { createTaskNumber } from '../../../src/workflow/types';
import type { TaskId } from '../../../src/workflow/task-id';

describe('substituteVariables', () => {
  it('substitutes $n with subtask number', () => {
    const prompt = 'You are agent $n. Log agent-$n-started.';
    const taskId: TaskId = { task: createTaskNumber(2)!, subtask: '1' };

    const result = substituteVariables(prompt, taskId);

    expect(result).toBe('You are agent 1. Log agent-1-started.');
  });

  it('returns prompt unchanged when no subtask', () => {
    const prompt = 'You are agent $n.';
    const taskId: TaskId = { task: createTaskNumber(2)! };

    const result = substituteVariables(prompt, taskId);

    expect(result).toBe('You are agent $n.');
  });

  it('returns prompt unchanged when no $n placeholder', () => {
    const prompt = 'Execute the task.';
    const taskId: TaskId = { task: createTaskNumber(2)!, subtask: '1' };

    const result = substituteVariables(prompt, taskId);

    expect(result).toBe('Execute the task.');
  });

  it('substitutes multiple $n occurrences', () => {
    const prompt = 'Agent $n starts. Agent $n logs. Agent $n ends.';
    const taskId: TaskId = { task: createTaskNumber(2)!, subtask: '3' };

    const result = substituteVariables(prompt, taskId);

    expect(result).toBe('Agent 3 starts. Agent 3 logs. Agent 3 ends.');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/core && npm test -- --testPathPattern=substitute.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/workflow/hooks/substitute.ts`:

```typescript
import type { TaskId } from '../task-id';

/**
 * Substitute workflow variables in a prompt string.
 *
 * Currently supported:
 * - $n → subtask number (e.g., "1", "2", "3")
 *
 * @param prompt - The prompt template containing $n placeholders
 * @param taskId - The TaskId with optional subtask
 * @returns The prompt with $n replaced by subtask number
 */
export function substituteVariables(prompt: string, taskId: TaskId): string {
  if (!taskId.subtask) {
    return prompt;
  }
  return prompt.replace(/\$n/g, taskId.subtask);
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/core && npm test -- --testPathPattern=substitute.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/core/src/workflow/hooks/substitute.ts plugin/core/__tests__/workflow/hooks/substitute.test.ts
git commit -m "feat(workflow): add substituteVariables helper for prompt variable substitution"
```

---

## Task 2: Add getTaskPrompt Helper

**Files:**
- Modify: `src/workflow/hooks/substitute.ts`
- Modify: `__tests__/workflow/hooks/substitute.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/workflow/hooks/substitute.test.ts`:

```typescript
import { substituteVariables, getTaskPrompt } from '../../../src/workflow/hooks/substitute';
import { createTaskNumber, type Task } from '../../../src/workflow/types';
import type { TaskId } from '../../../src/workflow/task-id';

// ... existing tests ...

describe('getTaskPrompt', () => {
  const tasks: Task[] = [
    {
      number: createTaskNumber(1)!,
      description: 'Initialize',
      prompts: [{ text: 'Set up the environment.' }]
    },
    {
      number: createTaskNumber(2)!,
      description: 'Parallel Tasks',
      prompts: [{ text: 'You are agent $n. Log agent-$n-started.' }],
      subtasks: [
        { id: '{n}', description: 'Dynamic subtask', isDynamic: true }
      ]
    },
    {
      number: createTaskNumber(3)!,
      description: 'No prompts',
      prompts: []
    }
  ];

  it('returns prompt for matching task', () => {
    const taskId: TaskId = { task: createTaskNumber(2)!, subtask: '1' };

    const result = getTaskPrompt(tasks, taskId);

    expect(result).toBe('You are agent $n. Log agent-$n-started.');
  });

  it('returns undefined when task not found', () => {
    const taskId: TaskId = { task: createTaskNumber(99)! };

    const result = getTaskPrompt(tasks, taskId);

    expect(result).toBeUndefined();
  });

  it('returns undefined when task has no prompts', () => {
    const taskId: TaskId = { task: createTaskNumber(3)! };

    const result = getTaskPrompt(tasks, taskId);

    expect(result).toBeUndefined();
  });

  it('returns first prompt when multiple exist', () => {
    const tasksWithMultiple: Task[] = [{
      number: createTaskNumber(1)!,
      description: 'Multi-prompt',
      prompts: [{ text: 'First prompt.' }, { text: 'Second prompt.' }]
    }];
    const taskId: TaskId = { task: createTaskNumber(1)! };

    const result = getTaskPrompt(tasksWithMultiple, taskId);

    expect(result).toBe('First prompt.');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/core && npm test -- --testPathPattern=substitute.test.ts`
Expected: FAIL with "getTaskPrompt is not exported"

**Step 3: Write minimal implementation**

Add to `src/workflow/hooks/substitute.ts`:

```typescript
import type { TaskId } from '../task-id';
import type { Task } from '../types';

/**
 * Substitute workflow variables in a prompt string.
 * ... existing function ...
 */
export function substituteVariables(prompt: string, taskId: TaskId): string {
  if (!taskId.subtask) {
    return prompt;
  }
  return prompt.replace(/\$n/g, taskId.subtask);
}

/**
 * Get the prompt for a task from parsed workflow tasks.
 *
 * @param tasks - Parsed tasks from workflow
 * @param taskId - The TaskId to find prompt for
 * @returns The first prompt text, or undefined if not found
 */
export function getTaskPrompt(tasks: readonly Task[], taskId: TaskId): string | undefined {
  const task = tasks.find(t => t.number === taskId.task);
  if (!task || task.prompts.length === 0) {
    return undefined;
  }
  return task.prompts[0].text;
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/core && npm test -- --testPathPattern=substitute.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/core/src/workflow/hooks/substitute.ts plugin/core/__tests__/workflow/hooks/substitute.test.ts
git commit -m "feat(workflow): add getTaskPrompt helper to extract prompt from parsed tasks"
```

---

## Task 3: Update formatAgentContext to Include Prompt

**Files:**
- Modify: `src/workflow/hooks/subagent-start.ts`
- Modify: `__tests__/workflow/hooks/subagent-start.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/workflow/hooks/subagent-start.test.ts`:

```typescript
describe('handleSubagentStart with prompt injection', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-start-prompt-test-'));
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('includes substituted prompt in context', async () => {
    // Create workflow file with prompt containing $n
    const workflowContent = `
## 1. Initialize

Setup task.

- PASS: CONTINUE
- FAIL: STOP

## 2. Parallel Tasks

### 2.{n}

**Prompt:** You are agent $n. Append "agent-$n-started" to the log.

- PASS: CONTINUE
- FAIL: STOP
`;
    await fs.writeFile(path.join(testDir, 'test.workflow.md'), workflowContent);

    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(2)!, subtask: '1' });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz-123'
    };

    const result = await handleSubagentStart(input);

    expect(result.context).toContain('TASK_ID: 2.1');
    expect(result.context).toContain('## Task Prompt');
    expect(result.context).toContain('You are agent 1.');
    expect(result.context).toContain('agent-1-started');
    expect(result.context).not.toContain('$n');
  });

  it('works without prompt when workflow file not found', async () => {
    // Workflow file doesn't exist
    const state = await manager.create('nonexistent.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(2)!, subtask: '1' });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz-123'
    };

    const result = await handleSubagentStart(input);

    expect(result.context).toContain('AGENT_ID: agent-xyz-123');
    expect(result.context).toContain('TASK_ID: 2.1');
    // Should not crash, just omit prompt section
    expect(result.violation).toBeUndefined();
  });

  it('works without prompt when task has no prompts', async () => {
    const workflowContent = `
## 1. Command Task

\`\`\`bash
echo "hello"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`;
    await fs.writeFile(path.join(testDir, 'test.workflow.md'), workflowContent);

    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(1)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz-123'
    };

    const result = await handleSubagentStart(input);

    expect(result.context).toContain('AGENT_ID: agent-xyz-123');
    expect(result.context).not.toContain('## Task Prompt');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/core && npm test -- --testPathPattern=subagent-start.test.ts`
Expected: FAIL with "## Task Prompt" not found

**Step 3: Update handleSubagentStart implementation**

Update `src/workflow/hooks/subagent-start.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkflowStateManager } from '../state';
import { taskIdToString, type TaskId } from '../task-id';
import { parseWorkflow } from '../parser/parser';
import { substituteVariables, getTaskPrompt } from './substitute';
import type { HookInput } from '../../types';

export interface SubagentStartResult {
  context?: string;
  violation?: string;
}

/**
 * Handle SubagentStart hook
 *
 * Flow:
 * 1. Pop pending task from queue
 * 2. Bind agent_id to TaskId
 * 3. Load workflow and find task prompt
 * 4. Substitute $n with subtask number
 * 5. Inject agent context with substituted prompt
 */
export async function handleSubagentStart(input: HookInput): Promise<SubagentStartResult> {
  if (input.hook_event_name !== 'SubagentStart') {
    return {};
  }

  const agentId = input.agent_id;
  if (!agentId) {
    return {}; // No agent_id available, skip (graceful degradation)
  }

  const manager = new WorkflowStateManager(input.cwd);

  try {
    const state = await manager.getActive();

    // No active workflow = pass through silently
    if (!state) {
      return {};
    }

    // Check if workflow is stashed
    const stashedId = await manager.getStashedWorkflowId();
    if (stashedId) {
      return {}; // Enforcement paused
    }

    // Pop pending task
    const taskId = await manager.popPendingTask(state.id);

    // VIOLATION: No pending task
    if (!taskId) {
      return {
        violation:
          `SubagentStart with no pending task. ` +
          `Task dispatch must precede agent start. ` +
          `Ensure Task tool is used before subagent starts.`
      };
    }

    // Bind agent to task
    await manager.bindAgent(state.id, agentId, taskId);

    // Load workflow and get substituted prompt
    const prompt = await loadAndSubstitutePrompt(input.cwd, state.workflow, taskId);

    // Inject context for subagent
    const context = formatAgentContext(agentId, taskId, prompt);

    return { context };
  } catch (error) {
    console.error('Failed to handle subagent start:', error);
    return {};
  }
}

/**
 * Load workflow file, parse it, find task prompt, and substitute variables.
 * Returns undefined on any error (graceful degradation).
 */
async function loadAndSubstitutePrompt(
  cwd: string,
  workflowPath: string,
  taskId: TaskId
): Promise<string | undefined> {
  try {
    const fullPath = path.join(cwd, workflowPath);
    const content = await fs.readFile(fullPath, 'utf8');
    const tasks = parseWorkflow(content);
    const prompt = getTaskPrompt(tasks, taskId);

    if (!prompt) {
      return undefined;
    }

    return substituteVariables(prompt, taskId);
  } catch {
    // Workflow file not found or parse error - graceful degradation
    return undefined;
  }
}

function formatAgentContext(agentId: string, taskId: TaskId, prompt?: string): string {
  const lines = [
    '## Workflow Agent Context',
    '',
    `AGENT_ID: ${agentId}`,
    `TASK_ID: ${taskIdToString(taskId)}`,
    ''
  ];

  if (prompt) {
    lines.push('## Task Prompt', '', prompt, '');
  }

  lines.push(
    '## Commands',
    '',
    `workflow next --pass --agent ${agentId}`,
    `workflow next --fail --agent ${agentId}`,
    ''
  );

  return lines.join('\n');
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/core && npm test -- --testPathPattern=subagent-start.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/core/src/workflow/hooks/subagent-start.ts plugin/core/__tests__/workflow/hooks/subagent-start.test.ts
git commit -m "feat(workflow): inject substituted prompt in SubagentStart context"
```

---

## Task 4: Run Full Test Suite and Lint

**Files:**
- None (verification only)

**Step 1: Run full test suite**

Run: `cd plugin/core && npm test`
Expected: All tests pass

**Step 2: Run lint**

Run: `cd plugin/core && npm run lint`
Expected: No errors (warnings acceptable)

**Step 3: Build**

Run: `cd plugin/core && npm run build`
Expected: Build succeeds

**Step 4: Commit any fixes if needed**

If any tests or lint issues, fix them and commit.

---

## Task 5: Update ISSUES.md

**Files:**
- Modify: `.work/ISSUES.md`

**Step 1: Mark Issue 4 as resolved**

Update the status of Issue 4 in `.work/ISSUES.md`:

```markdown
## Issue 4: Variable Substitution Not Implemented

**Status:** ~~Missing Feature~~ **FIXED**
**Severity:** High
**Location:** `src/workflow/hooks/subagent-start.ts`, `src/workflow/hooks/substitute.ts`

~~The `$n` placeholder in prompt templates is not substituted...~~

**Resolution:** Implemented in SubagentStart hook. The hook now:
1. Loads workflow file from `state.workflow`
2. Parses to find matching task prompt
3. Substitutes `$n` → `taskId.subtask`
4. Injects substituted prompt in agent context
```

**Step 2: Commit**

```bash
git add .work/ISSUES.md
git commit -m "docs: mark variable substitution issue as resolved"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add substituteVariables helper | `substitute.ts`, `substitute.test.ts` |
| 2 | Add getTaskPrompt helper | `substitute.ts`, `substitute.test.ts` |
| 3 | Update SubagentStart to inject prompt | `subagent-start.ts`, `subagent-start.test.ts` |
| 4 | Run tests, lint, build | Verification |
| 5 | Update ISSUES.md | `.work/ISSUES.md` |
