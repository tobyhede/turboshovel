# Workflow Orchestration: Foundation Types

> **For Claude:** Use cipherpowers:executing-plans (or execute tasks manually if preferred) to implement this plan task-by-task.

**Goal:** Add core type definitions for workflow orchestration: TaskId, AgentBinding, extended WorkflowState.

**Architecture:** Extend existing types.ts with new interfaces and helper functions. All types are readonly for immutability.

**Tech Stack:** TypeScript, branded types pattern

---

## Task 1: Add TaskId Type and Helpers

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/task-id.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/task-id.test.ts`

**Step 1: Write failing tests for TaskId parsing**

```typescript
// __tests__/workflow/task-id.test.ts
import { parseTaskId, taskIdToString, taskIdEquals } from '../../src/workflow/task-id';

describe('parseTaskId', () => {
  it('parses simple task number from description', () => {
    const result = parseTaskId('3 - Review code');
    expect(result).toEqual({ task: 3 });
  });

  it('parses task with subtask letter', () => {
    const result = parseTaskId('3.A - First reviewer');
    expect(result).toEqual({ task: 3, subtask: 'A' });
  });

  it('normalizes lowercase subtask to uppercase', () => {
    const result = parseTaskId('2.b - Second task');
    expect(result).toEqual({ task: 2, subtask: 'B' });
  });

  it('parses task with dash separator', () => {
    const result = parseTaskId('1 - Simple task');
    expect(result).toEqual({ task: 1 });
  });

  it('parses task with colon separator', () => {
    const result = parseTaskId('5: Execute batch');
    expect(result).toEqual({ task: 5 });
  });

  it('returns null for description without task prefix', () => {
    const result = parseTaskId('Review the code changes');
    expect(result).toBeNull();
  });

  it('returns null for zero task number', () => {
    const result = parseTaskId('0 - Invalid');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseTaskId('');
    expect(result).toBeNull();
  });
});

describe('taskIdToString', () => {
  it('formats simple task', () => {
    expect(taskIdToString({ task: 3 })).toBe('3');
  });

  it('formats task with subtask', () => {
    expect(taskIdToString({ task: 3, subtask: 'A' })).toBe('3.A');
  });
});

