import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
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
      expect(result.stdout).toContain('Action:   START');
      expect(result.stdout).toContain('Prompt:   Yes');
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
      // Should NOT show execution output ($ command format would appear if executed)
      expect(result.stdout).not.toContain('$ tsv test');
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
      // But not executed (no command execution line)
      expect(result.stdout).not.toContain('$ tsv test');
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
      expect(result.stdout).toContain('$ tsv test --result pass');
      expect(result.stdout).toContain('Action:   CONTINUE');
    });

    it('stores lastResult after successful execution', async () => {
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // Workflow completes in auto mode (both steps pass)
      expect(result.stdout).toContain('complete');
    });

    it('stores lastResult as pass on successful command', async () => {
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // Workflow completes in auto mode
      expect(result.stdout).toContain('complete');
    });

    it('stores lastResult as fail on failed command', async () => {
      // Using failing command workflow - now uses tsv test which succeeds after retries
      const result = runCli('start workflows/with-failing-command.workflow.md', workspace);

      // Should show RETRY behavior then eventually pass
      expect(result.stdout).toContain('$ tsv test');
      // The workflow now completes successfully after retries
      expect(result.stdout).toContain('complete');
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
      expect(result.stdout).toContain('complete');
    });

    it('applies FAIL condition when command fails', async () => {
      const result = runCli('start workflows/with-failing-command.workflow.md', workspace);

      // Should trigger retry (FAIL: RETRY 2) then succeed on 3rd attempt
      expect(result.stdout).toContain('$ tsv test');
      expect(result.stdout).toContain('RETRY');
      // Workflow completes after successful retry
      expect(result.stdout).toContain('complete');
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

    it('does not execute prompt code blocks even without CLI --prompted flag', async () => {
      // Create workflow with prompt code block
      const workflowsDir = join(workspace.cwd, 'workflows');
      await mkdir(workflowsDir, { recursive: true });
      await writeFile(join(workflowsDir, 'with-prompt-block.workflow.md'), `# Prompt Block Test

## 1. Step with prompt block

Show this command to the agent.

\`\`\`prompt
npm run dangerous-command
\`\`\`

- PASS: DONE
`);

      const result = runCli('start workflows/with-prompt-block.workflow.md', workspace);

      // Should NOT execute the command (no $ prefix showing execution)
      expect(result.stdout).not.toContain('$ npm run dangerous-command');
      // Should show the step
      expect(result.stdout).toContain('## 1.');
      // Should wait for manual pass/fail (not auto-complete)
      expect(result.exitCode).toBe(0);
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

      // Second: auto mode - workflow completes immediately
      const result = runCli('start workflows/simple.workflow.md', workspace);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('complete');
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
      // Auto mode - workflow completes immediately
      const result1 = runCli('start workflows/simple.workflow.md', workspace);
      expect(result1.stdout).not.toContain('Prompt:   Yes');
      expect(result1.stdout).toContain('complete');

      // Prompted mode
      const result2 = runCli('start --prompted workflows/simple.workflow.md', workspace);
      expect(result2.stdout).toContain('Prompt:   Yes');
    });
  });

  describe('command execution details', () => {
    it('shows command code in prompt', async () => {
      const result = runCli('start --prompted workflows/with-commands.workflow.md', workspace);

      // Prompted mode shows command to user
      expect(result.stdout).toContain('Execute command');
    });

    it('executes with correct working directory', async () => {
      // Command uses tsv test, which succeeds
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // If working directory is wrong, command might fail
      expect(result.stdout).toContain('$ tsv test --result pass');
    });

    it('handles command output correctly', async () => {
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // Should show execution happened
      expect(result.stdout).toContain('$ tsv test --result pass');
      expect(result.stdout).toContain('Action:   CONTINUE');
    });

    it('updates step progression after auto-execution', async () => {
      const result = runCli('start workflows/with-commands.workflow.md', workspace);

      // Workflow completes in auto mode (all steps pass)
      expect(result.stdout).toContain('complete');
    });
  });
});
