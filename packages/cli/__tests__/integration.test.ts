import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  readSession,
  getActiveState,
  type TestWorkspace,
} from './helpers/test-utils.js';

describe('integration: full workflow scenarios', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('completes simple two-step workflow', async () => {
    // Start workflow
    let result = runCli('start workflows/simple.workflow.md', workspace);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('## 1.');

    // Advance to step 2
    result = runCli('next', workspace);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Step 2');

    // Complete workflow
    result = runCli('next', workspace);
    expect(result.stdout).toContain('complete');

    // Verify no active workflow
    const session = await readSession(workspace);
    expect(session.active).toBeNull();
  });

  it('handles retry then success flow', async () => {
    runCli('start workflows/retry.workflow.md', workspace);

    // Fail first attempt
    let result = runCli('next --fail', workspace);
    expect(result.stdout).toContain('Retry 1/');

    // Fail second attempt
    result = runCli('next --fail', workspace);
    expect(result.stdout).toContain('Retry 2/');

    // Pass third attempt
    result = runCli('next --pass', workspace);
    expect(result.stdout).toContain('Step 2');

    // Complete
    result = runCli('next --pass', workspace);
    expect(result.stdout).toContain('complete');
  });

  it('handles GOTO flow', async () => {
    runCli('start workflows/goto.workflow.md', workspace);

    // Pass step 1 which GOTOs step 3
    let result = runCli('next --pass', workspace);
    expect(result.stdout).toContain('Step 3');

    // Verify we're at step 3
    const state = await getActiveState(workspace);
    expect(state?.step).toBe(3);

    // Complete from step 3
    result = runCli('next --pass', workspace);
    expect(result.stdout).toContain('complete');
  });

  it('handles stash and pop during workflow', async () => {
    runCli('start workflows/simple.workflow.md', workspace);
    runCli('next', workspace); // Advance to step 2

    // Stash
    let result = runCli('stash', workspace);
    expect(result.stdout).toContain('stashed');

    // Verify no active workflow
    result = runCli('status', workspace);
    expect(result.stdout).toContain('stashed');

    // Pop
    result = runCli('pop', workspace);
    expect(result.stdout).toContain('restored');
    expect(result.stdout).toContain('Second step');

    // Continue and complete
    result = runCli('next', workspace);
    expect(result.stdout).toContain('complete');
  });

  it('handles agent binding workflow', async () => {
    runCli('start workflows/simple.workflow.md', workspace);

    // Queue steps for agents
    runCli('start --step 1', workspace);
    runCli('start --step 2', workspace);

    // Bind first agent
    let result = runCli('start --agent agent-1', workspace);
    expect(result.stdout).toContain('agent-1');
    expect(result.stdout).toContain('bound');

    // Bind second agent
    result = runCli('start --agent agent-2', workspace);
    expect(result.stdout).toContain('agent-2');
    expect(result.stdout).toContain('bound');

    // Check status shows both agents
    result = runCli('status', workspace);
    expect(result.stdout).toContain('agent-1');
    expect(result.stdout).toContain('agent-2');

    // Complete agents
    result = runCli('next --pass --agent agent-1', workspace);
    expect(result.stdout).toContain('pass');

    result = runCli('next --pass --agent agent-2', workspace);
    expect(result.stdout).toContain('All agents complete');
  });
});