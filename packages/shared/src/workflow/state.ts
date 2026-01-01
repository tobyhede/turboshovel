// src/workflow/state.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { createTaskNumber, type WorkflowState, type AgentBinding, type PendingTask, type Subtask, type SubtaskState } from './types.js';
import type { TaskId } from './task-id.js';
import { WorkflowStateSchema } from '../schemas.js';

const STATE_DIR = '.claude/turboshovel/workflows';
const SESSION_FILE = '.claude/turboshovel/session.json';

/**
 * Generate a unique workflow ID.
 *
 * Format: `wf-{date}-{random}` where:
 * - date: ISO date YYYY-MM-DD (slice(0,10) extracts date from ISO string)
 * - random: 6 chars of base36 random (slice(2,8) skips "0." prefix from Math.random)
 *
 * Example: `wf-2025-01-15-a1b2c3`
 *
 * The date prefix makes IDs human-readable and naturally sortable.
 * 6-char random gives ~2.2 billion possibilities per day - effectively unique.
 */
function generateId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const random = Math.random().toString(36).slice(2, 8);
  return `wf-${date}-${random}`;
}

/**
 * Session data stored in session.json
 * Tracks active and stashed workflows
 */
interface SessionData {
  activeWorkflow: string | null;
  stashedWorkflowId?: string;
  /** @deprecated Use activeWorkflow - kept for migration from old session files */
  active_workflow?: string | null;
}

/**
 * Options for creating a child workflow linked to a parent
 */
interface CreateOptions {
  readonly agentId?: string;
  readonly parentWorkflowId?: string;
  readonly parentTaskId?: TaskId;
}

/**
 * Manages persistent workflow state stored in `.claude/turboshovel/workflows/`.
 *
 * Each workflow gets a unique JSON state file that persists across conversations.
 * The active workflow is tracked in `.claude/turboshovel/session.json`.
 *
 * @example
 * ```typescript
 * const manager = new WorkflowStateManager(process.cwd());
 *
 * // Create a new workflow
 * const state = await manager.create('deploy.workflow.md', 'Build application');
 *
 * // Update state
 * await manager.update(state.id, { task: createTaskNumber(2), taskName: 'Run tests' });
 *
 * // Get active workflow
 * const active = await manager.getActive();
 * ```
 */
export class WorkflowStateManager {
  private readonly cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  private get stateDir(): string {
    return path.join(this.cwd, STATE_DIR);
  }

  private get sessionPath(): string {
    return path.join(this.cwd, SESSION_FILE);
  }

  private statePath(id: string): string {
    return path.join(this.stateDir, `${id}.json`);
  }

  async create(workflow: string, taskName: string, options?: CreateOptions): Promise<WorkflowState> {
    const id = generateId();
    const now = new Date().toISOString();

    const taskNum = createTaskNumber(1);
    if (!taskNum) {
      throw new Error('Failed to create initial task number');
    }

    const state: WorkflowState = {
      id,
      workflow,
      task: taskNum,
      taskName,
      retryCount: 0,
      variables: {},
      tasks: [],
      pendingTasks: [],
      agentBindings: {},
      agentId: options?.agentId,
      parentWorkflowId: options?.parentWorkflowId,
      parentTaskId: options?.parentTaskId,
      startedAt: now,
      updatedAt: now
    };

    await this.save(state);
    return state;
  }

  async load(id: string): Promise<WorkflowState | null> {
    try {
      const content = await fs.readFile(this.statePath(id), 'utf8');
      const parsed = JSON.parse(content) as unknown;
      const result = WorkflowStateSchema.safeParse(parsed);
      if (!result.success) {
        return null;
      }
      return result.data;
    } catch {
      return null;
    }
  }

