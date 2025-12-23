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
import { WorkflowStateManager } from '../../src/workflow/state';

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

describe('workflow CLI', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-cli-test-${Date.now()}`);
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
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { stdout, stderr: '', exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.status || 1,
      };
    }
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

      const result = await runCli(['start', workflowPath]);
      expect(result.stdout).toContain('Started workflow');
      expect(result.stdout).toContain('Task 1: First step');

      // Verify state file created
      const stateDir = join(testDir, '.claude/turboshovel/workflows');
      const files = await fs.readdir(stateDir);
      expect(files.length).toBe(1);
    });
  });

  describe('workflow start --task', () => {
    it('pushes task to pending queue when workflow active', async () => {
      // First start a workflow
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);

      // Then add a task
      const result = await runCli(['start', '--task', '3.A']);

      expect(result.stdout).toContain('Task 3.A queued');

      // Verify state
      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.pendingTasks).toContainEqual({ task: 3, subtask: 'A' });
    });

    it('errors when no active workflow', async () => {
      const result = await runCli(['start', '--task', '1']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No active workflow');
    });

    it('errors for invalid task ID format', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);

      const result = await runCli(['start', '--task', 'invalid']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid task ID');
    });
  });

  describe('workflow start --agent', () => {
    it('binds agent to pending task', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP

## 2. Second step

\`\`\`bash
echo "test"
\`\`\`
`);
      await runCli(['start', workflowPath]);
      await runCli(['start', '--task', '2.A']);

      const result = await runCli(['start', '--agent', 'agent-xyz']);

      expect(result.stdout).toContain('Agent agent-xyz bound to task 2.A');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.agentBindings['agent-xyz']).toBeDefined();
      expect(state?.pendingTasks).toHaveLength(0); // Popped
    });

    it('errors when no pending task', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);

      const result = await runCli(['start', '--agent', 'agent-xyz']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No pending task');
    });

    it('errors when no active workflow', async () => {
      const result = await runCli(['start', '--agent', 'agent-xyz']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No active workflow');
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

      await runCli(['start', workflowPath]);
      const result = await runCli(['status']);

      expect(result.stdout).toContain('test.workflow.md');
      expect(result.stdout).toContain('Task 1');
    });

    test('shows no active workflow message', async () => {
      const result = await runCli(['status']);
      expect(result.stdout).toContain('No active workflow');
    });
  });

  describe('workflow status (orchestration)', () => {
    it('shows pending tasks', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP

## 2. Second step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);
      await runCli(['start', '--task', '2.A']);
      await runCli(['start', '--task', '2.B']);

      const result = await runCli(['status']);

      expect(result.stdout).toContain('Pending Tasks');
      expect(result.stdout).toContain('2.A');
      expect(result.stdout).toContain('2.B');
    });

    it('shows agent bindings', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP

## 2. Second step

\`\`\`bash
echo "test"
\`\`\`
`);
      await runCli(['start', workflowPath]);
      await runCli(['start', '--task', '1']);
      await runCli(['start', '--agent', 'agent-xyz']);

      const result = await runCli(['status']);

      expect(result.stdout).toContain('Agent Bindings');
      expect(result.stdout).toContain('agent-xyz');
      expect(result.stdout).toContain('running');
    });

    it('shows stashed status', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);
      await runCli(['stash']);

      const result = await runCli(['status']);

      expect(result.stdout).toContain('stashed');
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

      await runCli(['start', workflowPath]);
      const result = await runCli(['next']);

      expect(result.stdout).toContain('Task 2: Second step');
    });

    test('shows done message on final step', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. Only step

\`\`\`bash
echo "done"
\`\`\`
`);

      await runCli(['start', workflowPath]);
      const result = await runCli(['next']);

      expect(result.stdout).toContain('complete');
    });
  });

  describe('workflow next --pass/--fail', () => {
    it('marks agent as passed with --pass --agent', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);
      await runCli(['start', '--task', '1']);
      await runCli(['start', '--agent', 'agent-xyz']);

      const result = await runCli(['next', '--pass', '--agent', 'agent-xyz']);

      expect(result.stdout).toContain('agent-xyz');
      expect(result.stdout).toContain('pass');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      const binding = state?.agentBindings['agent-xyz'];
      expect(binding?.status).toBe('done');
      expect(binding?.result).toBe('pass');
    });

    it('marks agent as failed with --fail --agent', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);
      await runCli(['start', '--task', '1']);
      await runCli(['start', '--agent', 'agent-xyz']);

      const result = await runCli(['next', '--fail', '--agent', 'agent-xyz']);

      expect(result.stdout).toContain('fail');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.agentBindings['agent-xyz'].result).toBe('fail');
    });

    it('errors for unknown agent', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);

      const result = await runCli(['next', '--pass', '--agent', 'unknown']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No binding');
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

      await runCli(['start', workflowPath]);
      const result = await runCli(['stop']);

      expect(result.stdout).toContain('Stopped');

      // Status should show no active workflow
      const statusResult = await runCli(['status']);
      expect(statusResult.stdout).toContain('No active workflow');
    });
  });

  describe('workflow stash', () => {
    it('stashes active workflow', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);

      const result = await runCli(['stash']);

      expect(result.stdout).toContain('stashed');
      expect(result.stdout).toContain('Enforcement paused');

      const manager = new WorkflowStateManager(testDir);
      const active = await manager.getActive();
      expect(active).toBeNull();

      const stashedId = await manager.getStashedWorkflowId();
      expect(stashedId).not.toBeNull();
    });

    it('reports when nothing to stash', async () => {
      const result = await runCli(['stash']);

      expect(result.stdout).toContain('No active workflow');
    });
  });

  describe('workflow pop', () => {
    it('restores stashed workflow', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);
      await runCli(['start', workflowPath]);
      await runCli(['stash']);

      const result = await runCli(['pop']);

      expect(result.stdout).toContain('restored');
      expect(result.stdout).toContain('Enforcement active');

      const manager = new WorkflowStateManager(testDir);
      const active = await manager.getActive();
      expect(active).not.toBeNull();
    });

    it('reports when nothing to pop', async () => {
      const result = await runCli(['pop']);

      expect(result.stdout).toContain('No stashed workflow');
    });
  });
});
