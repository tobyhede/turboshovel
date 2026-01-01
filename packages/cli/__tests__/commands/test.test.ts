import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestWorkspace,
  runCli,
  type TestWorkspace,
} from '../helpers/test-utils.js';

describe('test command', () => {
  let workspace: TestWorkspace;

  beforeEach(async () => {
    workspace = await createTestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('exists and shows help', () => {
    const result = runCli('test --help', workspace);
    expect(result.stdout).toContain('Test command');
  });

  describe('result sequence', () => {
    beforeEach(async () => {
      // Start a workflow first
      runCli('start workflows/retry.workflow.md', workspace);
    });

    it('returns pass by default (no flags)', () => {
      const result = runCli('test npm install', workspace);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('-> PASS');
    });

    it('returns pass with explicit --result pass', () => {
      const result = runCli('test --result pass npm install', workspace);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('-> PASS');
    });

    it('returns fail with --result fail', () => {
      const result = runCli('test --result fail npm install', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('-> FAIL');
    });
  });
});
