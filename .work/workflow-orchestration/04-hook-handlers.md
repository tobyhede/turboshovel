# Workflow Orchestration: Hook Handlers

> **For Claude:** Use cipherpowers:executing-plans (or execute tasks manually if preferred) to implement this plan task-by-task.

**Goal:** Implement hook handlers for task correlation and enforcement mode.

**Architecture:** PostToolUse parses TaskId and queues; SubagentStart binds agent; SubagentStop updates binding. Enforcement mode blocks violations.

**Tech Stack:** TypeScript, hook system

**Prerequisite:** Complete 03-cli-commands.md first

---

## Task 1: Update HookInput Type for New Fields

**Files:**
- Modify: `plugin/hooks/hooks-app/src/types.ts:1-23`
- Test: `plugin/hooks/hooks-app/__tests__/types.test.ts`

**Step 1: Write failing test for new HookInput fields**

Add to `__tests__/types.test.ts`:

```typescript
describe('HookInput subagent fields', () => {
  it('includes agent_id field', () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: '/test',
      agent_id: 'agent-abc-123',
    };
    expect(input.agent_id).toBe('agent-abc-123');
  });

  it('includes tool_input for Task tool', () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: '/test',
      tool_name: 'Task',
      tool_input: {
        description: '3.A - Review code',
        subagent_type: 'code-review-agent',
      },
    };
    expect(input.tool_input?.description).toBe('3.A - Review code');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="types.test" --no-coverage`
Expected: FAIL - agent_id, tool_input not in type

**Step 3: Update HookInput interface**

Update `src/types.ts`:

```typescript
export interface HookInput {
  hook_event_name: string;
  cwd: string;

  // PostToolUse
  tool_name?: string;
  file_path?: string;

  // PostToolUse - Task tool
  tool_input?: {
    description?: string;
    subagent_type?: string;
    prompt?: string;
  };

  // SubagentStart/SubagentStop
  agent_id?: string;
  agent_name?: string;
  subagent_name?: string;
  output?: string;
  agent_transcript_path?: string;

  // UserPromptSubmit
  user_message?: string;

  // SlashCommand/Skill
  command?: string;
  skill?: string;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="types.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/types.ts __tests__/types.test.ts && git commit -m "feat(types): add agent_id and tool_input to HookInput"
```

---

## Task 2: Rewrite task-tracker.ts with TaskId Parsing

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/hooks/task-tracker.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/hooks/task-tracker.test.ts`

**Step 1: Write failing tests for TaskId parsing**

Update `__tests__/workflow/hooks/task-tracker.test.ts`. First set up shared fixtures:

```typescript
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { trackTaskDispatch, type TaskDispatchResult } from '../../../src/workflow/hooks/task-tracker';
import { WorkflowStateManager } from '../../../src/workflow/state';
import type { HookInput } from '../../../src/types';

