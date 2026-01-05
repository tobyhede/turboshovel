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
      // Start a workflow first (prompted mode to keep it active)
      runCli('start --prompted workflows/retry.workflow.md', workspace);
    });

    it('returns pass by default (no flags)', () => {
      const result = runCli('test npm install', workspace);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[PASS]');
    });

    it('returns pass with explicit --result pass', () => {
      const result = runCli('test --result pass npm install', workspace);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('[PASS]');
    });

    it('returns fail with --result fail', () => {
      const result = runCli('test --result fail npm install', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('[FAIL]');
    });

    // NOTE: Tests for retry count indexing removed - they relied on 'next --retry'
    // which was removed when 'next' command was replaced by pass/fail/goto.
    // Retry behavior is now tested via FAIL conditions in workflows.
  });

  describe('error handling', () => {
    it('fails when no active workflow', () => {
      const result = runCli('test npm install', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No active workflow');
    });

    it('fails with invalid result value', () => {
      runCli('start --prompted workflows/simple.workflow.md', workspace);

      const result = runCli('test --result maybe npm install', workspace);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid result');
    });
  });
});
