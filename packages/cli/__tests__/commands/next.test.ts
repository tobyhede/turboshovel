import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  getActiveState,
  readSession,
  writeSession,
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

    it('increments step number', async () => {
      runCli('next', workspace);

      const state = await getActiveState(workspace);
      expect(state?.step).toBe(2);
    });

    it('resets retryCount to 0', async () => {
      runCli('stop', workspace);
      runCli('start workflows/retry.workflow.md', workspace);
      
      runCli('next --retry', workspace);
      let state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(1);

      // Now advance
      runCli('next', workspace);
      state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(0);
    });

    it('updates stepName from workflow', async () => {
      runCli('next', workspace);

      const state = await getActiveState(workspace);
      expect(state?.stepName).toContain('Second step');
    });

    it('outputs next step info', async () => {
      const result = runCli('next', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Step 2');
      expect(result.stdout).toContain('Second step');
    });

    it('fails if no active workflow', async () => {
      runCli('stop', workspace);

      const result = runCli('next', workspace);
      expect(result.stdout).toContain('No active workflow');
    });

    it('completes workflow when advancing past last step', async () => {
      runCli('next', workspace); // Step 1 -> 2

      const result = runCli('next', workspace); // Step 2 -> complete
      expect(result.stdout).toContain('complete');

      const session = await readSession(workspace);
      expect(session.active).toBeNull();
    });
  });

  describe('step jump (--goto N)', () => {
    beforeEach(async () => {
      runCli('start workflows/goto.workflow.md', workspace);
    });

    it('jumps to specified step number', async () => {
      const result = runCli('next --goto 3', workspace);

      expect(result.exitCode).toBe(0);
      const state = await getActiveState(workspace);
      expect(state?.step).toBe(3);
    });

    it('resets retryCount on jump', async () => {
      runCli('stop', workspace);
      runCli('start workflows/retry.workflow.md', workspace);
      
      runCli('next --retry', workspace);
      runCli('next --goto 2', workspace);

      const state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(0);
    });

    it('outputs jumped step info', async () => {
      const result = runCli('next --goto 3', workspace);

      expect(result.stdout).toContain('Step 3');
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

    it('keeps same step number', async () => {
      runCli('next --retry', workspace);

      const state = await getActiveState(workspace);
      expect(state?.step).toBe(1);
    });

    it('outputs retry count', async () => {
      const result = runCli('next --retry', workspace);

      expect(result.stdout).toContain('Retry 1/');
    });

    it('fails when retry limit is exceeded', async () => {
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

      it('advances to next step', async () => {
        const result = runCli('next --pass', workspace);

        expect(result.exitCode).toBe(0);
        const state = await getActiveState(workspace);
        expect(state?.step).toBe(2);
      });
    });

    describe('PASS: DONE', () => {
      beforeEach(async () => {
        runCli('start workflows/simple.workflow.md', workspace);
        runCli('next', workspace); // Advance to step 2 which has PASS: DONE
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

      it('jumps to specified step', async () => {
        const result = runCli('next --pass', workspace);

        expect(result.exitCode).toBe(0);
        const state = await getActiveState(workspace);
        expect(state?.step).toBe(3); // GOTO 3
      });

      it('skips intermediate steps', async () => {
        runCli('next --pass', workspace);

        const state = await getActiveState(workspace);
        expect(state?.stepName).toContain('Jump target');
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
        expect(state?.step).toBe(1); // Same step
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

      it('jumps to specified step on failure', async () => {
        const result = runCli('next --fail', workspace);

        expect(result.exitCode).toBe(0);
        const state = await getActiveState(workspace);
        expect(state?.step).toBe(3); // GOTO 3 on FAIL
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

      // Queue step and bind agent with child workflow
      runCli(['start', '--step', '1.1', 'workflows/simple.workflow.md'], workspace);
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
      runCli('next', workspace); // Step 1 -> 2
      runCli('next', workspace); // Step 2 -> complete

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

      // Queue step and bind agent with child workflow
      runCli(['start', '--step', '1.1', 'workflows/simple.workflow.md'], workspace);
      runCli(['start', '--agent', 'test-agent', 'workflows/simple.workflow.md'], workspace);

      // Verify child is now active
      const session2 = await readSession(workspace);
      const _childId = session2.active;

      // Mark child workflow step as passed
      runCli('next --pass', workspace); // Step 1: CONTINUE -> Step 2
      runCli('next --pass', workspace); // Step 2: DONE -> complete

      // Parent should now be active
      const session3 = await readSession(workspace);
      expect(session3.active).toBe(parentId);
    });
  });

  describe('blocks agent completion while child workflow active', () => {
    it('should error when trying to complete agent with active child workflow', async () => {
      // Start parent workflow
      runCli('start workflows/simple.workflow.md', workspace);
      const session1 = await readSession(workspace);
      const parentId = session1.active;

      // Queue step and bind agent with child workflow
      runCli(['start', '--step', '1.1', 'workflows/simple.workflow.md'], workspace);
      runCli(['start', '--agent', 'test-agent', 'workflows/simple.workflow.md'], workspace);

      // Child workflow is now active - DO NOT complete it
      // Manually set parent as active to test the blocking behavior
      await writeSession(workspace, { active: parentId });

      // Verify parent is active
      const session2 = await readSession(workspace);
      expect(session2.active).toBe(parentId);

      // Try to complete agent in parent while child is still running (should fail)
      const result = runCli(['next', '--pass', '--agent', 'test-agent'], workspace);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Child workflow still active');
    });
  });
});