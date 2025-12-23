// src/workflow/state.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { createTaskNumber, type WorkflowState } from './types';

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

  async load(id: string): Promise<WorkflowState | null> {
    try {
      const content = await fs.readFile(this.statePath(id), 'utf8');
      return JSON.parse(content) as WorkflowState;
    } catch {
      return null;
    }
  }

  async save(state: WorkflowState): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    const updated: WorkflowState = {
      ...state,
      updatedAt: new Date().toISOString(),
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
  async update(id: string, updates: Partial<Omit<WorkflowState, 'id' | 'startedAt'>>): Promise<WorkflowState> {
    const existing = await this.load(id);
    if (!existing) {
      throw new Error(`Workflow ${id} not found`);
    }

    const updated: WorkflowState = {
      ...existing,
      ...updates,
      // Merge variables additively - see JSDoc for rationale
      variables: { ...existing.variables, ...(updates.variables ?? {}) },
      updatedAt: new Date().toISOString(),
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
    try {
      const content = await fs.readFile(this.sessionPath, 'utf8');
      const session = JSON.parse(content);
      if (session.active_workflow) {
        return this.load(session.active_workflow);
      }
    } catch {
      // Session file doesn't exist or is invalid
    }
    return null;
  }

  async setActive(id: string | null): Promise<void> {
    await fs.mkdir(path.dirname(this.sessionPath), { recursive: true });

    let session: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(this.sessionPath, 'utf8');
      session = JSON.parse(content);
    } catch {
      // Start fresh if session doesn't exist
    }

    session.active_workflow = id;
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
}
