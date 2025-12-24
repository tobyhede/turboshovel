# Workflow Orchestration: State Layer

> **For Claude:** Use cipherpowers:executing-plans (or execute tasks manually if preferred) to implement this plan task-by-task.

**Goal:** Add state manager methods for pending task queue, agent binding, and stash/pop operations.

**Architecture:** Extend WorkflowStateManager with queue operations (FIFO) and binding management. Session class gets stash/pop methods.

**Tech Stack:** TypeScript, file-based JSON persistence

**Prerequisite:** Complete 01-foundation-types.md first

---

## Task 1: Add pushPendingTask Method

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Step 1: Write failing test for pushPendingTask**

Add to `__tests__/workflow/state.test.ts` **inside the existing `describe('WorkflowStateManager')` block**. The `manager` fixture is already instantiated via `beforeEach` (lines 12-16). Add the `TaskId` import at the top of the file:

```typescript
// Add to imports at top of file:
import type { TaskId } from '../../src/workflow/task-id';

describe('WorkflowStateManager.pushPendingTask', () => {
  it('adds task to empty pending queue', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    const taskId: TaskId = { task: 3, subtask: 'A' };

    await manager.pushPendingTask(state.id, taskId);

    const updated = await manager.load(state.id);
    expect(updated?.pendingTasks).toEqual([{ task: 3, subtask: 'A' }]);
  });

  it('appends to existing pending queue (FIFO)', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');

    await manager.pushPendingTask(state.id, { task: 1 });
    await manager.pushPendingTask(state.id, { task: 2 });
    await manager.pushPendingTask(state.id, { task: 3, subtask: 'A' });

    const updated = await manager.load(state.id);
    expect(updated?.pendingTasks).toEqual([
      { task: 1 },
      { task: 2 },
      { task: 3, subtask: 'A' },
    ]);
  });

  it('throws for non-existent workflow', async () => {
    await expect(
      manager.pushPendingTask('non-existent', { task: 1 })
    ).rejects.toThrow('Workflow non-existent not found');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: FAIL - pushPendingTask is not a function

**Step 3: Implement pushPendingTask**

Add to `WorkflowStateManager` class in `state.ts`:

```typescript
import type { TaskId } from './task-id';

// ... existing code ...

/**
 * Push task to pending queue (FIFO - first in, first out)
 */
