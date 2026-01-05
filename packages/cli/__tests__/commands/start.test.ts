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
      const result = runCli('start --prompted workflows/simple.workflow.md', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Action:   START');
      expect(result.stdout).toContain('simple.workflow.md');
    });

    it('sets workflow as active', async () => {
      runCli('start --prompted workflows/simple.workflow.md', workspace);

      const session = await readSession(workspace);
      expect(session.active).toBeTruthy();
    });

    it('stores relative path in state', async () => {
      runCli('start --prompted workflows/simple.workflow.md', workspace);

      const state = await getActiveState(workspace);
      expect(state).not.toBeNull();
      expect(state?.workflow).toBe('workflows/simple.workflow.md');
    });

    it('initializes step=1 and retryCount=0', async () => {
      runCli('start --prompted workflows/simple.workflow.md', workspace);

      const state = await getActiveState(workspace);
      expect(state?.step).toBe(1);
      expect(state?.retryCount).toBe(0);
    });

    it('outputs first step description', async () => {
      const result = runCli('start --prompted workflows/simple.workflow.md', workspace);

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
      runCli('start --prompted workflows/simple.workflow.md', workspace);

      const stateFiles = await listWorkflowStates(workspace);
      expect(stateFiles.length).toBe(1);
    });
  });

  describe('auto-execution mode', () => {
    it('executes commands and advances through workflow', async () => {
      const result = runCli('start workflows/simple.workflow.md', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('$ tsv test --result pass');
      expect(result.stdout).toContain('[PASS]');
      expect(result.stdout).toContain('Workflow complete');
    });

    it('completes workflow when all commands pass', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      // Workflow completed, so activeWorkflow is null
      const session = await readSession(workspace);
      expect(session.active).toBeNull();
    });
  });

  describe('step queueing mode (--step)', () => {
    beforeEach(async () => {
      // Start a workflow first (prompted mode to keep it active)
      runCli('start --prompted workflows/simple.workflow.md', workspace);
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

  describe('agent-scoped workflow start', () => {
    it('starts workflow in agent-specific stack', async () => {
      // Start parent in default stack (prompted to keep active)
      let result = runCli('start --prompted workflows/simple.workflow.md', workspace);
      expect(result.exitCode).toBe(0);

      // Start child in agent-001 stack (prompted to keep active)
      result = runCli('start --prompted workflows/retry.workflow.md --agent agent-001', workspace);
      expect(result.exitCode).toBe(0);

      // Default status should still show parent (simple.workflow.md)
      result = runCli('status', workspace);
      expect(result.stdout).toContain('simple.workflow.md');

      // Agent status should show child (retry.workflow.md)
      result = runCli('status --agent agent-001', workspace);
      expect(result.stdout).toContain('retry.workflow.md');
    });
  });

  describe('agent binding mode (--agent)', () => {
    beforeEach(async () => {
      // Start workflow (prompted mode to keep it active) and queue a step
      runCli('start --prompted workflows/simple.workflow.md', workspace);
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
      const bindings = state?.agentBindings;
      const binding = (bindings as Record<string, unknown>)['test-agent'];
      expect((binding as Record<string, unknown>).status).toBe('running');
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

      // Get session - child is in agent's stack (new architecture)
      const session = await readSession(workspace);
      const agentStack = session.stacks['test-agent-123'] ?? [];
      expect(agentStack.length).toBe(1); // Child is in agent's stack
      const childId = agentStack[0];

      const allStates = await Promise.all(
        stateFiles.map(file => readWorkflowState(workspace, file.replace('.json', '')))
      );
      const parentState = allStates.find(state => {
        const bindings = state?.agentBindings;
        // bindings is either defined or undefined, not null
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return Object.values((bindings as Record<string, unknown>) || {})
          .some((binding: unknown) =>
            typeof binding === 'object' &&
            binding !== null &&
            'childWorkflowId' in binding &&
            (binding as Record<string, unknown>).childWorkflowId === childId
          );
      });

      expect(parentState).toBeTruthy();
      const agentBindings = (parentState!.agentBindings) as Record<string, unknown>;
      const agentBinding = agentBindings['test-agent-123'];
      expect((agentBinding as Record<string, unknown>).childWorkflowId).toBe(childId);
    });
  });
});