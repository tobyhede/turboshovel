import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WorkflowStateManager, createTaskNumber } from '@turboshovel/shared';

describe('subtask workflow integration', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'subtask-'));
    await fs.mkdir(path.join(testDir, '.claude'), { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('executes full subtask lifecycle: start → dispatch → bind → complete → aggregate', async () => {
    // Create workflow file with subtasks
    const workflowPath = path.join(testDir, 'review.workflow.md');
    await fs.writeFile(
      workflowPath,
      `
## 1. Parallel review

### 1.1 First reviewer (code-review-agent)
### 1.2 Second reviewer (code-agent)

- PASS ALL: CONTINUE
- FAIL ANY: STOP "Review failed"

## 2. Merge

- PASS: DONE
`
    );

    // Step 1: Start workflow (simulated)
    const taskNum = createTaskNumber(1);
    const state = await manager.create(workflowPath, 'Parallel review');
    await manager.setActive(state.id);
    await manager.initializeSubtasks(state.id, [
      { id: '1', description: 'First reviewer', isDynamic: false },
      { id: '2', description: 'Second reviewer', isDynamic: false }
    ]);

    // Verify subtasks initialized
    let current = await manager.load(state.id);
    expect(current?.subtaskStates).toHaveLength(2);
    expect(current?.subtaskStates?.[0].status).toBe('pending');
    expect(current?.subtaskStates?.[1].status).toBe('pending');

    // Step 2: Queue subtasks
    await manager.pushPendingTask(state.id, { taskId: { task: taskNum!, subtask: '1' } });
    await manager.pushPendingTask(state.id, { taskId: { task: taskNum!, subtask: '2' } });

    // Step 3: Bind agents to subtasks
    await manager.bindSubtaskAgent(state.id, '1', 'agent-1');
    await manager.bindSubtaskAgent(state.id, '2', 'agent-2');

    // Verify agents bound
    current = await manager.load(state.id);
    expect(current?.subtaskStates?.[0].status).toBe('running');
    expect(current?.subtaskStates?.[0].agentId).toBe('agent-1');
    expect(current?.subtaskStates?.[1].status).toBe('running');
    expect(current?.subtaskStates?.[1].agentId).toBe('agent-2');

    // Step 4: Complete both subtasks
    await manager.completeSubtask(state.id, '1', 'pass');
    await manager.completeSubtask(state.id, '2', 'pass');

    // Verify both done
    current = await manager.load(state.id);
    expect(current?.subtaskStates?.[0].status).toBe('done');
    expect(current?.subtaskStates?.[0].result).toBe('pass');
    expect(current?.subtaskStates?.[1].status).toBe('done');
    expect(current?.subtaskStates?.[1].result).toBe('pass');
  });

  it('handles FAIL ANY aggregation correctly', async () => {
    const state = await manager.create('test.workflow.md', 'Review');
    await manager.setActive(state.id);
    await manager.initializeSubtasks(state.id, [
      { id: '1', description: 'First', isDynamic: false },
      { id: '2', description: 'Second', isDynamic: false }
    ]);

    // Bind and complete with one failure
    await manager.bindSubtaskAgent(state.id, '1', 'agent-1');
    await manager.bindSubtaskAgent(state.id, '2', 'agent-2');
    await manager.completeSubtask(state.id, '1', 'pass');
    await manager.completeSubtask(state.id, '2', 'fail');

    // Verify state reflects failure
    const current = await manager.load(state.id);
    const failedSubtask = current?.subtaskStates?.find((s) => s.result === 'fail');
    expect(failedSubtask).toBeDefined();
    expect(failedSubtask?.id).toBe('2');
  });
});
