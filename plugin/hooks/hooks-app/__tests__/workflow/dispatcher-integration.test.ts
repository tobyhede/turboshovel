// __tests__/workflow/dispatcher-integration.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { dispatch } from '../../src/dispatcher';
import { WorkflowStateManager } from '../../src/workflow/state';
import type { HookInput } from '../../src/types';

describe('Dispatcher Workflow Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `dispatcher-workflow-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create minimal config
    await fs.mkdir(join(testDir, '.claude'), { recursive: true });
    await fs.writeFile(
      join(testDir, '.claude/gates.json'),
      JSON.stringify({ gates: {}, hooks: {} })
    );
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('includes workflow context in dispatch output', async () => {
    // Create active workflow
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Run tests');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'UserPromptSubmit',
      cwd: testDir,
      user_message: 'test prompt',
    };

    const result = await dispatch(input);

    expect(result.blockReason).toBeUndefined();
    expect(result.stopMessage).toBeUndefined();
    expect(result.context).toContain('Active Workflow');
    expect(result.context).toContain('test.workflow.md');
  });

  test('no workflow context when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'UserPromptSubmit',
      cwd: testDir,
      user_message: 'test prompt',
    };

    const result = await dispatch(input);

    expect(result.blockReason).toBeUndefined();
    // Should not contain workflow context
    expect(result.context || '').not.toContain('Active Workflow');
  });
});