  async save(state: WorkflowState): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    const updated: WorkflowState = {
      ...state,
      updatedAt: new Date().toISOString()
    };
    await fs.writeFile(this.statePath(state.id), JSON.stringify(updated, null, 2));
  }

  /**
   * Update workflow state with partial updates.
   *
   * **Variables behavior:** Variables are merged additively - existing variables
   * are preserved and new variables are added/updated. Variables cannot be removed
   * once set. This is intentional: workflow variables represent accumulated state
   * (e.g., `has_blocked_task: true`) that should persist through the workflow.
   * To "clear" a variable, set it to a falsy value like `false` or `0`.
   */
  async update(
    id: string,
    updates: Partial<Omit<WorkflowState, 'id' | 'startedAt'>>
  ): Promise<WorkflowState> {
    const existing = await this.load(id);
    if (!existing) {
      throw new Error(`Workflow ${id} not found`);
    }

    const updated: WorkflowState = {
      ...existing,
      ...updates,
      // Merge variables additively - see JSDoc for rationale
      variables: { ...existing.variables, ...(updates.variables ?? {}) },
      updatedAt: new Date().toISOString()
    };

    await this.save(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    try {
      await fs.unlink(this.statePath(id));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async getActive(): Promise<WorkflowState | null> {
    const session = await this.loadSession();
    if (typeof session.activeWorkflow === 'string') {
      return await this.load(session.activeWorkflow);
    }
    return null;
  }

  async setActive(id: string | null): Promise<void> {
    await fs.mkdir(path.dirname(this.sessionPath), { recursive: true });

    let session: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(this.sessionPath, 'utf8');
      session = JSON.parse(content) as Record<string, unknown>;
    } catch {
      // Start fresh if session doesn't exist
    }

    session.activeWorkflow = id;
    delete session.active_workflow; // Clean up old field
    await fs.writeFile(this.sessionPath, JSON.stringify(session, null, 2));
  }

  async list(): Promise<WorkflowState[]> {
    try {
      const files = await fs.readdir(this.stateDir);
      const states: WorkflowState[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const state = await this.load(id);
          if (state) {
            states.push(state);
          }
        }
      }

      return states;
    } catch {
      return [];
    }
  }

  /**
   * Push task to pending queue (FIFO - first in, first out)
   */
  async pushPendingTask(id: string, pending: PendingTask): Promise<void> {
    const state = await this.load(id);
    if (!state) {
      throw new Error(`Workflow ${id} not found`);
    }

    await this.update(id, {
      pendingTasks: [...state.pendingTasks, pending]
    });
  }

  /**
   * Pop task from pending queue (FIFO - returns first, removes it)
   * Returns null if queue is empty or workflow not found
   */
  async popPendingTask(id: string): Promise<PendingTask | null> {
    const state = await this.load(id);
    if (!state || state.pendingTasks.length === 0) {
      return null;
    }

    const [first, ...rest] = state.pendingTasks;
    await this.update(id, { pendingTasks: rest });
    return first;
  }

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
      status: 'running'
    };

    await this.update(id, {
      agentBindings: {
        ...state.agentBindings,
        [agentId]: binding
      }
    });
  }

  /**
   * Get agent binding by agent ID
   * @throws Error if workflow not found
   */
  async getAgentBinding(id: string, agentId: string): Promise<AgentBinding | null> {
    const state = await this.load(id);
    if (!state) {
      throw new Error(`Workflow ${id} not found`);
    }
    return state.agentBindings[agentId] ?? null;
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

    const existing = state.agentBindings[agentId];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for missing agent binding
    if (!existing) {
      throw new Error(`No binding for agent ${agentId}`);
    }

    await this.update(id, {
      agentBindings: {
        ...state.agentBindings,
        [agentId]: { ...existing, ...updates }
      }
    });
  }

  /**
   * Stash current workflow (pause enforcement)
   * Moves activeWorkflow to stashedWorkflowId, clears active
   * Returns stashed workflow ID or null if nothing to stash
   */
  async stash(): Promise<string | null> {
    const session = await this.loadSession();
    const activeId = session.activeWorkflow;

    if (!activeId) {
      return null;
    }

    session.activeWorkflow = null;
    session.stashedWorkflowId = activeId;
    delete session.active_workflow; // Clean up old field
    await this.saveSession(session);

    return activeId;
  }

  /**
   * Pop stashed workflow (resume enforcement)
   * Restores stashedWorkflowId to activeWorkflow, clears stash
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
    session.activeWorkflow = stashedId;
    session.stashedWorkflowId = undefined;
    delete session.active_workflow; // Clean up old field
    await this.saveSession(session);

    return state;
  }

  /**
   * Get the ID of the currently stashed workflow
   */
  async getStashedWorkflowId(): Promise<string | null> {
    const session = await this.loadSession();
    return session.stashedWorkflowId ?? null;
  }

  private async loadSession(): Promise<SessionData> {
    try {
      const content = await fs.readFile(this.sessionPath, 'utf8');
      const data = JSON.parse(content) as SessionData;
      // Migration: support old active_workflow field
      if (data.active_workflow !== undefined && data.activeWorkflow === undefined) {
        data.activeWorkflow = data.active_workflow;
      }
      return data;
    } catch {
      return { activeWorkflow: null };
    }
  }

  private async saveSession(session: SessionData): Promise<void> {
    await fs.mkdir(path.dirname(this.sessionPath), { recursive: true });
    await fs.writeFile(this.sessionPath, JSON.stringify(session, null, 2));
  }

  /**
   * Get the result of a child workflow.
   *
   * Completion detection:
   * 1. If child state doesn't exist → 'pass' (cleaned up after completion)
   * 2. If child.variables.blocked === true → 'fail' (workflow hit STOP with error)
   * 3. If child.variables.completed === true → 'pass' (workflow hit DONE)
   * 4. Otherwise → null (still running - no explicit termination status)
   *
   * The CLI `complete` and `next` commands set these variables
   * when a workflow terminates via DONE or STOP actions.
   */
  async getChildWorkflowResult(childId: string): Promise<'pass' | 'fail' | null> {
    const child = await this.load(childId);
    if (!child) {
      // Workflow state deleted = completed and cleaned up
      return 'pass';
    }

    // Explicit failure: workflow blocked via STOP action
    if (child.variables.blocked === true) {
      return 'fail';
    }

    // Explicit success: workflow completed via DONE action
    if (child.variables.completed === true) {
      return 'pass';
    }

    // No explicit termination - child is still running
    return null;
  }

  /**
   * Initialize subtask states for static subtasks in a task.
   * Dynamic subtasks ({n}) are created on-demand via addDynamicSubtask.
   */
  async initializeSubtasks(id: string, subtasks: readonly Subtask[]): Promise<void> {
    const state = await this.load(id);
    if (!state) {
      throw new Error(`Workflow ${id} not found`);
    }

    // Only initialize static subtasks (isDynamic: false)
    const staticSubtasks = subtasks.filter(s => !s.isDynamic);

    const subtaskStates: SubtaskState[] = staticSubtasks.map(s => ({
      id: s.id,
      status: 'pending',
      agentId: undefined,
      result: undefined
    }));

    await this.update(id, { subtaskStates });
  }

  /**
   * Add a dynamic subtask (for {n} pattern).
   * Returns the assigned subtask ID.
   */
  async addDynamicSubtask(id: string): Promise<string> {
    const state = await this.load(id);
    if (!state) {
      throw new Error(`Workflow ${id} not found`);
    }

    const existing = state.subtaskStates ?? [];
    const nextId = String(existing.length + 1);

    const newSubtask: SubtaskState = {
      id: nextId,
      status: 'pending',
      agentId: undefined,
      result: undefined
    };

    await this.update(id, {
      subtaskStates: [...existing, newSubtask]
    });

    return nextId;
  }

  /**
   * Bind an agent to a subtask
   */
  async bindSubtaskAgent(workflowId: string, subtaskId: string, agentId: string): Promise<void> {
    const state = await this.load(workflowId);
    if (!state) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const subtaskStates = state.subtaskStates ?? [];
    const updated = subtaskStates.map(s =>
      s.id === subtaskId
        ? { ...s, status: 'running' as const, agentId }
        : s
    );

    await this.update(workflowId, { subtaskStates: updated });
  }

  /**
   * Complete a subtask with a result
   */
  async completeSubtask(
    workflowId: string,
    subtaskId: string,
    result: 'pass' | 'fail'
  ): Promise<void> {
    const state = await this.load(workflowId);
    if (!state) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const subtaskStates = state.subtaskStates ?? [];
    const updated = subtaskStates.map(s =>
      s.id === subtaskId
        ? { ...s, status: 'done' as const, result }
        : s
    );

    await this.update(workflowId, { subtaskStates: updated });
  }
}
