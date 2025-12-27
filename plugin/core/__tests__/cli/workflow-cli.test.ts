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
import { WorkflowStateManager, createTaskNumber } from '@turboshovel/shared';

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
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { stdout, stderr: '', exitCode: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        exitCode: err.status || 1
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

      // Then add a task
      const result = await runCli(['start', '--task', '3.1']);

      expect(result.stdout).toContain('Task 3.1 queued');

      // Verify state
      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.pendingTasks).toContainEqual({ task: createTaskNumber(3)!, subtask: '1' });
    });

    it('errors when no active workflow', async () => {
      const result = await runCli(['start', '--task', '1']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No active workflow');
    });

    it('errors for invalid task ID format', async () => {
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

      const result = await runCli(['start', '--task', 'invalid']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid task ID');
    });
  });

  describe('workflow start --agent', () => {
    it('binds agent to pending task', async () => {
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

## 2. Second step

\`\`\`bash
echo "test"
\`\`\`
`
      );
      await runCli(['start', workflowPath]);
      await runCli(['start', '--task', '2.1']);

      const result = await runCli(['start', '--agent', 'agent-xyz']);

      expect(result.stdout).toContain('Agent agent-xyz bound to task 2.1');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.agentBindings['agent-xyz']).toBeDefined();
      expect(state?.pendingTasks).toHaveLength(0); // Popped
    });

    it('errors when no pending task', async () => {
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
      await fs.writeFile(
        workflowPath,
        `
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
`
      );
      await runCli(['start', workflowPath]);
      await runCli(['start', '--task', '2.1']);
      await runCli(['start', '--task', '2.2']);

      const result = await runCli(['status']);

      expect(result.stdout).toContain('Pending Tasks');
      expect(result.stdout).toContain('2.1');
      expect(result.stdout).toContain('2.2');
    });

    it('shows agent bindings', async () => {
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

## 2. Second step

\`\`\`bash
echo "test"
\`\`\`
`
      );
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
      await runCli(['stash']);

      const result = await runCli(['status']);

      expect(result.stdout).toContain('stashed');
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

      expect(result.stdout).toContain('Task 2: Second step');
    });

    test('shows done message on final step', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. Only step

\`\`\`bash
echo "done"
\`\`\`
`
      );

      await runCli(['start', workflowPath]);
      const result = await runCli(['next']);

      expect(result.stdout).toContain('complete');
    });
  });

  describe('workflow next --retry', () => {
    it('increments retryCount and re-presents same task', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 3
`
      );
      await runCli(['start', workflowPath]);

      const result = await runCli(['next', '--retry']);

      expect(result.stdout).toContain('Retry 1/3');
      expect(result.stdout).toContain('Task 1');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.retryCount).toBe(1);
      expect(state?.task).toBe(1); // Still on task 1
    });

    it('blocks when retryCount exceeds retryMax', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 3
`
      );
      await runCli(['start', workflowPath]);

      // --retry uses state.retryMax (default 3), not workflow value
      // Use up retries
      await runCli(['next', '--retry']); // retry 1
      await runCli(['next', '--retry']); // retry 2
      await runCli(['next', '--retry']); // retry 3

      const result = await runCli(['next', '--retry']); // retry 4 - should fail

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Max retries exceeded');
    });

    it('resets retryCount when advancing to next task', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 3

## 2. Second step

\`\`\`bash
echo "test"
\`\`\`
`
      );
      await runCli(['start', workflowPath]);
      await runCli(['next', '--retry']); // retry 1

      // Now advance normally
      await runCli(['next']);

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.retryCount).toBe(0); // Reset
      expect(state?.task).toBe(2);
    });
  });

  describe('workflow next --fail (condition evaluation)', () => {
    it('retries task when FAIL: RETRY and under max', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 3
`
      );
      await runCli(['start', workflowPath]);

      const result = await runCli(['next', '--fail']);

      expect(result.stdout).toContain('Retry 1/3');
      expect(result.stdout).toContain('Task 1');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.retryCount).toBe(1);
      expect(state?.task).toBe(1); // Still on task 1
    });

    it('blocks when FAIL: RETRY and max exceeded', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 1
`
      );
      await runCli(['start', workflowPath]);
      await runCli(['next', '--fail']); // retry 1

      const result = await runCli(['next', '--fail']); // should block

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Max retries exceeded');
    });

    it('blocks with message when FAIL: STOP', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP Fix the build
`
      );
      await runCli(['start', workflowPath]);

      const result = await runCli(['next', '--fail']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Fix the build');
    });

    it('jumps to task when FAIL: GOTO', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: GOTO 3

## 2. Second step

\`\`\`bash
echo "test"
\`\`\`

## 3. Error handler

**Prompt:** Handle the error.
`
      );
      await runCli(['start', workflowPath]);

      const result = await runCli(['next', '--fail']);

      expect(result.stdout).toContain('Task 3');
      expect(result.stdout).toContain('Error handler');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.task).toBe(3);
    });
  });

  describe('workflow next --pass/--fail', () => {
    it('marks agent as passed with --pass --agent', async () => {
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

      const result = await runCli(['next', '--pass', '--agent', 'unknown']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No binding');
    });
  });

  describe('workflow stop', () => {
    test('aborts current workflow', async () => {
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

  describe('workflow next --fail --agent (with retry)', () => {
    it('retries agent task when FAIL: RETRY', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(
        workflowPath,
        `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: RETRY 3
`
      );
      await runCli(['start', workflowPath]);
      await runCli(['start', '--task', '1']);
      await runCli(['start', '--agent', 'agent-xyz']);

      const result = await runCli(['next', '--fail', '--agent', 'agent-xyz']);

      // Agent should be marked for retry, not just failed
      expect(result.stdout).toContain('Retry 1/3');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      // Agent should be re-queued for retry (still running)
      expect(state?.agentBindings['agent-xyz'].status).toBe('running');
    });

    it('blocks agent when FAIL: STOP', async () => {
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
      await runCli(['start', '--task', '1']);
      await runCli(['start', '--agent', 'agent-xyz']);

      const result = await runCli(['next', '--fail', '--agent', 'agent-xyz']);

      expect(result.stdout).toContain('blocked');

      const manager = new WorkflowStateManager(testDir);
      const state = await manager.getActive();
      expect(state?.agentBindings['agent-xyz'].status).toBe('done');
      expect(state?.agentBindings['agent-xyz'].result).toBe('fail');
    });
  });
});
