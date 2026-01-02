// __tests__/workflow/hooks/subagent-stop.test.ts
import { jest } from '@jest/globals';
import {
  handleSubagentStop
} from '../../../src/workflow/hooks/subagent-stop.js';
import { WorkflowStateManager, type HookInput, createStepNumber, Step, StepNumber } from '@turboshovel/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('handleSubagentStop with agent binding', () => {
  let testDir: string;
  let manager: WorkflowStateManager;
  const mockExecSync = jest.fn(() => 'Workflow advanced');
  const mockSteps: Step[] = [{
    number: 1 as StepNumber,
    description: 'Initial step',
    prompts: []
  }];

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-stop-test-'));
    manager = new WorkflowStateManager(testDir);
    jest.clearAllMocks();

    const module = await import('../../../src/workflow/hooks/subagent-stop.js');
    module.setExecSync(mockExecSync);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    const module = await import('../../../src/workflow/hooks/subagent-stop.js');
    const { execSync } = await import('child_process');
    module.setExecSync(execSync);
  });

  it('calls CLI with --pass flag on success', async () => {
    const state = await manager.create('test.workflow.md', mockSteps);
    await manager.setActive(state.id);
    await manager.bindAgent(state.id, 'agent-xyz', { step: createStepNumber(1)! });

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
    const state = await manager.create('test.workflow.md', mockSteps);
    await manager.setActive(state.id);
    await manager.bindAgent(state.id, 'agent-abc', { step: createStepNumber(1)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-abc',
      output: 'STATUS: BLOCKED\nCould not complete step.'
    };

    const result = await handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      'tsv next --fail --agent agent-abc',
      expect.any(Object)
    );
    expect(result.context).toContain('FAILED');
  });

  it('returns violation when CLI rejects unknown agent', async () => {
    const errorMock = jest.fn(() => {
      const error = new Error('No binding for agent');
      (error as any).stderr = 'No binding for agent unknown-agent';
      throw error;
    });
    const module = await import('../../../src/workflow/hooks/subagent-stop.js');
    module.setExecSync(errorMock);

    const state = await manager.create('test.workflow.md', mockSteps);
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
    const state = await manager.create('test.workflow.md', mockSteps);
    await manager.setActive(state.id);
    await manager.bindAgent(state.id, 'agent-xyz', { step: createStepNumber(1)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      agent_id: 'agent-xyz',
      output: 'Step completed successfully.'
    };

    await handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      'tsv next --pass --agent agent-xyz',
      expect.any(Object)
    );
  });

  it('completes substep when agent stops', async () => {
    const state = await manager.create('test.workflow.md', mockSteps);
    await manager.update(state.id, {
      substepStates: [{ id: '1', status: 'running', agentId: 'agent-123' }],
      agentBindings: {
        'agent-123': { stepId: { step: createStepNumber(1)!, substep: '1' }, status: 'running' }
      }
    });
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      agent_id: 'agent-123',
      cwd: testDir
    };

    await handleSubagentStop(input);

    const updated = await manager.load(state.id);
    expect(updated?.substepStates?.[0].status).toBe('done');
  });
});

describe('handleSubagentStop calls CLI', () => {
  let testDir: string;
  const mockExecSync = jest.fn(() => '');

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-stop-cli-test-'));
    jest.clearAllMocks();

    const module = await import('../../../src/workflow/hooks/subagent-stop.js');
    module.setExecSync(mockExecSync);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
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