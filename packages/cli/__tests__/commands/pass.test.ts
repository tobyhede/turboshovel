import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  getActiveState,
  readSession,
  getAllStates,
  writeSession,
  type TestWorkspace,
} from '../helpers/test-utils.js';

describe('pass command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('PASS: CONTINUE', () => {
    beforeEach(async () => {
      runCli('start workflows/simple.workflow.md', workspace);
    });

    it('advances to next step', async () => {
      const result = runCli('pass', workspace);

      expect(result.exitCode).toBe(0);
      const state = await getActiveState(workspace);
      expect(state?.step).toBe(2);
    });
  });

  describe('PASS: DONE', () => {
    beforeEach(async () => {
      runCli('start workflows/simple.workflow.md', workspace);
      runCli('pass', workspace); // Advance to step 2 which has PASS: DONE
    });

    it('marks workflow complete', async () => {
      const result = runCli('pass', workspace);

      expect(result.stdout).toContain('complete');
    });

    it('clears active workflow', async () => {
      runCli('pass', workspace);

      const session = await readSession(workspace);
      expect(session.active).toBeNull();
    });

    it('should set variables.completed=true when completing workflow', async () => {
      runCli('pass', workspace);

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
      const result = runCli('pass', workspace);

      expect(result.exitCode).toBe(0);
      const state = await getActiveState(workspace);
      expect(state?.step).toBe(3); // GOTO 3
    });

    it('skips intermediate steps', async () => {
      runCli('pass', workspace);

      const state = await getActiveState(workspace);
      expect(state?.stepName).toContain('Jump target');
    });
  });

  describe('child workflow completion restores parent', () => {
    it('should restore parent workflow as active when child completes via pass', async () => {
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
      runCli('pass', workspace); // Step 1: CONTINUE -> Step 2
      runCli('pass', workspace); // Step 2: DONE -> complete

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
      const result = runCli(['pass', '--agent', 'test-agent'], workspace);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Child workflow still active');
    });
  });
});
