import { jest } from '@jest/globals';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { WorkflowStateManager, type HookInput, createStepNumber, type Step, type StepNumber } from '@turboshovel/shared';
import type { trackStepDispatch } from '../../../src/workflow/hooks/step-tracker';

describe('trackStepDispatch with StepId', () => {
  let testDir: string;
  let manager: WorkflowStateManager;
  let trackStepDispatchFn: typeof trackStepDispatch;
  const mockSteps: Step[] = [{
    number: 1 as StepNumber,
    description: 'Initial step',
    prompts: []
  }];

  beforeEach(async () => {
    jest.resetModules();
    const module = await import('../../../src/workflow/hooks/step-tracker');
    trackStepDispatchFn = module.trackStepDispatch;

    testDir = join(tmpdir(), `step-tracker-test-${String(Date.now())}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    jest.resetModules();
  });

  it('parses StepId from description and pushes to queue', async () => {
    const state = await manager.create('test.workflow.md', mockSteps);
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Step',
      tool_input: {
        description: '3.1 - Review code changes',
        subagent_type: 'code-review-agent'
      }
    };

    const result = await trackStepDispatchFn(input);

    expect(result.stepId).toEqual({ step: createStepNumber(3)!, substep: '1' });

    const updated = await manager.getActive();
    expect(updated?.pendingSteps).toContainEqual({ stepId: { step: createStepNumber(3)!, substep: '1' } });
  });

  it('returns violation for missing StepId prefix in enforcement mode', async () => {
    const state = await manager.create('test.workflow.md', mockSteps);
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Step',
      tool_input: {
        description: 'Review the code without step prefix'
      }
    };

    const result = await trackStepDispatchFn(input);

    expect(result.violation).toContain('must start with StepId');
  });

  it('passes through when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Step',
      tool_input: { description: 'Any description' }
    };

    const result = await trackStepDispatchFn(input);

    expect(result.stepId).toBeUndefined();
    expect(result.violation).toBeUndefined();
  });

  it('passes through when workflow is stashed', async () => {
    const state = await manager.create('test.workflow.md', mockSteps);
    await manager.setActive(state.id);
    await manager.stash();

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Step',
      tool_input: { description: 'No prefix needed when stashed' }
    };

    const result = await trackStepDispatchFn(input);

    expect(result.violation).toBeUndefined();
  });
});