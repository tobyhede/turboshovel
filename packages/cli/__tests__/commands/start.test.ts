import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  readSession,
  getActiveState,
  listWorkflowStates,
  type TestWorkspace,
} from '../helpers/test-utils.js';

describe('start command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('file mode', () => {
    it('creates workflow state from valid workflow file', async () => {
      const result = runCli('start workflows/simple.workflow.md', workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Started workflow');
      expect(result.stdout).toContain('simple.workflow.md');
    });

    it('sets workflow as active', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      const session = await readSession(workspace);
      expect(session.active).toBeTruthy();
    });

    it('stores relative path in state', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      const state = await getActiveState(workspace);
      expect(state).not.toBeNull();
      expect(state?.workflow).toBe('workflows/simple.workflow.md');
    });

    it('initializes task=1 and retryCount=0', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      const state = await getActiveState(workspace);
      expect(state?.task).toBe(1);
      expect(state?.retryCount).toBe(0);
    });

    it('outputs first task description', async () => {
      const result = runCli('start workflows/simple.workflow.md', workspace);

      expect(result.stdout).toContain('Task 1');
      expect(result.stdout).toContain('First task');
    });

    it('fails if file does not exist', async () => {
      const result = runCli('start workflows/nonexistent.md', workspace);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });

    it('fails if no file argument provided', async () => {
      const result = runCli('start', workspace);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('required');
    });

    it('creates state file on disk', async () => {
      runCli('start workflows/simple.workflow.md', workspace);

      const stateFiles = await listWorkflowStates(workspace);
      expect(stateFiles.length).toBe(1);
    });
  });
});
