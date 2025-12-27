import {
  handleSubagentStart,
  type SubagentStartResult
} from '../../../src/workflow/hooks/subagent-start.js';
import { WorkflowStateManager } from '../../../src/workflow/state.js';
import type { HookInput } from '../../../src/types.js';
import { createTaskNumber } from '../../../src/workflow/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('handleSubagentStart', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-start-test-'));
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('pops pending task and binds agent', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(3)!, subtask: '1' });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz-123'
    };

    const result = await handleSubagentStart(input);

    expect(result.context).toContain('AGENT_ID: agent-xyz-123');
    expect(result.context).toContain('TASK_ID: 3.1');

    const updated = await manager.getActive();
    expect(updated?.pendingTasks).toHaveLength(0);
    expect(updated?.agentBindings['agent-xyz-123']).toBeDefined();
  });

  it('returns violation when no pending task', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    // No pending tasks

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz'
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toContain('no pending task');
  });

  it('passes through when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz'
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
    expect(result.context).toBeUndefined();
  });

  it('passes through when no agent_id provided', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir
      // No agent_id
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
  });

  it('passes through when workflow is stashed', async () => {
    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.stash();

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz'
    };

    const result = await handleSubagentStart(input);

    expect(result.violation).toBeUndefined();
  });
});

describe('handleSubagentStart with prompt injection', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subagent-start-prompt-test-'));
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('includes substituted prompt in context', async () => {
    // Create workflow file with prompt containing $n
    const workflowContent = `
## 1. Initialize

Setup task.

- PASS: CONTINUE
- FAIL: STOP

## 2. Parallel Tasks

### 2.{n}

**Prompt:** You are agent $n. Append "agent-$n-started" to the log.

- PASS: CONTINUE
- FAIL: STOP
`;
    await fs.writeFile(path.join(testDir, 'test.workflow.md'), workflowContent);

    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(2)!, subtask: '1' });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz-123'
    };

    const result = await handleSubagentStart(input);

    expect(result.context).toContain('TASK_ID: 2.1');
    expect(result.context).toContain('## Task Prompt');
    expect(result.context).toContain('You are agent 1.');
    expect(result.context).toContain('agent-1-started');
    expect(result.context).not.toContain('$n');
  });

  it('works without prompt when workflow file not found', async () => {
    // Workflow file doesn't exist
    const state = await manager.create('nonexistent.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(2)!, subtask: '1' });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz-123'
    };

    const result = await handleSubagentStart(input);

    expect(result.context).toContain('AGENT_ID: agent-xyz-123');
    expect(result.context).toContain('TASK_ID: 2.1');
    // Should not crash, just omit prompt section
    expect(result.violation).toBeUndefined();
  });

  it('works without prompt when task has no prompts', async () => {
    const workflowContent = `
## 1. Command Task

\`\`\`bash
echo "hello"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`;
    await fs.writeFile(path.join(testDir, 'test.workflow.md'), workflowContent);

    const state = await manager.create('test.workflow.md', 'Test');
    await manager.setActive(state.id);
    await manager.pushPendingTask(state.id, { task: createTaskNumber(1)! });

    const input: HookInput = {
      hook_event_name: 'SubagentStart',
      cwd: testDir,
      agent_id: 'agent-xyz-123'
    };

    const result = await handleSubagentStart(input);

    expect(result.context).toContain('AGENT_ID: agent-xyz-123');
    expect(result.context).not.toContain('## Task Prompt');
  });
});
