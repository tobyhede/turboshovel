// __tests__/workflow/context-integration.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { WorkflowStateManager, Step, StepNumber } from '@turboshovel/shared';
import { getWorkflowContext } from '../../src/workflow/context.js';

describe('Workflow Context Injection', () => {
  let testDir: string;
  const mockSteps: Step[] = [{
    number: 1 as StepNumber,
    description: 'Run tests',
    prompts: []
  }];

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-context-test-${String(Date.now())}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('returns null when no active workflow', async () => {
    const context = await getWorkflowContext(testDir);
    expect(context).toBeNull();
  });

  test('returns context for active workflow', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', mockSteps);
    await manager.setActive(state.id);

    const context = await getWorkflowContext(testDir);

    expect(context).not.toBeNull();
    expect(context).toContain('Active Workflow');
    expect(context).toContain('test.workflow.md');
    expect(context).toContain('Step 1');
    expect(context).toContain('Run tests');
  });
});