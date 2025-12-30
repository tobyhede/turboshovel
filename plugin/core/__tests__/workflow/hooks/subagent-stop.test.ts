// __tests__/workflow/hooks/subagent-stop.test.ts
import { jest } from '@jest/globals';
import {
  handleSubagentStop
} from '../../../src/workflow/hooks/subagent-stop.js';
import { WorkflowStateManager, type HookInput, createTaskNumber } from '@turboshovel/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('handleSubagentStop with agent binding', () => {
  let testDir: string;
  let manager: WorkflowStateManager;
  const mockExecSync = jest.fn(() => 'Workflow advanced');

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-stop-test-'));
    manager = new WorkflowStateManager(testDir);
    jest.clearAllMocks();

    // Set the mock for this test suite
    const module = await import('../../../src/workflow/hooks/subagent-stop.js');
    module.setExecSync(mockExecSync);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    // Reset to original execSync
    const module = await import('../../../src/workflow/hooks/subagent-stop.js');
    const { execSync } = await import('child_process');
    module.setExecSync(execSync);
  });

  it('calls CLI with --pass flag on success', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(2)! });
    await manager.bindAgent(state.id, 'agent-xyz', { task: createTaskNumber(2)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-xyz',
      output: 'STATUS: OK'
    };

    const result = await handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      'tsv next --pass --agent agent-xyz',
      expect.any(Object)
    );
    expect(result.context).toContain('complete');
  });

  it('calls CLI with --fail flag on failure', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.bindAgent(state.id, 'agent-abc', { task: createTaskNumber(1)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-abc',
      output: 'STATUS: BLOCKED\nCould not complete task.'
    };

    const result = await handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      'tsv next --fail --agent agent-abc',
      expect.any(Object)
    );
    expect(result.context).toContain('FAILED');
  });

  it('returns violation when CLI rejects unknown agent', async () => {
    // Mock execSync to throw an error for unknown agent
    const errorMock = jest.fn(() => {
      const error = new Error('No binding for agent');
      (error as any).stderr = 'No binding for agent unknown-agent';
      throw error;
    });
    const module = await import('../../../src/workflow/hooks/subagent-stop.js');
    module.setExecSync(errorMock);

    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'unknown-agent'
    };

    const result = await handleSubagentStop(input);

    expect(result.violation).toContain('unknown agent');
  });

  it('defaults to pass flag when no STATUS in output', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.bindAgent(state.id, 'agent-xyz', { task: createTaskNumber(1)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-xyz',
      output: 'Task completed successfully.'
    };

    await handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      'tsv next --pass --agent agent-xyz',
      expect.any(Object)
    );
  });
});

describe('handleSubagentStop calls CLI', () => {
  let testDir: string;
  const mockExecSync = jest.fn(() => '');

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-stop-cli-test-'));
    jest.clearAllMocks();

    // Import and set mock
    const module = await import('../../../src/workflow/hooks/subagent-stop.js');
    module.setExecSync(mockExecSync);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    // Reset to original execSync
    const module = await import('../../../src/workflow/hooks/subagent-stop.js');
    const { execSync } = await import('child_process');
    module.setExecSync(execSync);
  });

  it('should call tsv next --pass --agent on success', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      agent_id: 'abc123',
      output: 'STATUS: PASS\nWork completed successfully.',
      cwd: testDir
    };

    await handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      'tsv next --pass --agent abc123',
      expect.any(Object)
    );
  });

  it('should call tsv next --fail --agent on failure', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      agent_id: 'abc123',
      output: 'STATUS: BLOCKED\nCould not complete.',
      cwd: testDir
    };

    await handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      'tsv next --fail --agent abc123',
      expect.any(Object)
    );
  });
});
