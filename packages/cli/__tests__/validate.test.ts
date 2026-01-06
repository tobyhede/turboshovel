import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  type TestWorkspace,
} from './helpers/test-utils.js';
import * as fs from 'fs';
import * as path from 'path';

describe('tsv validate', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('outputs PASS with step count for valid workflow', () => {
    const workflowPath = path.join(workspace.cwd, 'valid.workflow.md');
    fs.writeFileSync(workflowPath, `## 1. First step

Do something.

- PASS: CONTINUE

## 2. Second step

Do another thing.

- PASS: DONE
`);

    const result = runCli(`validate ${workflowPath}`, workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('PASS:');
    expect(result.stdout).toContain('2 steps');
  });
});