describe('trackTaskDispatch with TaskId', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = join(tmpdir(), `task-tracker-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('parses TaskId from description and pushes to queue', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: {
        description: '3.A - Review code changes',
        subagent_type: 'code-review-agent',
      },
    };

    const result = await trackTaskDispatch(input);

    expect(result.taskId).toEqual({ task: 3, subtask: 'A' });

    const updated = await manager.getActive();
    expect(updated?.pendingTasks).toContainEqual({ task: 3, subtask: 'A' });
  });

  it('returns violation for missing TaskId prefix in enforcement mode', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: {
        description: 'Review the code without task prefix',
      },
    };

    const result = await trackTaskDispatch(input);

    expect(result.violation).toContain('must start with TaskId');
  });

  it('passes through when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: { description: 'Any description' },
    };

    const result = await trackTaskDispatch(input);

    expect(result.taskId).toBeUndefined();
    expect(result.violation).toBeUndefined();
  });

  it('passes through when workflow is stashed', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.stash();

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: { description: 'No prefix needed when stashed' },
    };

    const result = await trackTaskDispatch(input);

    expect(result.violation).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="task-tracker" --no-coverage`
Expected: FAIL - TaskDispatchResult not exported, behavior different

**Step 3: Rewrite task-tracker.ts**

```typescript
// src/workflow/hooks/task-tracker.ts
import { WorkflowStateManager } from '../state';
import { parseTaskId, taskIdToString, type TaskId } from '../task-id';
import type { HookInput } from '../../types';

export interface TaskDispatchResult {
  taskId?: TaskId;
  violation?: string;
}

/**
 * Track Task tool dispatches in workflow state
 *
 * When workflow is active:
 * 1. Parse TaskId from tool_input.description
 * 2. If no TaskId prefix, return violation (enforcement)
 * 3. Push TaskId to pending queue
 *
 * When no workflow or stashed: pass through silently
 */
export async function trackTaskDispatch(input: HookInput): Promise<TaskDispatchResult> {
  // Only handle Task tool
  if (input.tool_name !== 'Task') {
    return {};
  }

  const manager = new WorkflowStateManager(input.cwd);

  try {
    const state = await manager.getActive();

    // No active workflow = pass through silently (enforcement off)
    if (!state) {
      return {};
    }

    // Check if workflow is stashed (enforcement paused)
    const stashedId = await manager.getStashedWorkflowId();
    if (stashedId) {
      return {}; // Enforcement paused
    }

    // Parse TaskId from description
    const description = input.tool_input?.description || '';
    const taskId = parseTaskId(description);

    // VIOLATION: Task without TaskId prefix
    if (!taskId) {
      return {
        violation:
          `Task description must start with TaskId (e.g., "3.A - Review code"). ` +
          `Got: "${description.substring(0, 60)}${description.length > 60 ? '...' : ''}"`,
      };
    }

    // Push to pending queue
    await manager.pushPendingTask(state.id, taskId);

    return { taskId };
  } catch (error) {
    // Log but don't throw - task tracking is non-critical
    console.error('Failed to track task dispatch:', error);
    return {};
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="task-tracker" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/hooks/task-tracker.ts __tests__/workflow/hooks/task-tracker.test.ts && git commit -m "feat(hooks): rewrite task-tracker with TaskId parsing and enforcement"
```

---

## Task 3: Create subagent-start.ts Handler

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/hooks/subagent-start.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/hooks/subagent-start.test.ts`

**Step 1: Write failing tests**

Create `__tests__/workflow/hooks/subagent-start.test.ts`:

```typescript
import { handleSubagentStart, type SubagentStartResult } from '../../../src/workflow/hooks/subagent-start';
import { WorkflowStateManager } from '../../../src/workflow/state';
import type { HookInput } from '../../../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('handleSubagentStart', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-start-test-'));
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('pops pending task and binds agent', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: 3, subtask: 'A' });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz-123',
    };

    const result = await handleSubagentStart(input);

    expect(result.context).toContain('AGENT_ID: agent-xyz-123');
    expect(result.context).toContain('TASK_ID: 3.A');

    const updated = await manager.getActive();
    expect(updated?.pendingTasks).toHaveLength(0);
    expect(updated?.agentBindings['agent-xyz-123']).toBeDefined();
  });

  it('returns violation when no pending task', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    // No pending tasks

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz',
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toContain('no pending task');
  });

  it('passes through when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz',
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
    expect(result.context).toBeUndefined();
  });

  it('passes through when no agent_id provided', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      // No agent_id
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
  });

  it('passes through when workflow is stashed', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.stash();

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz',
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="subagent-start" --no-coverage`
Expected: FAIL - module not found

**Step 3: Implement subagent-start.ts**

```typescript
// src/workflow/hooks/subagent-start.ts
import { WorkflowStateManager } from '../state';
import { taskIdToString, type TaskId } from '../task-id';
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
 * 3. Inject agent_id context for subagent
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
          `Ensure Task tool is used before subagent starts.`,
      };
    }

    // Bind agent to task
    await manager.bindAgent(state.id, agentId, taskId);

    // Inject context for subagent
    const context = formatAgentContext(agentId, taskId);

    return { context };
  } catch (error) {
    console.error('Failed to handle subagent start:', error);
    return {};
  }
}