async pushPendingTask(id: string, taskId: TaskId): Promise<void> {
  const state = await this.load(id);
  if (!state) {
    throw new Error(`Workflow ${id} not found`);
  }

  await this.update(id, {
    pendingTasks: [...(state.pendingTasks || []), taskId],
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/state.ts __tests__/workflow/state.test.ts && git commit -m "feat(workflow): add pushPendingTask for queue management"
```

---

## Task 2: Add popPendingTask Method

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Step 1: Write failing test for popPendingTask**

Add **inside the existing `describe('WorkflowStateManager')` block** (uses shared `manager` fixture from `beforeEach`):

```typescript
describe('popPendingTask', () => {
  it('returns null for empty queue', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');

    const popped = await manager.popPendingTask(state.id);

    expect(popped).toBeNull();
  });

  it('returns and removes first task (FIFO)', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.pushPendingTask(state.id, { task: 1 });
    await manager.pushPendingTask(state.id, { task: 2 });

    const first = await manager.popPendingTask(state.id);
    expect(first).toEqual({ task: 1 });

    const updated = await manager.load(state.id);
    expect(updated?.pendingTasks).toEqual([{ task: 2 }]);
  });

  it('returns null for non-existent workflow', async () => {
    const result = await manager.popPendingTask('non-existent');
    expect(result).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: FAIL - popPendingTask is not a function

**Step 3: Implement popPendingTask**

Add to `WorkflowStateManager` class:

```typescript
/**
 * Pop task from pending queue (FIFO - returns first, removes it)
 * Returns null if queue is empty or workflow not found
 */
async popPendingTask(id: string): Promise<TaskId | null> {
  const state = await this.load(id);
  if (!state || !state.pendingTasks?.length) {
    return null;
  }

  const [first, ...rest] = state.pendingTasks;
  await this.update(id, { pendingTasks: rest });
  return first;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/state.ts __tests__/workflow/state.test.ts && git commit -m "feat(workflow): add popPendingTask for queue management"
```

---

## Task 3: Add bindAgent Method

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Step 1: Write failing test for bindAgent**

Add **inside the existing `describe('WorkflowStateManager')` block** (uses shared `manager` fixture and `TaskId` import from Task 1):

```typescript
describe('bindAgent', () => {
  it('creates agent binding with running status', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    const taskId: TaskId = { task: 3, subtask: 'A' };

    await manager.bindAgent(state.id, 'agent-xyz', taskId);

    const updated = await manager.load(state.id);
    expect(updated?.agentBindings['agent-xyz']).toEqual({
      taskId: { task: 3, subtask: 'A' },
      status: 'running',
    });
  });

  it('allows multiple agent bindings', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');

    await manager.bindAgent(state.id, 'agent-1', { task: 1 });
    await manager.bindAgent(state.id, 'agent-2', { task: 2 });

    const updated = await manager.load(state.id);
    expect(Object.keys(updated?.agentBindings || {})).toHaveLength(2);
  });

  it('throws for non-existent workflow', async () => {
    await expect(
      manager.bindAgent('non-existent', 'agent-x', { task: 1 })
    ).rejects.toThrow('Workflow non-existent not found');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: FAIL - bindAgent is not a function

**Step 3: Implement bindAgent**

Add to `WorkflowStateManager` class:

```typescript
import type { AgentBinding } from './types';

/**
 * Bind agent to task
 */
async bindAgent(id: string, agentId: string, taskId: TaskId): Promise<void> {
  const state = await this.load(id);
  if (!state) {
    throw new Error(`Workflow ${id} not found`);
  }

  const binding: AgentBinding = {
    taskId,
    status: 'running',
  };

  await this.update(id, {
    agentBindings: {
      ...(state.agentBindings || {}),
      [agentId]: binding,
    },
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/state.ts __tests__/workflow/state.test.ts && git commit -m "feat(workflow): add bindAgent for agent-task correlation"
```

---

## Task 4: Add getAgentBinding and updateAgentBinding Methods

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Step 1: Write failing tests**

Add **inside the existing `describe('WorkflowStateManager')` block** (uses shared `manager` fixture):

```typescript
describe('getAgentBinding', () => {
  it('returns binding for existing agent', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.bindAgent(state.id, 'agent-xyz', { task: 3 });

    const binding = await manager.getAgentBinding(state.id, 'agent-xyz');

    expect(binding).toEqual({
      taskId: { task: 3 },
      status: 'running',
    });
  });

  it('returns null for non-existent agent', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');

    const binding = await manager.getAgentBinding(state.id, 'unknown-agent');

    expect(binding).toBeNull();
  });

  it('returns null for non-existent workflow', async () => {
    const binding = await manager.getAgentBinding('non-existent', 'agent-x');
    expect(binding).toBeNull();
  });
});

describe('updateAgentBinding', () => {
  it('updates status to done with result', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.bindAgent(state.id, 'agent-xyz', { task: 3 });

    await manager.updateAgentBinding(state.id, 'agent-xyz', {
      status: 'done',
      result: 'pass',
    });

    const binding = await manager.getAgentBinding(state.id, 'agent-xyz');
    expect(binding?.status).toBe('done');
    expect(binding?.result).toBe('pass');
  });

  it('preserves taskId when updating', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.bindAgent(state.id, 'agent-xyz', { task: 3, subtask: 'A' });

    await manager.updateAgentBinding(state.id, 'agent-xyz', { status: 'done' });

    const binding = await manager.getAgentBinding(state.id, 'agent-xyz');
    expect(binding?.taskId).toEqual({ task: 3, subtask: 'A' });
  });

  it('throws for non-existent agent', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');

    await expect(
      manager.updateAgentBinding(state.id, 'unknown', { status: 'done' })
    ).rejects.toThrow('No binding for agent unknown');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: FAIL - methods not defined

**Step 3: Implement getAgentBinding and updateAgentBinding**

Add to `WorkflowStateManager` class:

```typescript
/**
 * Get agent binding by agent ID
 */
async getAgentBinding(id: string, agentId: string): Promise<AgentBinding | null> {
  const state = await this.load(id);
  return state?.agentBindings?.[agentId] || null;
}

/**
 * Update agent binding status/result
 */
async updateAgentBinding(
  id: string,
  agentId: string,
  updates: Partial<Pick<AgentBinding, 'status' | 'result' | 'childWorkflowId'>>
): Promise<void> {
  const state = await this.load(id);
  if (!state) {
    throw new Error(`Workflow ${id} not found`);
  }

  const existing = state.agentBindings?.[agentId];
  if (!existing) {
    throw new Error(`No binding for agent ${agentId}`);
  }

  await this.update(id, {
    agentBindings: {
      ...(state.agentBindings || {}),
      [agentId]: { ...existing, ...updates },
    },
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/state.ts __tests__/workflow/state.test.ts && git commit -m "feat(workflow): add getAgentBinding and updateAgentBinding methods"
```

---

## Task 5: Add stash Method

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

> **Concurrency Note:** The session file (`session.json`) is accessed without file locking. This assumes single-process access (one Claude Code session per project). Concurrent access from multiple processes may cause race conditions. This is acceptable for the current use case where hooks run synchronously within a single session.

**Step 1: Write failing tests for stash**

Add **inside the existing `describe('WorkflowStateManager')` block** (uses shared `manager` fixture):

```typescript
describe('stash', () => {
  it('moves active workflow to stashed and clears active', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.setActive(state.id);

    const stashedId = await manager.stash();

    expect(stashedId).toBe(state.id);

    // Active should be null
    const active = await manager.getActive();
    expect(active).toBeNull();
  });

  it('returns null when no active workflow', async () => {
    await manager.setActive(null);

    const stashedId = await manager.stash();

    expect(stashedId).toBeNull();
  });

  it('preserves workflow state when stashed', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: 3 });

    await manager.stash();

    // Workflow still exists with its state
    const loaded = await manager.load(state.id);
    expect(loaded?.pendingTasks).toEqual([{ task: 3 }]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: FAIL - stash is not a function

**Step 3: Implement stash**

Add to `WorkflowStateManager` class:

```typescript
/**
 * Stash current workflow (pause enforcement)
 * Moves active_workflow to stashedWorkflowId, clears active
 * Returns stashed workflow ID or null if nothing to stash
 */
async stash(): Promise<string | null> {
  const session = await this.loadSession();
  const activeId = session.active_workflow;

  if (!activeId) {
    return null;
  }

  session.active_workflow = null;
  session.stashedWorkflowId = activeId;
  await this.saveSession(session);

  return activeId;
}

private async loadSession(): Promise<{
  active_workflow: string | null;
  stashedWorkflowId?: string;
}> {
  try {
    const content = await fs.readFile(this.sessionPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return { active_workflow: null };
  }
}

private async saveSession(session: {
  active_workflow: string | null;
  stashedWorkflowId?: string;
}): Promise<void> {
  await fs.mkdir(path.dirname(this.sessionPath), { recursive: true });
  await fs.writeFile(this.sessionPath, JSON.stringify(session, null, 2));
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/state.ts __tests__/workflow/state.test.ts && git commit -m "feat(workflow): add stash method to pause enforcement"
```

---

## Task 6: Add pop Method

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Step 1: Write failing tests for pop**

Add **inside the existing `describe('WorkflowStateManager')` block** (uses shared `manager` fixture):

```typescript
describe('pop', () => {
  it('restores stashed workflow to active', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.setActive(state.id);
    await manager.stash();

    const restored = await manager.pop();

    expect(restored?.id).toBe(state.id);

    // Should be active again
    const active = await manager.getActive();
    expect(active?.id).toBe(state.id);
  });

  it('returns null when nothing stashed', async () => {
    const restored = await manager.pop();
    expect(restored).toBeNull();
  });

  it('clears stashedWorkflowId after pop', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.setActive(state.id);
    await manager.stash();

    await manager.pop();

    // Trying to pop again should return null
    const secondPop = await manager.pop();
    expect(secondPop).toBeNull();
  });

  it('returns null if stashed workflow was deleted', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.setActive(state.id);
    await manager.stash();

    // Delete the workflow
    await manager.delete(state.id);

    const restored = await manager.pop();
    expect(restored).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: FAIL - pop is not a function

**Step 3: Implement pop**

Add to `WorkflowStateManager` class:

```typescript
/**
 * Pop stashed workflow (resume enforcement)
 * Restores stashedWorkflowId to active_workflow, clears stash
 * Returns restored workflow state or null if nothing stashed
 */
async pop(): Promise<WorkflowState | null> {
  const session = await this.loadSession();
  const stashedId = session.stashedWorkflowId;

  if (!stashedId) {
    return null;
  }

  const state = await this.load(stashedId);
  if (!state) {
    // Stashed workflow was deleted, clean up
    session.stashedWorkflowId = undefined;
    await this.saveSession(session);
    return null;
  }

  // Restore to active
  session.active_workflow = stashedId;
  session.stashedWorkflowId = undefined;
  await this.saveSession(session);

  return state;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/state.ts __tests__/workflow/state.test.ts && git commit -m "feat(workflow): add pop method to resume enforcement"
```

---

## Task 7: Add getStashedWorkflowId Method

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Step 1: Write failing test**

Add **inside the existing `describe('WorkflowStateManager')` block** (uses shared `manager` fixture):

```typescript
describe('getStashedWorkflowId', () => {
  it('returns stashed ID when workflow is stashed', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    await manager.setActive(state.id);
    await manager.stash();

    const stashedId = await manager.getStashedWorkflowId();

    expect(stashedId).toBe(state.id);
  });

  it('returns null when nothing stashed', async () => {
    const stashedId = await manager.getStashedWorkflowId();
    expect(stashedId).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: FAIL - getStashedWorkflowId is not a function

**Step 3: Implement getStashedWorkflowId**

Add to `WorkflowStateManager` class:

```typescript
/**
 * Get the ID of the currently stashed workflow
 */
async getStashedWorkflowId(): Promise<string | null> {
  const session = await this.loadSession();
  return session.stashedWorkflowId || null;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test --no-coverage`
Expected: PASS (all tests green)

**Step 6: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/state.ts __tests__/workflow/state.test.ts && git commit -m "feat(workflow): add getStashedWorkflowId for enforcement checks"
```

---

## Exit Criteria

Before proceeding to next plan, verify ALL of the following:

| Criterion | Verification Command |
|-----------|---------------------|
| Task queue persists across restarts | Create workflow, push task, reload manager, verify task still in queue |
| FIFO order maintained | Push A, B, C; pop returns A first |
| Agent binding persists | Bind agent, reload, verify binding exists |
| Stash clears active workflow | Stash, getActive() returns null |
| Pop restores workflow | Pop, getActive() returns stashed workflow |
| All state methods tested | `npm test -- --testPathPattern="workflow/state" --no-coverage` passes |
| All tests pass | `npm test --no-coverage` exits 0 |
| Build succeeds | `npm run build` exits 0 |

**Manual verification (run in node REPL):**
```javascript
const { WorkflowStateManager } = require('./dist/workflow/state');
const m = new WorkflowStateManager(process.cwd());
// Create, push, reload, verify queue persists
```

---

## Summary

After completing this plan:
- [x] pushPendingTask - add task to queue
- [x] popPendingTask - remove and return first task
- [x] bindAgent - create agent-task binding
- [x] getAgentBinding - lookup binding by agent ID
- [x] updateAgentBinding - update status/result
- [x] stash - pause enforcement
- [x] pop - resume enforcement
- [x] getStashedWorkflowId - check stash status

**Next Plan:** 03-cli-commands.md - CLI command extensions
