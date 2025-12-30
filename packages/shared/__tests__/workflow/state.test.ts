import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdir, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { WorkflowStateManager } from '../../src/workflow/state.js';

describe('WorkflowStateManager', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'ws-test-'));
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getChildWorkflowResult', () => {
    it('should return pass when child has completed=true', async () => {
      const child = await manager.create('child.workflow.md', 'Child');
      await manager.update(child.id, { variables: { completed: true } });

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBe('pass');
    });

    it('should return fail when child has blocked=true', async () => {
      const child = await manager.create('child.workflow.md', 'Child');
      await manager.update(child.id, { variables: { blocked: true } });

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBe('fail');
    });

    it('should return null when child is still active', async () => {
      const child = await manager.create('child.workflow.md', 'Child');
      await manager.setActive(child.id);

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBeNull();
    });

    it('should return pass when child state deleted', async () => {
      // Child doesn't exist = already cleaned up = pass
      const result = await manager.getChildWorkflowResult('nonexistent-id');
      expect(result).toBe('pass');
    });

    it('should return null when child is stashed', async () => {
      const child = await manager.create('child.workflow.md', 'Child');
      await manager.setActive(child.id);
      await manager.stash();

      const result = await manager.getChildWorkflowResult(child.id);
      expect(result).toBeNull();
    });
  });
});