function formatAgentContext(agentId: string, taskId: TaskId): string {
  return [
    '## Workflow Agent Context',
    '',
    `AGENT_ID: ${agentId}`,
    `TASK_ID: ${taskIdToString(taskId)}`,
    '',
    'If you need to run workflow commands, use:',
    `  workflow next --pass --agent ${agentId}`,
    `  workflow next --fail --agent ${agentId}`,
    '',
  ].join('\n');
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="subagent-start" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/hooks/subagent-start.ts __tests__/workflow/hooks/subagent-start.test.ts && git commit -m "feat(hooks): add SubagentStart handler for agent binding"
```

---

## Task 4: Rewrite subagent-stop.ts with Agent Lookup

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/hooks/subagent-stop.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/hooks/subagent-stop.test.ts`

**Step 1: Write failing tests**

Update `__tests__/workflow/hooks/subagent-stop.test.ts`:

```typescript
import { handleSubagentStop, type SubagentStopResult } from '../../../src/workflow/hooks/subagent-stop';

describe('handleSubagentStop with agent binding', () => {
  it('looks up agent by agent_id and updates binding', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: 2 });
    await manager.bindAgent(state.id, 'agent-xyz', { task: 2 });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-xyz',
      output: 'STATUS: OK',
    };

    const result = await handleSubagentStop(input);

    expect(result.context).toContain('complete');

    const updated = await manager.getActive();
    const binding = updated?.agentBindings['agent-xyz'];
    expect(binding?.status).toBe('done');
    expect(binding?.result).toBe('pass');
  });

  it('marks as fail when STATUS: BLOCKED', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.bindAgent(state.id, 'agent-abc', { task: 1 });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-abc',
      output: 'STATUS: BLOCKED\nCould not complete task.',
    };

    const result = await handleSubagentStop(input);

    expect(result.context).toContain('FAILED');

    const binding = await manager.getAgentBinding(state.id, 'agent-abc');
    expect(binding?.result).toBe('fail');
  });

  it('returns violation for unknown agent', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'unknown-agent',
    };

    const result = await handleSubagentStop(input);

    expect(result.violation).toContain('unknown agent');
  });

  it('defaults to pass when no STATUS in output', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.bindAgent(state.id, 'agent-xyz', { task: 1 });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-xyz',
      output: 'Task completed successfully.',
    };

    await handleSubagentStop(input);

    const binding = await manager.getAgentBinding(state.id, 'agent-xyz');
    expect(binding?.result).toBe('pass');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="subagent-stop" --no-coverage`
Expected: FAIL - behavior different

**Step 3: Rewrite subagent-stop.ts**

```typescript
// src/workflow/hooks/subagent-stop.ts
import { WorkflowStateManager } from '../state';
import { taskIdToString } from '../task-id';
import type { HookInput } from '../../types';
import type { AgentBinding } from '../types';

export interface SubagentStopResult {
  context?: string;
  violation?: string;
}

/**
 * Parse STATUS field from subagent output
 */
function parseAgentStatus(output?: string): 'pass' | 'fail' | null {
  if (!output) return null;

  // Look for STATUS: OK/PASS or STATUS: BLOCKED/FAIL
  const match = output.match(/STATUS:\s*(OK|PASS|BLOCKED|FAIL)/i);
  if (match) {
    const status = match[1].toUpperCase();
    return status === 'OK' || status === 'PASS' ? 'pass' : 'fail';
  }

  return null;
}

/**
 * Handle SubagentStop hook
 *
 * Flow:
 * 1. Lookup agent binding by agent_id
 * 2. Determine pass/fail from output
 * 3. Update binding status
 * 4. Report completion context
 */
export async function handleSubagentStop(input: HookInput): Promise<SubagentStopResult> {
  if (input.hook_event_name !== 'SubagentStop') {
    return {};
  }

  const agentId = input.agent_id;
  if (!agentId) {
    // Fall back to legacy behavior (find first running task)
    return handleLegacySubagentStop(input);
  }

  const manager = new WorkflowStateManager(input.cwd);

  try {
    const state = await manager.getActive();

    if (!state) {
      return {};
    }

    // Check if stashed
    const stashedId = await manager.getStashedWorkflowId();
    if (stashedId) {
      return {};
    }

    // Lookup agent binding
    const binding = await manager.getAgentBinding(state.id, agentId);

    // VIOLATION: Unknown agent
    if (!binding) {
      return {
        violation:
          `SubagentStop for unknown agent ${agentId}. ` +
          `Agent was not bound at SubagentStart.`,
      };
    }

    // Determine result
    const result = parseAgentStatus(input.output) || 'pass'; // Default to pass

    // Update binding
    await manager.updateAgentBinding(state.id, agentId, {
      status: 'done',
      result,
    });

    // Generate completion context
    const context = formatCompletionContext(state.id, binding, result, manager);

    return { context: await context };
  } catch (error) {
    console.error('Failed to handle subagent stop:', error);
    return { context: 'Warning: Failed to update workflow state.' };
  }
}

async function formatCompletionContext(
  workflowId: string,
  binding: AgentBinding,
  result: 'pass' | 'fail',
  manager: WorkflowStateManager
): Promise<string> {
  const taskIdStr = taskIdToString(binding.taskId);
  const lines: string[] = [];

  if (result === 'fail') {
    lines.push(`Task ${taskIdStr} FAILED.`);
  } else {
    lines.push(`Task ${taskIdStr} complete.`);
  }

  // Check how many agents still running
  const state = await manager.load(workflowId);
  if (state) {
    const bindings = Object.values(state.agentBindings || {});
    const running = bindings.filter(b => b.status === 'running').length;
    const done = bindings.filter(b => b.status === 'done').length;
    const failed = bindings.filter(b => b.result === 'fail').length;

    if (running > 0) {
      lines.push(`${done}/${done + running} tasks done. Waiting for ${running} more.`);
    } else {
      if (failed > 0) {
        lines.push(`All tasks complete. ${failed} failed.`);
        lines.push(`Run: workflow next --fail`);
      } else {
        lines.push(`All tasks complete.`);
        lines.push(`Run: workflow next --pass`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Legacy fallback: find first running task (for backwards compatibility)
 */
async function handleLegacySubagentStop(input: HookInput): Promise<SubagentStopResult> {
  const manager = new WorkflowStateManager(input.cwd);
  const state = await manager.getActive();

  if (!state) return {};

  // Find running task
  const runningIndex = state.tasks.findIndex(t => t.status === 'running');
  if (runningIndex === -1) return {};

  const isBlocked = parseAgentStatus(input.output) === 'fail';

  const updatedTasks = [...state.tasks];
  updatedTasks[runningIndex] = {
    ...updatedTasks[runningIndex],
    status: isBlocked ? 'blocked' : 'complete',
    completedAt: new Date().toISOString(),
  };

  await manager.update(state.id, { tasks: updatedTasks });

  if (isBlocked) {
    return { context: 'Task BLOCKED. Present options to user.' };
  }

  const allDone = updatedTasks.every(t => t.status !== 'running' && t.status !== 'pending');
  if (allDone) {
    return { context: 'All tasks complete. Run: workflow next' };
  }

  return {
    context: `Task complete. ${updatedTasks.filter(t => t.status === 'complete').length}/${updatedTasks.length} done.`,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="subagent-stop" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/hooks/subagent-stop.ts __tests__/workflow/hooks/subagent-stop.test.ts && git commit -m "feat(hooks): rewrite SubagentStop with agent binding lookup"
```

---

## Task 5: Update Hook Exports

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/hooks/index.ts`

**Step 1: Update exports**

```typescript
// src/workflow/hooks/index.ts
export { trackTaskDispatch, type TaskDispatchResult } from './task-tracker';
export { handleSubagentStart, type SubagentStartResult } from './subagent-start';
export { handleSubagentStop, type SubagentStopResult } from './subagent-stop';
```

**Step 2: Verify exports work**

Run: `cd plugin/hooks/hooks-app && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/hooks/index.ts && git commit -m "feat(hooks): export SubagentStart handler"
```

---

## Task 6: Update Dispatcher Integration

**Files:**
- Modify: `plugin/hooks/hooks-app/src/dispatcher.ts:233-244`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/dispatcher-integration.test.ts`

**Step 1: Write failing integration test**

Create `__tests__/workflow/dispatcher-integration.test.ts` with full fixture setup:

```typescript
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { dispatch } from '../../src/dispatcher';
import { WorkflowStateManager } from '../../src/workflow/state';
import type { HookInput } from '../../src/types';

describe('dispatcher with orchestration hooks', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = join(tmpdir(), `dispatcher-integration-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('returns violation when Task dispatched without TaskId', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
      tool_input: { description: 'Missing task prefix' },
    };

    const result = await dispatch(input);

    expect(result.blockReason).toContain('TaskId');
  });

  it('injects agent context on SubagentStart', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: 1 });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz',
    };

    const result = await dispatch(input);

    expect(result.context).toContain('AGENT_ID: agent-xyz');
  });

  it('returns violation on SubagentStop for unknown agent', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'unknown-agent',
    };

    const result = await dispatch(input);

    expect(result.blockReason).toContain('unknown agent');
  });
});  // End of describe block - closing brace added for completeness
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="dispatcher-integration" --no-coverage`
Expected: FAIL - violations not blocking

**Step 3: Update dispatcher.ts**

Update the workflow hooks section in `dispatcher.ts`:

```typescript
import {
  trackTaskDispatch,
  handleSubagentStart,
  handleSubagentStop,
} from './workflow/hooks';

