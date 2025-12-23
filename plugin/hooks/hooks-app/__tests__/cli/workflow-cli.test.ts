// __tests__/cli/workflow-cli.test.ts
/**
 * CLI Integration Tests
 *
 * IMPORTANT: These tests require the project to be built first!
 * Run: npm run build
 */
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';

describe('workflow CLI', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-cli-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const runCli = (args: string): string => {
    const cliPath = join(__dirname, '../../dist/cli/workflow-cli.js');
    return execSync(`node ${cliPath} ${args}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: { ...process.env, TURBOSHOVEL_LOG: '0' },
    });
  };

  describe('workflow start', () => {
    test('creates workflow state from file', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);

      const output = runCli(`start ${workflowPath}`);
      expect(output).toContain('Started workflow');
      expect(output).toContain('Task 1: First step');

      // Verify state file created
      const stateDir = join(testDir, '.claude/turboshovel/workflows');
      const files = await fs.readdir(stateDir);
      expect(files.length).toBe(1);
    });
  });

  describe('workflow status', () => {
    test('shows current workflow state', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`
`);

      runCli(`start ${workflowPath}`);
      const output = runCli('status');

      expect(output).toContain('test.workflow.md');
      expect(output).toContain('Task 1');
    });

    test('shows no active workflow message', () => {
      const output = runCli('status');
      expect(output).toContain('No active workflow');
    });
  });

  describe('workflow next', () => {
    test('advances to next step', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "first"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP

## 2. Second step

\`\`\`bash
echo "second"
\`\`\`
`);

      runCli(`start ${workflowPath}`);
      const output = runCli('next');

      expect(output).toContain('Task 2: Second step');
    });

    test('shows done message on final step', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. Only step

\`\`\`bash
echo "done"
\`\`\`
`);

      runCli(`start ${workflowPath}`);
      const output = runCli('next');

      expect(output).toContain('complete');
    });
  });

  describe('workflow stop', () => {
    test('aborts current workflow', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`
`);

      runCli(`start ${workflowPath}`);
      const output = runCli('stop');

      expect(output).toContain('Stopped');

      // Status should show no active workflow
      const statusOutput = runCli('status');
      expect(statusOutput).toContain('No active workflow');
    });
  });
});
