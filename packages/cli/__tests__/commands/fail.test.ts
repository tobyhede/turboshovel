import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
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

  describe('workflow fail with stack', () => {
    it('agent workflow pops and blocks when fail causes STOP', async () => {
      // Create a single-step workflow that blocks on fail
      const singleStep = `## 1. Do it

- PASS: DONE
- FAIL: STOP
`;
      await mkdir(join(workspace.cwd, 'workflows'), { recursive: true });
      await writeFile(join(workspace.cwd, 'workflows', 'single-fail.md'), singleStep);

      runCli('start --prompted workflows/single-fail.md --agent agent-001', workspace);

      // Fail workflow - should block and pop
      const result = runCli('fail --agent agent-001', workspace);
      expect(result.exitCode).toBe(1);

      // Agent stack should be empty
      const statusResult = runCli('status --agent agent-001', workspace);
      expect(statusResult.stdout).toContain('No active workflow');
    });

    it('pops to parent workflow on fail completion', async () => {
      // Create parent/child workflows
      const parentWorkflow = `## 1. Step one

Do something.

- PASS: DONE
- FAIL: DONE
`;
      const childWorkflow = `## 1. Step one

Do work.

- PASS: DONE
- FAIL: DONE
`;
      await mkdir(join(workspace.cwd, 'workflows'), { recursive: true });
      await writeFile(join(workspace.cwd, 'workflows', 'parent-fail.md'), parentWorkflow);
      await writeFile(join(workspace.cwd, 'workflows', 'child-fail.md'), childWorkflow);

      // Start parent (prompted to prevent auto-completion)
      runCli('start --prompted workflows/parent-fail.md', workspace);

      // Start child in same stack (prompted to prevent auto-completion)
      runCli('start --prompted workflows/child-fail.md', workspace);

      // Fail child - should complete (FAIL: DONE) and pop to parent
      const result = runCli('fail', workspace);
      expect(result.stdout).toContain('complete');

      // Should now be on parent
      const statusResult = runCli('status', workspace);
      expect(statusResult.stdout).toContain('parent-fail.md');
    });
  });
});