// ... existing code ...

// Inside dispatch() function, after workflow context injection:

// Workflow orchestration hooks
if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Task') {
  const result = await trackTaskDispatch(input);
  if (result.violation) {
    return {
      context: accumulatedContext,
      blockReason: result.violation,
    };
  }
}

if (input.hook_event_name === 'SubagentStart') {
  const result = await handleSubagentStart(input);
  if (result.violation) {
    return {
      context: accumulatedContext,
      blockReason: result.violation,
    };
  }
  if (result.context) {
    accumulatedContext += '\n\n' + result.context;
  }
}

if (input.hook_event_name === 'SubagentStop') {
  const result = await handleSubagentStop(input);
  if (result.violation) {
    return {
      context: accumulatedContext,
      blockReason: result.violation,
    };
  }
  if (result.context) {
    accumulatedContext += '\n\n' + result.context;
  }
}
```

> **Formatting Note:** Context strings are joined with `\n\n` (double newline). Each handler's context should NOT start or end with extra newlines. The dispatcher will trim the final accumulated context before returning. If multiple hooks fire in sequence, this produces consistent paragraph separation without redundant blank lines.

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="dispatcher-integration" --no-coverage`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test --no-coverage`
Expected: PASS (all tests green)

**Step 6: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/dispatcher.ts __tests__/workflow/dispatcher-integration.test.ts && git commit -m "feat(dispatcher): integrate orchestration hooks with violation blocking"
```