describe('taskIdEquals', () => {
  it('returns true for equal simple tasks', () => {
    expect(taskIdEquals({ task: 3 }, { task: 3 })).toBe(true);
  });

  it('returns true for equal tasks with subtasks', () => {
    expect(taskIdEquals({ task: 3, subtask: 'A' }, { task: 3, subtask: 'A' })).toBe(true);
  });

  it('returns false for different task numbers', () => {
    expect(taskIdEquals({ task: 3 }, { task: 4 })).toBe(false);
  });

  it('returns false for different subtasks', () => {
    expect(taskIdEquals({ task: 3, subtask: 'A' }, { task: 3, subtask: 'B' })).toBe(false);
  });

  it('returns false when one has subtask and other does not', () => {
    expect(taskIdEquals({ task: 3 }, { task: 3, subtask: 'A' })).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="task-id" --no-coverage`
Expected: FAIL - module not found

**Step 3: Implement TaskId module**

```typescript
// src/workflow/task-id.ts

/**
 * Task identifier with optional subtask
 * Format: "3" or "3.A" (task with optional subtask letter)
 */
export interface TaskId {
  readonly task: number;
  readonly subtask?: string;
}

/**
 * Parse TaskId from Task tool description
 *
 * Valid formats:
 *   "3 - Review code" -> { task: 3 }
 *   "3.A - First reviewer" -> { task: 3, subtask: 'A' }
 *   "3.a - lowercase" -> { task: 3, subtask: 'A' } (normalized)
 *   "5: Execute" -> { task: 5 }
 *
 * Returns null if no valid TaskId prefix found
 */
export function parseTaskId(description: string): TaskId | null {
  if (!description) return null;

  // Match: "3" or "3.A" at start, followed by separator (space, dash, colon)
  const match = description.match(/^(\d+)(?:\.([A-Za-z]))?[\s\-:]/);
  if (!match) return null;

  const task = parseInt(match[1], 10);
  if (task <= 0) return null;

  return {
    task,
    subtask: match[2]?.toUpperCase(),
  };
}

/**
 * Serialize TaskId to string (e.g., { task: 3, subtask: 'A' } -> "3.A")
 */
export function taskIdToString(taskId: TaskId): string {
  return taskId.subtask ? `${taskId.task}.${taskId.subtask}` : `${taskId.task}`;
}

/**
 * Compare two TaskIds for equality
 */
export function taskIdEquals(a: TaskId, b: TaskId): boolean {
  return a.task === b.task && a.subtask === b.subtask;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="task-id" --no-coverage`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/task-id.ts __tests__/workflow/task-id.test.ts && git commit -m "feat(workflow): add TaskId type and parsing utilities"
```

---

## Task 2: Add AgentBinding Type

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/types.ts:30-40`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/types.test.ts`

**Step 1: Write failing test for AgentBinding type**

Add to existing `__tests__/workflow/types.test.ts`:

```typescript
import type { AgentBinding } from '../../src/workflow/types';

describe('AgentBinding type', () => {
  it('accepts valid running binding', () => {
    const binding: AgentBinding = {
      taskId: { task: 3, subtask: 'A' },
      status: 'running',
    };
    expect(binding.status).toBe('running');
  });

  it('accepts binding with result', () => {
    const binding: AgentBinding = {
      taskId: { task: 2 },
      status: 'done',
      result: 'pass',
    };
    expect(binding.result).toBe('pass');
  });

  it('accepts binding with child workflow', () => {
    const binding: AgentBinding = {
      taskId: { task: 1 },
      status: 'running',
      childWorkflowId: 'wf-2025-01-01-abc123',
    };
    expect(binding.childWorkflowId).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" --no-coverage`
Expected: FAIL - AgentBinding not exported

**Step 3: Add AgentBinding type to types.ts**

Add after line 36 (after Conditions interface):

```typescript
/**
 * Agent binding status
 */
export type AgentStatus = 'running' | 'done' | 'stopped';

/**
 * Agent binding result (for completed agents)
 */
export type AgentResult = 'pass' | 'fail';

/**
 * Agent binding - tracks which task an agent is working on
 */
export interface AgentBinding {
  readonly taskId: TaskId;
  readonly childWorkflowId?: string;
  readonly status: AgentStatus;
  readonly result?: AgentResult;
}
```

Also add import at top of types.ts:

```typescript
import type { TaskId } from './task-id';
```

And re-export TaskId:

```typescript
export type { TaskId } from './task-id';
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/types.ts __tests__/workflow/types.test.ts && git commit -m "feat(workflow): add AgentBinding type for agent-task correlation"
```

---

## Task 3: Extend WorkflowState

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/types.ts:87-102`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/types.test.ts`

**Step 1: Write failing test for extended WorkflowState**

Add to `__tests__/workflow/types.test.ts`. Note: `createTaskNumber` is already imported in this file (line 2). Also add `WorkflowState` to the existing import:

```typescript
// Update import at top of file to include WorkflowState:
import { createTaskNumber, type TaskNumber, type Action, type WorkflowState } from '../../src/workflow/types';
```

Then add the new describe block:

```typescript
describe('WorkflowState orchestration fields', () => {
  it('includes pendingTasks array', () => {
    const state: WorkflowState = {
      id: 'wf-test',
      workflow: 'test.workflow.md',
      task: createTaskNumber(1)!,
      taskName: 'Test',
      retryCount: 0,
      retryMax: 3,
      variables: {},
      tasks: [],
      pendingTasks: [{ task: 1 }, { task: 2, subtask: 'A' }],
      agentBindings: {},
      startedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(state.pendingTasks).toHaveLength(2);
  });

  it('includes agentBindings map', () => {
    const state: WorkflowState = {
      id: 'wf-test',
      workflow: 'test.workflow.md',
      task: createTaskNumber(1)!,
      taskName: 'Test',
      retryCount: 0,
      retryMax: 3,
      variables: {},
      tasks: [],
      pendingTasks: [],
      agentBindings: {
        'agent-abc': { taskId: { task: 1 }, status: 'running' },
      },
      startedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(state.agentBindings['agent-abc']).toBeDefined();
  });

  it('includes optional parent workflow fields', () => {
    const state: WorkflowState = {
      id: 'wf-child',
      workflow: 'child.workflow.md',
      task: createTaskNumber(1)!,
      taskName: 'Child Task',
      retryCount: 0,
      retryMax: 3,
      variables: {},
      tasks: [],
      pendingTasks: [],
      agentBindings: {},
      agentId: 'agent-xyz',
      parentWorkflowId: 'wf-parent',
      parentTaskId: { task: 2, subtask: 'B' },
      startedAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(state.parentWorkflowId).toBe('wf-parent');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" --no-coverage`
Expected: FAIL - pendingTasks/agentBindings not in type

**Step 3: Extend WorkflowState interface**

Update WorkflowState in `types.ts`:

```typescript
/**
 * Workflow execution state (persisted)
 */
export interface WorkflowState {
  readonly id: string;
  readonly workflow: string;
  readonly task: TaskNumber;
  readonly taskName: string;
  readonly retryCount: number;
  readonly retryMax: number;
  readonly variables: Record<string, boolean | number | string>;
  readonly tasks: readonly TaskState[];

  // Orchestration fields
  readonly pendingTasks: readonly TaskId[];
  readonly agentBindings: Readonly<Record<string, AgentBinding>>;

  // Child workflow fields (optional)
  readonly agentId?: string;
  readonly parentWorkflowId?: string;
  readonly parentTaskId?: TaskId;

  readonly nested?: {
    readonly workflow: string;
    readonly instanceId: string;
  };
  readonly startedAt: string;
  readonly updatedAt: string;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/types.ts __tests__/workflow/types.test.ts && git commit -m "feat(workflow): extend WorkflowState with orchestration fields"
```

---

## Task 4: Add stashedWorkflowId to SessionState

**Files:**
- Modify: `plugin/hooks/hooks-app/src/types.ts:86-107`
- Test: `plugin/hooks/hooks-app/__tests__/types.test.ts`

**Step 1: Write failing test for stashedWorkflowId**

Add to `__tests__/types.test.ts`:

```typescript
describe('SessionState stash support', () => {
  it('includes optional stashedWorkflowId', () => {
    const session: SessionState = {
      session_id: 'test-123',
      started_at: '2025-01-01T00:00:00Z',
      active_command: null,
      active_skill: null,
      edited_files: [],
      file_extensions: [],
      metadata: {},
      stashedWorkflowId: 'wf-2025-01-01-abc',
    };
    expect(session.stashedWorkflowId).toBe('wf-2025-01-01-abc');
  });

  it('allows undefined stashedWorkflowId', () => {
    const session: SessionState = {
      session_id: 'test-123',
      started_at: '2025-01-01T00:00:00Z',
      active_command: null,
      active_skill: null,
      edited_files: [],
      file_extensions: [],
      metadata: {},
    };
    expect(session.stashedWorkflowId).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="types.test" --no-coverage`
Expected: FAIL - stashedWorkflowId not in type

**Step 3: Add stashedWorkflowId to SessionState**

Add to SessionState interface in `src/types.ts`:

```typescript
export interface SessionState {
  /** Unique session identifier (timestamp-based) */
  session_id: string;

  /** ISO 8601 timestamp when session started */
  started_at: string;

  /** Currently active slash command (e.g., "/execute") */
  active_command: string | null;

  /** Currently active skill (e.g., "executing-plans") */
  active_skill: string | null;

  /** Files edited during this session */
  edited_files: string[];

  /** File extensions edited during this session (deduplicated) */
  file_extensions: string[];

  /** Custom metadata for specific workflows */
  metadata: Record<string, any>;

  /** ID of stashed workflow (enforcement paused) */
  stashedWorkflowId?: string;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="types.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/types.ts __tests__/types.test.ts && git commit -m "feat(workflow): add stashedWorkflowId to SessionState for stash/pop"
```

---

## Task 5: Update state.ts to Initialize New Fields

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/state.ts:35-54`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Step 1: Write failing test for new field initialization**

Add to `__tests__/workflow/state.test.ts` **inside the existing `describe('WorkflowStateManager')` block** (which already has `manager` instantiated via `beforeEach` at lines 12-16):

```typescript
// Add this new describe block INSIDE the existing describe('WorkflowStateManager') block
// The manager fixture is already available from the beforeEach setup
describe('create orchestration fields', () => {
  it('initializes pendingTasks as empty array', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    expect(state.pendingTasks).toEqual([]);
  });

  it('initializes agentBindings as empty object', async () => {
    const state = await manager.create('test.workflow.md', 'Test Task');
    expect(state.agentBindings).toEqual({});
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state" --no-coverage`
Expected: FAIL - pendingTasks/agentBindings undefined

**Step 3: Update create() method**

Update `create()` in `state.ts`:

```typescript
async create(workflow: string, taskName: string): Promise<WorkflowState> {
  const id = generateId();
  const now = new Date().toISOString();

  const state: WorkflowState = {
    id,
    workflow,
    task: createTaskNumber(1)!,
    taskName,
    retryCount: 0,
    retryMax: 3,
    variables: {},
    tasks: [],
    pendingTasks: [],
    agentBindings: {},
    startedAt: now,
    updatedAt: now,
  };

  await this.save(state);
  return state;
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
cd plugin/hooks/hooks-app && git add src/workflow/state.ts __tests__/workflow/state.test.ts && git commit -m "feat(workflow): initialize orchestration fields in state create()"
```

---

## Exit Criteria

Before proceeding to next plan, verify ALL of the following:

| Criterion | Verification Command |
|-----------|---------------------|
| TaskId parses "3.A - desc" | `npm test -- --testPathPattern="task-id" --no-coverage` passes |
| AgentBinding type compiles | `npm run build` succeeds |
| WorkflowState includes pendingTasks | `grep "pendingTasks" src/workflow/types.ts` returns match |
| WorkflowState includes agentBindings | `grep "agentBindings" src/workflow/types.ts` returns match |
| SessionState includes stashedWorkflowId | `grep "stashedWorkflowId" src/types.ts` returns match |
| New fields initialized in create() | `npm test -- --testPathPattern="workflow/state" --no-coverage` passes |
| All tests pass | `npm test --no-coverage` exits 0 |
| Build succeeds | `npm run build` exits 0 |

---

## Summary

After completing this plan:
- [x] TaskId type and parsing utilities
- [x] AgentBinding type for agent-task correlation
- [x] Extended WorkflowState with pendingTasks, agentBindings, parent fields
- [x] SessionState.stashedWorkflowId for stash/pop
- [x] State manager initializes new fields

**Next Plan:** 02-state-layer.md - State manager queue and binding methods
