// src/workflow/state.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { createActor, type AnyActorRef } from 'xstate';
import {
  createStepNumber,
  type WorkflowState,
  type AgentBinding,
  type PendingStep,
  type Substep,
  type SubstepState,
  type Step,
  type StepNumber,
  type Workflow
} from './types.js';
import type { StepId } from './step-id.js';
import { WorkflowStateSchema } from '../schemas.js';
import { compileWorkflowToMachine } from './compiler.js';

const STATE_DIR = '.claude/turboshovel/workflows';
const SESSION_FILE = '.claude/turboshovel/session.json';

function generateId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const random = Math.random().toString(36).slice(2, 8);
  return `wf-${date}-${random}`;
}

interface SessionData {
  activeWorkflow: string | null;
  stashedWorkflowId?: string;
}

interface CreateOptions {
  readonly agentId?: string;
  readonly parentWorkflowId?: string;
  readonly parentStepId?: StepId;
  readonly prompted?: boolean;
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

  async create(workflowFile: string, workflow: Workflow, options?: CreateOptions): Promise<WorkflowState> {
    const id = generateId();
    const now = new Date().toISOString();

    const initialStep = workflow.steps[0];
    const stepNum = initialStep.number ?? (1 as StepNumber);

    const state: WorkflowState = {
      id,
      workflow: workflowFile,
      title: workflow.title,
      description: workflow.description,
      step: stepNum,
      stepName: initialStep.description,
      retryCount: 0,
      variables: {},
      steps: [],
      pendingSteps: [],
      agentBindings: {},
      agentId: options?.agentId,
      parentWorkflowId: options?.parentWorkflowId,
      parentStepId: options?.parentStepId,
      startedAt: now,
      updatedAt: now,
      prompted: options?.prompted
    };

    await this.save(state);
    return state;
  }

  async load(id: string): Promise<WorkflowState | null> {
    try {
      const content = await fs.readFile(this.statePath(id), 'utf8');
      const parsed = JSON.parse(content) as unknown;
      const result = WorkflowStateSchema.safeParse(parsed);
      if (!result.success) return null;
      return result.data;
    } catch {
      return null;
    }
  }

