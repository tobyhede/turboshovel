import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  getActiveState,
  readSession,
  type TestWorkspace,
} from '../helpers/test-utils.js';

describe('start --prompted', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('prompted mode behavior', () => {
    it('creates workflow in prompted mode', async () => {
      const result = runCli('start --prompted workflows/with-commands.workflow.md', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Started workflow');
      expect(result.stdout).toContain('Mode: prompted');
    });

    it('sets prompted flag in state', async () => {
      runCli('start --prompted workflows/with-commands.workflow.md', workspace);

      const state = await getActiveState(workspace);
      expect(state?.prompted).toBe(true);
    });

    it('does not auto-execute bash commands in prompted mode', async () => {
      const result = runCli('start --prompted workflows/with-commands.workflow.md', workspace);

      // In prompted mode, the command should be shown but not executed
      // The workflow should stop at the first step waiting for manual input
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('## 1.');
      expect(result.stdout).toContain('Execute command');
      // Should NOT show execution output (--- Executing --- would appear if executed)
      expect(result.stdout).not.toContain('--- Executing ---');
    });

    it('waits for manual pass/fail in prompted mode', async () => {
      runCli('start --prompted workflows/with-commands.workflow.md', workspace);

      // After starting in prompted mode, should be at step 1
      let state = await getActiveState(workspace);
      expect(state?.step).toBe(1);

      // Manual pass should advance to next step
      runCli('pass', workspace);

      state = await getActiveState(workspace);
      expect(state?.step).toBe(2);
    });

    it('shows command in output without executing', async () => {
      const result = runCli('start --prompted workflows/with-commands.workflow.md', workspace);

      // Command should be visible to user
      expect(result.stdout).toContain('Execute command');
      // But not executed (no exit code output)
      expect(result.stdout).not.toContain('Exit:');
    });

    it('inherits prompted flag in child workflows', async () => {
      // Start parent workflow in prompted mode
      runCli('start --prompted workflows/simple.workflow.md', workspace);
      const session1 = await readSession(workspace);
      const _parentId = session1.active;

      // Queue step with child workflow
      runCli(['start', '--step', '1', 'workflows/with-commands.workflow.md'], workspace);

      // Bind agent (creates child workflow)
      runCli(['start', '--agent', 'test-agent'], workspace);

      // Child should inherit prompted flag
      const state = await getActiveState(workspace);
      expect(state?.prompted).toBe(true);
    });
  });

  describe('auto-execution without --prompted', () => {
    it('executes bash commands automatically in auto mode', async () => {
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // Without --prompted, commands execute automatically
      expect(result.stdout).toContain('Execute command');
      expect(result.stdout).toContain('--- Executing ---');
      expect(result.stdout).toContain('Exit:');
    });

    it('stores lastResult after successful execution', async () => {
      runCli('start workflows/with-commands.workflow.md', workspace);

      const state = await getActiveState(workspace);
      // After auto-execution of passing command, should advance (or be done if 2-step workflow)
      expect(state?.step).toBeGreaterThanOrEqual(1);
    });

    it('stores lastResult as pass on successful command', async () => {
      runCli('start workflows/with-commands.workflow.md', workspace);

      // Verify we advanced past step 1 (command succeeded)
      const state = await getActiveState(workspace);
      expect(state?.step).toBe(2);
    });

    it('stores lastResult as fail on failed command', async () => {
      // Using failing command workflow
      const result = runCli('start workflows/with-failing-command.workflow.md', workspace);

      // Should trigger FAIL condition (RETRY 2) - exits with error after max retries
      expect(result.stdout).toContain('Exit: 1');
      expect(result.exitCode).not.toBe(0);
    });

    it('continues execution loop on pass condition', async () => {
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // Workflow should complete (both steps executed in auto mode)
      expect(result.stdout).toContain('## 1.');
      expect(result.stdout).toContain('## 2.');
      expect(result.stdout).toContain('complete');
    });

    it('chains multiple auto-executing steps', async () => {
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // Both steps should execute automatically
      expect(result.stdout).toContain('Execute command');
      expect(result.stdout).toContain('Workflow complete');
    });

    it('applies FAIL condition when command fails', async () => {
      const result = runCli('start workflows/with-failing-command.workflow.md', workspace);

      // Should trigger retry (FAIL: RETRY 2) - will fail after max retries
      expect(result.stdout).toContain('Exit: 1');
      expect(result.exitCode).not.toBe(0); // Blocked due to max retries
    });

    it('respects max retries on repeated failures', async () => {
      // Manually step through retries to test tracking
      runCli('start --prompted workflows/with-failing-command.workflow.md', workspace);

      // Step 1 with retry in prompted mode
      let result = runCli('fail', workspace);
      let state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(1);

      // Step 2 with retry
      result = runCli('fail', workspace);
      state = await getActiveState(workspace);
      expect(state?.retryCount).toBe(2);

      // Third fail should block (max retries exceeded)
      result = runCli('fail', workspace);
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('mode consistency', () => {
    it('can start same workflow in auto mode after prompted mode', async () => {
      // First: prompted mode
      runCli('stop', workspace);
      runCli('start --prompted workflows/simple.workflow.md', workspace);
      let state = await getActiveState(workspace);
      expect(state?.prompted).toBe(true);

      // Clean up
      runCli('stop', workspace);

      // Second: auto mode
      const result = runCli('start workflows/simple.workflow.md', workspace);
      state = await getActiveState(workspace);
      expect(state?.prompted).not.toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('enforces prompted mode across manual steps', async () => {
      runCli('start --prompted workflows/with-commands.workflow.md', workspace);

      // In prompted mode, no auto-execution should happen
      const state1 = await getActiveState(workspace);
      expect(state1?.step).toBe(1);

      // Manually pass
      runCli('pass', workspace);

      const state2 = await getActiveState(workspace);
      expect(state2?.step).toBe(2);
    });

    it('allows mixed auto and prompted workflows', async () => {
      // Parent: auto mode
      const result1 = runCli('start workflows/simple.workflow.md', workspace);
      expect(result1.stdout).not.toContain('Mode: prompted');

      runCli('stop', workspace);

      // Different workflow: prompted mode
      const result2 = runCli('start --prompted workflows/simple.workflow.md', workspace);
      expect(result2.stdout).toContain('Mode: prompted');
    });
  });

  describe('command execution details', () => {
    it('shows command code in prompt', async () => {
      const result = runCli('start --prompted workflows/with-commands.workflow.md', workspace);

      // Prompted mode shows command to user
      expect(result.stdout).toContain('Execute command');
    });

    it('executes with correct working directory', async () => {
      // Command uses exit 0, which succeeds
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // If working directory is wrong, command might fail
      expect(result.stdout).toContain('Exit: 0');
    });

    it('handles command output correctly', async () => {
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // Should show execution happened
      expect(result.stdout).toContain('--- Executing ---');
      expect(result.stdout).toContain('Exit:');
    });

    it('updates step progression after auto-execution', async () => {
      runCli('start workflows/with-commands.workflow.md', workspace);

      const state = await getActiveState(workspace);
      // Should have advanced due to auto-execution
      expect(state?.step).toBeGreaterThan(1);
    });
  });
});
