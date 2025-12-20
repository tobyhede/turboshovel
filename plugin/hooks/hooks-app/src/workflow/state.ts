// src/workflow/state.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { createStepNumber, type WorkflowState } from './types';

const STATE_DIR = '.claude/turboshovel/workflows';
const SESSION_FILE = '.claude/turboshovel/session.json';

function generateId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const random = Math.random().toString(36).slice(2, 8);
  return `wf-${date}-${random}`;
}

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

  async create(workflow: string, stepName: string): Promise<WorkflowState> {
    const id = generateId();
    const now = new Date().toISOString();

    const state: WorkflowState = {
      id,
      workflow,
      step: createStepNumber(1)!,
      stepName,
      retryCount: 0,
      retryMax: 3,
      variables: {},
      tasks: [],
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

  async update(id: string, updates: Partial<Omit<WorkflowState, 'id' | 'startedAt'>>): Promise<WorkflowState> {
    const existing = await this.load(id);
    if (!existing) {
      throw new Error(`Workflow ${id} not found`);
    }

    const updated: WorkflowState = {
      ...existing,
      ...updates,
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
