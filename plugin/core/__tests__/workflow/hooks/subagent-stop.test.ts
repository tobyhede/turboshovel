// __tests__/workflow/hooks/subagent-stop.test.ts
import { jest } from '@jest/globals';
import {
  handleSubagentStop
} from '../../../src/workflow/hooks/subagent-stop.js';
import type { HookInput } from '@turboshovel/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';


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

  it('should call rundown pass --agent on success', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      agent_id: 'abc123',
      output: 'STATUS: PASS\nWork completed successfully.',
      cwd: testDir
    };

    await handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      'rundown pass --agent abc123',
      expect.any(Object)
    );
  });

  it('should call rundown fail --agent on failure', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      agent_id: 'abc123',
      output: 'STATUS: BLOCKED\nCould not complete.',
      cwd: testDir
    };

    await handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      'rundown fail --agent abc123',
      expect.any(Object)
    );
  });
});