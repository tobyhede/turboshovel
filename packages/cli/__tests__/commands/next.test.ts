import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  getActiveState,
  readSession,
  getAllStates,
  type TestWorkspace,
} from '../helpers/test-utils.js';

describe('next command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('standard advance (bare next)', () => {
    beforeEach(async () => {
      runCli('start workflows/simple.workflow.md', workspace);
    });

    it('increments task number', async () => {
      runCli('next', workspace);

      const state = await getActiveState(workspace);
      expect(state?.task).toBe(2);
    });

    it('resets retryCount to 0', async () => {
      // First set retry count via --retry
      runCli('next --retry', workspace);
      let state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(1);

      // Now advance
      runCli('next', workspace);
      state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(0);
    });

    it('updates taskName from workflow', async () => {
      runCli('next', workspace);

      const state = await getActiveState(workspace);
      expect(state?.taskName).toContain('Second task');
    });

    it('outputs next task info', async () => {
      const result = runCli('next', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Task 2');
      expect(result.stdout).toContain('Second task');
    });

    it('fails if no active workflow', async () => {
      runCli('stop', workspace);

      const result = runCli('next', workspace);
      expect(result.stdout).toContain('No active workflow');
    });

    it('completes workflow when advancing past last task', async () => {
      runCli('next', workspace); // Task 1 -> 2

      const result = runCli('next', workspace); // Task 2 -> complete
      expect(result.stdout).toContain('complete');

      const session = await readSession(workspace);
      expect(session.active).toBeNull();
    });
  });

  describe('step jump (--step N)', () => {
    beforeEach(async () => {
      runCli('start workflows/goto.workflow.md', workspace);
    });

    it('jumps to specified task number', async () => {
      const result = runCli('next --step 3', workspace);

      expect(result.exitCode).toBe(0);
      const state = await getActiveState(workspace);
      expect(state?.task).toBe(3);
    });

    it('resets retryCount on jump', async () => {
      runCli('next --retry', workspace);
      runCli('next --step 3', workspace);

      const state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(0);
    });

    it('outputs jumped task info', async () => {
      const result = runCli('next --step 3', workspace);

      expect(result.stdout).toContain('Task 3');
      expect(result.stdout).toContain('Jump target');
    });
  });

  describe('retry (--retry)', () => {
    beforeEach(async () => {
      runCli('start workflows/retry.workflow.md', workspace);
    });

    it('increments retryCount', async () => {
      runCli('next --retry', workspace);

      const state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(1);
    });

    it('keeps same task number', async () => {
      runCli('next --retry', workspace);

      const state = await getActiveState(workspace);
      expect(state?.task).toBe(1);
    });

    it('outputs retry count', async () => {
      const result = runCli('next --retry', workspace);

      expect(result.stdout).toContain('Retry 1/');
    });

    it('fails if retryCount exceeds retryMax', async () => {
      // Default retryMax is 3
      runCli('next --retry', workspace); // 1
      runCli('next --retry', workspace); // 2
      runCli('next --retry', workspace); // 3

      const result = runCli('next --retry', workspace); // 4 - should fail
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Max retries');
    });
  });

  describe('pass condition (--pass)', () => {
    describe('PASS: CONTINUE', () => {
      beforeEach(async () => {
        runCli('start workflows/simple.workflow.md', workspace);
      });

      it('advances to next task', async () => {
        const result = runCli('next --pass', workspace);

        expect(result.exitCode).toBe(0);
        const state = await getActiveState(workspace);
        expect(state?.task).toBe(2);
      });
    });

    describe('PASS: DONE', () => {
      beforeEach(async () => {
        runCli('start workflows/simple.workflow.md', workspace);
        runCli('next', workspace); // Advance to task 2 which has PASS: DONE
      });

      it('marks workflow complete', async () => {
        const result = runCli('next --pass', workspace);

        expect(result.stdout).toContain('complete');
      });

      it('clears active workflow', async () => {
        runCli('next --pass', workspace);

        const session = await readSession(workspace);
        expect(session.active).toBeNull();
      });

      it('should set variables.completed=true when completing workflow', async () => {
        runCli('next --pass', workspace);

        const states = await getAllStates(workspace);
        const state = states.find(s => s.workflow === 'workflows/simple.workflow.md');
        expect(state?.variables.completed).toBe(true);
      });
    });

    describe('PASS: GOTO N', () => {
      beforeEach(async () => {
        runCli('start workflows/goto.workflow.md', workspace);
      });

      it('jumps to specified task', async () => {
        const result = runCli('next --pass', workspace);

        expect(result.exitCode).toBe(0);
        const state = await getActiveState(workspace);
        expect(state?.task).toBe(3); // GOTO 3
      });

      it('skips intermediate tasks', async () => {
        runCli('next --pass', workspace);

        const state = await getActiveState(workspace);
        expect(state?.taskName).toContain('Jump target');
      });
    });
  });

  describe('fail condition (--fail)', () => {
    describe('FAIL: RETRY N', () => {
      beforeEach(async () => {
        runCli('start workflows/retry.workflow.md', workspace);
      });

      it('increments retryCount if under max', async () => {
        runCli('next --fail', workspace);

        const state = await getActiveState(workspace);
        expect(state?.retryCount).toBe(1);
        expect(state?.task).toBe(1); // Same task
      });

      it('outputs retry info', async () => {
        const result = runCli('next --fail', workspace);

        expect(result.stdout).toContain('Retry');
      });
    });

    describe('FAIL: STOP', () => {
      beforeEach(async () => {
        runCli('start workflows/simple.workflow.md', workspace);
      });

      it('blocks workflow', async () => {
        const result = runCli('next --fail', workspace);

        expect(result.exitCode).toBe(1);
      });

      it('outputs error message', async () => {
        const result = runCli('next --fail', workspace);

        expect(result.stderr.length).toBeGreaterThan(0);
      });

      it('should set variables.blocked=true when STOP action triggered', async () => {
        runCli('next --fail', workspace);

        const state = await getActiveState(workspace);
        expect(state?.variables.blocked).toBe(true);
      });
    });

    describe('FAIL: GOTO N', () => {
      beforeEach(async () => {
        runCli('start workflows/fail-goto.workflow.md', workspace);
      });

      it('jumps to specified task on failure', async () => {
        const result = runCli('next --fail', workspace);

        expect(result.exitCode).toBe(0);
        const state = await getActiveState(workspace);
        expect(state?.task).toBe(3); // GOTO 3 on FAIL
      });
    });
  });

  describe('child workflow completion restores parent', () => {
    it('should restore parent workflow as active when child completes via next', async () => {
      // Start parent workflow
      runCli('start workflows/simple.workflow.md', workspace);
      const session1 = await readSession(workspace);
      const parentId = session1.active;
      expect(parentId).not.toBeNull();

      // Queue task and bind agent with child workflow
      runCli(['start', '--task', '1.1', 'workflows/simple.workflow.md'], workspace);
      runCli(['start', '--agent', 'test-agent', 'workflows/simple.workflow.md'], workspace);

      // Verify child is now active
      const session2 = await readSession(workspace);
      const childId = session2.active;
      expect(childId).not.toBe(parentId);
      expect(childId).not.toBeNull();

      // Verify child has parent reference
      const allStates = await getAllStates(workspace);
      const childState = allStates.find((s) => s.id === childId);
      expect(childState?.parentWorkflowId).toBe(parentId);

      // Complete child workflow (advance to end)
      runCli('next', workspace); // Task 1 -> 2
      runCli('next', workspace); // Task 2 -> complete

      // Parent should now be active
      const session3 = await readSession(workspace);
      expect(session3.active).toBe(parentId);

      // Verify output confirms parent restoration
      const result = runCli('status', workspace);
      expect(result.stdout).toContain('simple.workflow.md');
    });

    it('should restore parent workflow as active when child completes via --pass', async () => {
      // Start parent workflow
      runCli('start workflows/simple.workflow.md', workspace);
      const session1 = await readSession(workspace);
      const parentId = session1.active;

      // Queue task and bind agent with child workflow
      runCli(['start', '--task', '1.1', 'workflows/simple.workflow.md'], workspace);
      runCli(['start', '--agent', 'test-agent', 'workflows/simple.workflow.md'], workspace);

      // Verify child is now active
      const session2 = await readSession(workspace);
      const childId = session2.active;

      // Mark child workflow task as passed
      runCli('next --pass', workspace); // Task 1: CONTINUE -> Task 2
      runCli('next --pass', workspace); // Task 2: DONE -> complete

      // Parent should now be active
      const session3 = await readSession(workspace);
      expect(session3.active).toBe(parentId);
    });
  });
});
