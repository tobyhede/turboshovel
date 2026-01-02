// __tests__/cli/workflow-cli.test.ts
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { WorkflowStateManager, createStepNumber, Step, StepNumber } from '@turboshovel/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const mockSteps: Step[] = [{
  number: 1 as StepNumber,
  description: 'Initial step',
  prompts: []
}];

describe('workflow CLI', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-cli-test-${String(Date.now())}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const runCli = async (args: string[]): Promise<CliResult> => {
    const cliPath = join(__dirname, '../../dist/cli/workflow-cli.js');
    try {
      const stdout = execSync(`node ${cliPath} ${args.join(' ')}`, {
        cwd: testDir,
        encoding: 'utf8',
        env: { ...process.env, TURBOSHOVEL_LOG: '0' },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { stdout, stderr: '', exitCode: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? '',
        exitCode: err.status ?? 1
      };
    }
  };

  describe('workflow start', () => {
    test('creates workflow state from file', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`
      );

      const result = await runCli(['start', workflowPath]);
      expect(result.stdout).toContain('Started workflow');
      expect(result.stdout).toContain('Step 1: First step');

      const stateDir = join(testDir, '.claude/turboshovel/workflows');
      const files = await fs.readdir(stateDir);
      expect(files.length).toBe(1);
    });

    it('initializes substepStates for step with static substeps', async () => {
      const workflowPath = join(testDir, 'substep.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. Dispatch reviewers

### 1.1 First reviewer (code-review-agent)
### 1.2 Second reviewer (code-agent)

- PASS ALL: CONTINUE
- FAIL ANY: STOP
`
      );

      await runCli(['start', workflowPath]);

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();

      expect(state?.substepStates).toHaveLength(2);
      expect(state?.substepStates?.[0]).toEqual({
        id: '1',
        status: 'pending',
        agentId: undefined,
        result: undefined
      });
    });
  });

  describe('workflow start --step', () => {
    it('pushes step to pending queue when workflow active', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`
      );
      await runCli(['start', workflowPath]);

      const result = await runCli(['start', '--step', '3.1']);

      expect(result.stdout).toContain('Step 3.1 queued');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.pendingSteps).toContainEqual({ stepId: { step: createStepNumber(3)!, substep: '1' } });
    });
  });

  describe('workflow status', () => {
    test('shows current workflow state', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`
`
      );

      await runCli(['start', workflowPath]);
      const result = await runCli(['status']);

      expect(result.stdout).toContain('test.workflow.md');
      expect(result.stdout).toContain('Step 1');
    });
  });

  describe('workflow next', () => {
    test('advances to next step', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
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
`
      );

      await runCli(['start', workflowPath]);
      const result = await runCli(['next']);

      expect(result.stdout).toContain('Step 2: Second step');
    });
  });
});