  /**
   * Initialize an XState actor for a workflow
   */
  async createActor(id: string, steps: Step[]): Promise<AnyActorRef | null> {
    const state = await this.load(id);
    if (!state) return null;

    const machine = compileWorkflowToMachine(steps);
    const actor = createActor(machine, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      snapshot: state.snapshot as any
    });
    actor.start();
    return actor;
  }

  async save(state: WorkflowState): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    const updated: WorkflowState = {
      ...state,
      updatedAt: new Date().toISOString()
    };
    await fs.writeFile(this.statePath(state.id), JSON.stringify(updated, null, 2));
  }

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
      variables: { ...existing.variables, ...(updates.variables ?? {}) },
      updatedAt: new Date().toISOString()
    };

    await this.save(updated);
    return updated;
  }

  async setLastResult(id: string, result: 'pass' | 'fail'): Promise<void> {
    await this.update(id, { lastResult: result });
  }

  async isParentPrompted(parentWorkflowId: string): Promise<boolean> {
    const parent = await this.load(parentWorkflowId);
    return parent?.prompted ?? false;
  }

  /**
   * Update workflow state from an XState actor snapshot
   */
  async updateFromActor(id: string, actor: AnyActorRef, steps: Step[]): Promise<WorkflowState> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const snapshot = actor.getPersistedSnapshot() as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const stateValue = snapshot.value as string;

    const match = /^step_(\d+)(?:_(\S+))?$/.exec(stateValue);
    const stepNum = match ? parseInt(match[1], 10) : 1;
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    let substep = snapshot.context.substep as string | undefined;
    if (!substep && match?.[2]) {
      substep = match[2];
    }

    const step = steps.find(s => s.number === stepNum) ?? steps[0];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const retryCount = snapshot.context.retryCount as number;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const variables = snapshot.context.variables as Record<string, boolean | number | string>;

    return await this.update(id, {
      step: createStepNumber(stepNum) ?? steps[0].number,
      substep,
      stepName: step.description,
      retryCount,
      variables,
      snapshot
    });
  }

  async delete(id: string): Promise<void> {
    try {
      await fs.unlink(this.statePath(id));
    } catch {
      /* intentionally ignored */
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

    let session: SessionData = { activeWorkflow: null };
    try {
      const content = await fs.readFile(this.sessionPath, 'utf8');
      session = JSON.parse(content) as SessionData;
    } catch {
      /* use default */
    }

    session.activeWorkflow = id;
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
          if (state) states.push(state);
        }
      }
      return states;
    } catch {
      return [];
    }
  }

  async pushPendingStep(id: string, pending: PendingStep): Promise<void> {
    const state = await this.load(id);
    if (!state) throw new Error(`Workflow ${id} not found`);

    await this.update(id, {
      pendingSteps: [...state.pendingSteps, pending]
    });
  }

  async popPendingStep(id: string): Promise<PendingStep | null> {
    const state = await this.load(id);
    if (!state || state.pendingSteps.length === 0) return null;

    const [first, ...rest] = state.pendingSteps;
    await this.update(id, { pendingSteps: rest });
    return first;
  }

  async bindAgent(id: string, agentId: string, stepId: StepId): Promise<void> {
    const state = await this.load(id);
    if (!state) throw new Error(`Workflow ${id} not found`);

    const binding: AgentBinding = {
      stepId,
      status: 'running'
    };

    await this.update(id, {
      agentBindings: {
        ...state.agentBindings,
        [agentId]: binding
      }
    });
  }

  async getAgentBinding(id: string, agentId: string): Promise<AgentBinding | null> {
    const state = await this.load(id);
    if (!state) throw new Error(`Workflow ${id} not found`);
    return state.agentBindings[agentId] ?? null;
  }

  async updateAgentBinding(
    id: string,
    agentId: string,
    updates: Partial<Pick<AgentBinding, 'status' | 'result' | 'childWorkflowId'>>
  ): Promise<void> {
    const state = await this.load(id);
    if (!state) throw new Error(`Workflow ${id} not found`);

    const existing = state.agentBindings[agentId];
    if (!existing) throw new Error(`No binding for agent ${agentId}`);

    await this.update(id, {
      agentBindings: {
        ...state.agentBindings,
        [agentId]: { ...existing, ...updates }
      }
    });
  }

  async stash(): Promise<string | null> {
    const session = await this.loadSession();
    const activeId = session.activeWorkflow;

    if (!activeId) return null;

    session.activeWorkflow = null;
    session.stashedWorkflowId = activeId;
    await this.saveSession(session);

    return activeId;
  }

  async pop(): Promise<WorkflowState | null> {
    const session = await this.loadSession();
    const stashedId = session.stashedWorkflowId;

    if (!stashedId) return null;

    const state = await this.load(stashedId);
    if (!state) {
      session.stashedWorkflowId = undefined;
      await this.saveSession(session);
      return null;
    }

    session.activeWorkflow = stashedId;
    session.stashedWorkflowId = undefined;
    await this.saveSession(session);

    return state;
  }

  async getStashedWorkflowId(): Promise<string | null> {
    const session = await this.loadSession();
    return session.stashedWorkflowId ?? null;
  }

  private async loadSession(): Promise<SessionData> {
    try {
      const content = await fs.readFile(this.sessionPath, 'utf8');
      return JSON.parse(content) as SessionData;
    } catch {
      return { activeWorkflow: null };
    }
  }

  private async saveSession(session: SessionData): Promise<void> {
    await fs.mkdir(path.dirname(this.sessionPath), { recursive: true });
    await fs.writeFile(this.sessionPath, JSON.stringify(session, null, 2));
  }

  async getChildWorkflowResult(childId: string): Promise<'pass' | 'fail' | null> {
    const child = await this.load(childId);
    if (!child) return 'pass';

    if (child.variables.blocked === true) return 'fail';
    if (child.variables.completed === true) return 'pass';

    return null;
  }

  async initializeSubsteps(id: string, substeps: readonly Substep[]): Promise<void> {
    const state = await this.load(id);
    if (!state) throw new Error(`Workflow ${id} not found`);

    const staticSubsteps = substeps.filter(s => !s.isDynamic);

    const substepStates: SubstepState[] = staticSubsteps.map(s => ({
      id: s.id,
      status: 'pending',
      agentId: undefined,
      result: undefined
    }));

    await this.update(id, { substepStates });
  }

  async addDynamicSubstep(id: string): Promise<string> {
    const state = await this.load(id);
    if (!state) throw new Error(`Workflow ${id} not found`);

    const existing = state.substepStates ?? [];
    const nextId = String(existing.length + 1);

    const newSubstep: SubstepState = {
      id: nextId,
      status: 'pending',
      agentId: undefined,
      result: undefined
    };

    await this.update(id, {
      substepStates: [...existing, newSubstep]
    });

    return nextId;
  }

  async bindSubstepAgent(workflowId: string, substepId: string, agentId: string): Promise<void> {
    const state = await this.load(workflowId);
    if (!state) throw new Error(`Workflow ${workflowId} not found`);

    const substepStates = state.substepStates ?? [];
    const updated = substepStates.map(s =>
      s.id === substepId
        ? { ...s, status: 'running' as const, agentId }
        : s
    );

    await this.update(workflowId, { substepStates: updated });
  }

  async completeSubstep(
    workflowId: string,
    substepId: string,
    result: 'pass' | 'fail'
  ): Promise<void> {
    const state = await this.load(workflowId);
    if (!state) throw new Error(`Workflow ${workflowId} not found`);

    const substepStates = state.substepStates ?? [];
    const updated = substepStates.map(s =>
      s.id === substepId
        ? { ...s, status: 'done' as const, result }
        : s
    );

    await this.update(workflowId, { substepStates: updated });
  }
}
