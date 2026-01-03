import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  readSession,
  getActiveState,
  listWorkflowStates,
  readWorkflowState,
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
      expect(result.stdout).toContain('Action:   START');
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

    it('initializes step=1 and retryCount=0', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      const state = await getActiveState(workspace);
      expect(state?.step).toBe(1);
      expect(state?.retryCount).toBe(0);
    });

    it('outputs first step description', async () => {
      const result = runCli('start workflows/simple.workflow.md', workspace);

      expect(result.stdout).toContain('## 1.');
      expect(result.stdout).toContain('First step');
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

  describe('step queueing mode (--step)', () => {
    beforeEach(async () => {
      // Start a workflow first
      runCli('start workflows/simple.workflow.md', workspace);
    });

    it('pushes step to pendingSteps queue', async () => {
      const result = runCli('start --step 2', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('queued');
    });

    it('accepts simple step number', async () => {
      const result = runCli('start --step 1', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Step 1 queued');
    });

    it('accepts substep format', async () => {
      const result = runCli('start --step 1.1', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('1.1');
    });

    it('adds step to state pendingSteps array', async () => {
      runCli('start --step 2', workspace);

      const state = await getActiveState(workspace);
      expect(state?.pendingSteps).toHaveLength(1);
    });

    it('fails if no active workflow', async () => {
      // Stop current workflow
      runCli('stop', workspace);

      const result = runCli('start --step 2', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No active workflow');
    });

    it('fails if invalid step format', async () => {
      const result = runCli('start --step abc', workspace);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid step ID');
    });

    it('should queue step with workflow file', async () => {
      const result = runCli('start --step 1.1 workflows/simple.workflow.md', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('queued');
      expect(result.stdout).toContain('1.1');

      const state = await getActiveState(workspace);
      expect(state?.pendingSteps).toHaveLength(1);
      expect(state?.pendingSteps[0].workflow).toBe('workflows/simple.workflow.md');
    });
  });

  describe('agent binding mode (--agent)', () => {
    beforeEach(async () => {
      // Start workflow and queue a step
      runCli('start workflows/simple.workflow.md', workspace);
      runCli('start --step 1', workspace);
    });

    it('pops step from pendingSteps queue', async () => {
      runCli('start --agent test-agent', workspace);

      const state = await getActiveState(workspace);
      expect(state?.pendingSteps).toHaveLength(0);
    });

    it('binds agent to popped step', async () => {
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

    it('fails if pendingSteps is empty', async () => {
      // Pop the queued step
      runCli('start --agent agent1', workspace);

      // Try to bind another agent
      const result = runCli('start --agent agent2', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No pending step');
    });

    it('fails if no active workflow', async () => {
      runCli('stop', workspace);

      const result = runCli('start --agent test-agent', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No active workflow');
    });

    it('should create child workflow linked to parent', async () => {
      // Pop the step without workflow
      runCli('start --agent temp-agent', workspace);

      // Now queue step 1 with a workflow
      runCli('start --step 1 workflows/simple.workflow.md', workspace);

      // Bind agent - should create child workflow
      const result = runCli('start --agent test-agent-123', workspace);
      expect(result.exitCode).toBe(0);

      // Verify child workflow was created
      const stateFiles = await listWorkflowStates(workspace);
      expect(stateFiles.length).toBe(2); // parent + child

      // Get session to find parent workflow ID (child is now active)
      const session = await readSession(workspace);
      expect(session.active).toBeTruthy(); // Child is now active

      const allStates = await Promise.all(
        stateFiles.map(file => readWorkflowState(workspace, file.replace('.json', '')))
      );
      const parentState = allStates.find(state =>
        Object.values(state?.agentBindings as Record<string, unknown> || {})
          .some((binding: unknown) =>
            typeof binding === 'object' &&
            binding !== null &&
            'childWorkflowId' in binding &&
            (binding as Record<string, unknown>).childWorkflowId === session.active
          )
      );

      expect(parentState).toBeTruthy();
      const agentBinding = (parentState?.agentBindings as Record<string, unknown>)?.['test-agent-123'];
      expect((agentBinding as Record<string, unknown>)?.childWorkflowId).toBe(session.active);
    });
  });
});