import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  getActiveState,
  getAllStates,
  type TestWorkspace,
} from '../helpers/test-utils.js';

describe('fail command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('FAIL: RETRY N', () => {
    beforeEach(async () => {
      runCli('start --prompted workflows/retry.workflow.md', workspace);
    });

    it('increments retryCount if under max', async () => {
      runCli('fail', workspace);

      const state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(1);
      expect(state?.step).toBe(1); // Same step
    });

    it('outputs retry info', async () => {
      const result = runCli('fail', workspace);

      expect(result.stdout).toContain('Retry');
    });
  });

  describe('FAIL: STOP', () => {
    beforeEach(async () => {
      runCli('start --prompted workflows/simple.workflow.md', workspace);
    });

    it('blocks workflow', async () => {
      const result = runCli('fail', workspace);

      expect(result.exitCode).toBe(1);
    });

    it('outputs error message', async () => {
      const result = runCli('fail', workspace);

      expect(result.stdout).toContain('blocked');
    });

    it('should set variables.blocked=true when STOP action triggered', async () => {
      // workflow already started by beforeEach
      runCli('fail', workspace);

      // After blocking, the workflow is saved but no longer active
      // Retrieve from all states
      const states = await getAllStates(workspace);
      const state = states.find(s => s.workflow === 'workflows/simple.workflow.md');
      expect(state?.variables.blocked).toBe(true);
    });
  });

  describe('FAIL: GOTO N', () => {
    beforeEach(async () => {
      runCli('start --prompted workflows/fail-goto.workflow.md', workspace);
    });

    it('jumps to specified step on failure', async () => {
      const result = runCli('fail', workspace);

      expect(result.exitCode).toBe(0);
      const state = await getActiveState(workspace);
      expect(state?.step).toBe(3); // GOTO 3 on FAIL
    });
  });
});
