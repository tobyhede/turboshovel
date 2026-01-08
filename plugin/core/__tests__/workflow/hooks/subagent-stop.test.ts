// __tests__/workflow/hooks/subagent-stop.test.ts
import { jest } from '@jest/globals';
import {
  handleSubagentStop,
  setExecSync
} from '../../../src/workflow/hooks/subagent-stop.js';
import type { HookInput } from '@turboshovel/shared';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';


describe('handleSubagentStop calls CLI', () => {
  let testDir: string;
  const mockExecSync = jest.fn(() => '');

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-stop-cli-test-'));
    jest.clearAllMocks();
    setExecSync(mockExecSync);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    setExecSync(execSync);
  });

  it('should call rundown pass --agent on success', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      agent_id: 'abc123',
      output: 'STATUS: PASS\nWork completed successfully.',
      cwd: testDir
    };

    handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('pass --agent abc123'),
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

    handleSubagentStop(input);

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('fail --agent abc123'),
      expect.any(Object)
    );
  });
});