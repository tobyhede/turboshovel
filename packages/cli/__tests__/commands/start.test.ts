import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  readSession,
  getActiveState,
  listWorkflowStates,
  type TestWorkspace,
} from '../helpers/test-utils.js';

describe('start command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('file mode', () => {
    it('creates workflow state from valid workflow file', async () => {
      const result = runCli('start workflows/simple.workflow.md', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Started workflow');
      expect(result.stdout).toContain('simple.workflow.md');
    });

    it('sets workflow as active', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      const session = await readSession(workspace);
      expect(session.active).toBeTruthy();
    });

    it('stores relative path in state', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      const state = await getActiveState(workspace);
      expect(state).not.toBeNull();
      expect(state?.workflow).toBe('workflows/simple.workflow.md');
    });

    it('initializes task=1 and retryCount=0', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      const state = await getActiveState(workspace);
      expect(state?.task).toBe(1);
      expect(state?.retryCount).toBe(0);
    });

    it('outputs first task description', async () => {
      const result = runCli('start workflows/simple.workflow.md', workspace);

      expect(result.stdout).toContain('Task 1');
      expect(result.stdout).toContain('First task');
    });

    it('fails if file does not exist', async () => {
      const result = runCli('start workflows/nonexistent.md', workspace);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });

    it('fails if no file argument provided', async () => {
      const result = runCli('start', workspace);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('required');
    });

    it('creates state file on disk', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      const stateFiles = await listWorkflowStates(workspace);
      expect(stateFiles.length).toBe(1);
    });
  });

  describe('task queueing mode (--task)', () => {
    beforeEach(async () => {
      // Start a workflow first
      runCli('start workflows/simple.workflow.md', workspace);
    });

    it('pushes task to pendingTasks queue', async () => {
      const result = runCli('start --task 2', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('queued');
    });

    it('accepts simple task number', async () => {
      const result = runCli('start --task 1', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Task 1');
    });

    it('accepts subtask format', async () => {
      const result = runCli('start --task 1.1', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1.1');
    });

    it('adds task to state pendingTasks array', async () => {
      runCli('start --task 2', workspace);

      const state = await getActiveState(workspace);
      expect(state?.pendingTasks).toHaveLength(1);
    });

    it('fails if no active workflow', async () => {
      // Stop current workflow
      runCli('stop', workspace);

      const result = runCli('start --task 2', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No active workflow');
    });

    it('fails if invalid task format', async () => {
      const result = runCli('start --task abc', workspace);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid task ID');
    });
  });

  describe('agent binding mode (--agent)', () => {
    beforeEach(async () => {
      // Start workflow and queue a task
      runCli('start workflows/simple.workflow.md', workspace);
      runCli('start --task 1', workspace);
    });

    it('pops task from pendingTasks queue', async () => {
      runCli('start --agent test-agent', workspace);

      const state = await getActiveState(workspace);
      expect(state?.pendingTasks).toHaveLength(0);
    });

    it('binds agent to popped task', async () => {
      runCli('start --agent test-agent', workspace);

      const state = await getActiveState(workspace);
      expect(state?.agentBindings).toHaveProperty('test-agent');
    });

    it('sets agent status to running', async () => {
      runCli('start --agent test-agent', workspace);

      const state = await getActiveState(workspace);
      const binding = (state?.agentBindings as Record<string, unknown>)?.['test-agent'] as Record<string, unknown>;
      expect(binding?.status).toBe('running');
    });

    it('outputs binding info', async () => {
      const result = runCli('start --agent test-agent', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test-agent');
      expect(result.stdout).toContain('bound');
    });

    it('fails if pendingTasks is empty', async () => {
      // Pop the queued task
      runCli('start --agent agent1', workspace);

      // Try to bind another agent
      const result = runCli('start --agent agent2', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No pending task');
    });

    it('fails if no active workflow', async () => {
      runCli('stop', workspace);

      const result = runCli('start --agent test-agent', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No active workflow');
    });
  });
});
