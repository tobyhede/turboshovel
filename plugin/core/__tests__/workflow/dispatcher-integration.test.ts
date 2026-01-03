// __tests__/workflow/dispatcher-integration.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { dispatch } from '../../src/dispatcher.js';
import { WorkflowStateManager, type HookInput, type Step, type StepNumber } from '@turboshovel/shared';

describe('Dispatcher Workflow Integration', () => {
  let testDir: string;
  const mockSteps: Step[] = [{
    number: 1 as StepNumber,
    description: 'Run tests',
    prompts: []
  }];

  beforeEach(async () => {
    testDir = join(tmpdir(), `dispatcher-workflow-test-${String(Date.now())}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create minimal config
    await fs.mkdir(join(testDir, '.claude'), { recursive: true });
    await fs.writeFile(
      join(testDir, '.claude/turboshovel.json'),
      JSON.stringify({ gates: {}, hooks: {} })
    );
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('includes workflow context in dispatch output', async () => {
    // Create active workflow
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', mockSteps);
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'UserPromptSubmit',
      cwd: testDir,
      user_message: 'test prompt'
    };

    const result = await dispatch(input);

    expect(result.blockReason).toBeUndefined();
    expect(result.stopMessage).toBeUndefined();
    expect(result.context).toContain('Active Workflow');
    expect(result.context).toContain('test.workflow.md');
  });
});