---

## Exit Criteria

Before proceeding to next plan, verify ALL of the following:

| Criterion | Verification Command |
|-----------|---------------------|
| PostToolUse blocks missing TaskId | Dispatch Task without prefix -> returns blockReason |
| PostToolUse allows valid TaskId | Dispatch "3.A - desc" -> no blockReason, task queued |
| SubagentStart binds agent | Fire SubagentStart with agent_id -> binding created |
| SubagentStart blocks if no pending | Fire SubagentStart with empty queue -> returns blockReason |
| SubagentStart injects AGENT_ID context | Result.context contains "AGENT_ID:" |
| SubagentStop updates binding | Fire SubagentStop -> binding status is 'done' |
| SubagentStop blocks unknown agent | Fire with unknown agent_id -> returns blockReason |
| Stashed workflow bypasses enforcement | Stash, dispatch Task without prefix -> no block |
| Dispatcher integration tests pass | `npm test -- --testPathPattern="dispatcher-integration" --no-coverage` |
| All hook tests pass | `npm test -- --testPathPattern="hooks" --no-coverage` |
| All tests pass | `npm test --no-coverage` exits 0 |

**Integration verification:**
```typescript
// Test enforcement blocks invalid task
const result = await dispatch({
  hook_event_name: 'PostToolUse',
  cwd: testDir,
  tool_name: 'Task',
  tool_input: { description: 'Missing prefix' }
});
assert(result.blockReason?.includes('TaskId'));
```

---

## Summary

After completing this plan:
- [x] HookInput extended with agent_id, tool_input
- [x] task-tracker.ts parses TaskId and enforces prefix
- [x] subagent-start.ts binds agents and injects context
- [x] subagent-stop.ts looks up bindings and updates status
- [x] dispatcher integrates all handlers with violation blocking

**Next Plan:** 05-parser-subtasks.md - Parser changes for subtasks and aggregation
