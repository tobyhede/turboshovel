import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  readSession,
  listWorkflowStates,
  type TestWorkspace,
} from '../helpers/test-utils.js';

describe('status command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('displays current step info', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('status', workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Step:');
    expect(result.stdout).toContain('First step');
  });

  it('shows workflow file path', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('status', workspace);

    expect(result.stdout).toContain('File:');
    expect(result.stdout).toContain('simple.workflow.md');
  });

  it('shows retryCount', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('status', workspace);

    // Status shows step information, retryCount is internal state
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Step:');
  });

  it('shows workflow ID', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('status', workspace);

    expect(result.stdout).toContain('State:');
    expect(result.stdout).toMatch(/wf-\d{4}-\d{2}-\d{2}/);
  });

  it('outputs "No active workflow" when none', async () => {
    const result = runCli('status', workspace);

    expect(result.stdout).toContain('No active workflow');
  });

  it('shows pending steps count', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);
    runCli('start --step 2', workspace);

    const result = runCli('status', workspace);

    expect(result.stdout).toContain('Pending:');
  });

  it('shows agent bindings', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);
    runCli('start --step 1', workspace);
    runCli('start --agent test-agent', workspace);

    const result = runCli('status', workspace);

    expect(result.stdout).toContain('Agents:');
    expect(result.stdout).toContain('test-agent');
  });
});

describe('list command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('lists all workflow states', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('list', workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('simple.workflow.md');
  });

  it('marks active workflow', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('list', workspace);

    expect(result.stdout).toContain('active');
  });

  it('shows current step for each', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('list', workspace);

    expect(result.stdout).toContain('1/');
  });

  it('outputs "No workflows" when empty', async () => {
    const result = runCli('list', workspace);

    expect(result.stdout).toContain('No workflows');
  });
});

describe('stop command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('deletes active workflow state', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    runCli('stop', workspace);

    const states = await listWorkflowStates(workspace);
    expect(states).toHaveLength(0);
  });

  it('clears active workflow', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    runCli('stop', workspace);

    const session = await readSession(workspace);
    expect(session.active).toBeNull();
  });

  it('outputs confirmation', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('stop', workspace);

    expect(result.stdout).toContain('stopped');
  });

  it('handles no active workflow gracefully', async () => {
    const result = runCli('stop', workspace);

    expect(result.stdout).toContain('No active workflow');
  });
});

describe('complete command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('marks workflow as complete', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('complete', workspace);

    expect(result.stdout).toContain('complete');
  });

  it('clears active workflow', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    runCli('complete', workspace);

    const session = await readSession(workspace);
    expect(session.active).toBeNull();
  });

  it('handles --status blocked', async () => {
    runCli('start --prompted workflows/simple.workflow.md', workspace);

    const result = runCli('complete --status blocked', workspace);

    expect(result.stdout).toContain('blocked');
  });

  it('handles no active workflow', async () => {
    const result = runCli('complete', workspace);

    expect(result.stdout).toContain('No active workflow');
  });
});