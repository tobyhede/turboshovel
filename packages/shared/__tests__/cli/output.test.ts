import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  formatPosition,
  printSeparator,
  printMetadata,
  printActionBlock,
  printStepBlock,
  printCommandExec,
  printWorkflowComplete,
  printWorkflowStopped,
  printWorkflowBlocked,
  printWorkflowStashed,
  printNoActiveWorkflow,
} from '../../src/cli/output.js';
import type { Step } from '../../src/workflow/types.js';
import { createStepNumber } from '../../src/workflow/types.js';

describe('output formatter', () => {
  let consoleOutput: string[];
  const originalLog = console.log;

  beforeEach(() => {
    consoleOutput = [];
    console.log = (...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  describe('formatPosition', () => {
    it('formats position without substep', () => {
      expect(formatPosition({ current: 2, total: 5 })).toBe('2/5');
    });

    it('formats position with substep', () => {
      expect(formatPosition({ current: 2, total: 5, substep: '1' })).toBe('2.1/5');
    });
  });

  describe('printSeparator', () => {
    it('prints separator line', () => {
      printSeparator();
      expect(consoleOutput).toEqual(['-----']);
    });
  });

  describe('printMetadata', () => {
    it('prints metadata without prompt line in default mode', () => {
      printMetadata({
        file: 'workflows/build.md',
        state: '.claude/turboshovel/workflows/wf-123.json',
      });
      expect(consoleOutput).toEqual([
        'File:     workflows/build.md',
        'State:    .claude/turboshovel/workflows/wf-123.json',
      ]);
    });

    it('prints prompt line when prompted is true', () => {
      printMetadata({
        file: 'workflows/build.md',
        state: '.claude/turboshovel/workflows/wf-123.json',
        prompted: true,
      });
      expect(consoleOutput).toContain('Prompt:   Yes');
    });

    it('omits prompt line when prompted is false', () => {
      printMetadata({
        file: 'workflows/build.md',
        state: '.claude/turboshovel/workflows/wf-123.json',
        prompted: false,
      });
      expect(consoleOutput).not.toContain('Prompt:   Yes');
      expect(consoleOutput).not.toContain('Prompt:   No');
    });
  });

  describe('printActionBlock', () => {
    it('prints action only (start command)', () => {
      printActionBlock({ action: 'START' });
      expect(consoleOutput).toEqual(['Action:   START']);
    });

    it('prints action with from and result (pass command)', () => {
      printActionBlock({
        action: 'CONTINUE',
        from: { current: 1, total: 5 },
        result: 'PASS',
      });
      expect(consoleOutput).toEqual([
        'Action:   CONTINUE',
        'From:     1/5',
        'Result:   PASS',
      ]);
    });

    it('prints action with from but no result (goto command)', () => {
      printActionBlock({
        action: 'GOTO 3',
        from: { current: 1, total: 5 },
      });
      expect(consoleOutput).toEqual([
        'Action:   GOTO 3',
        'From:     1/5',
      ]);
    });

    it('prints retry with count', () => {
      printActionBlock({
        action: 'RETRY (1/3)',
        from: { current: 2, total: 5 },
        result: 'FAIL',
      });
      expect(consoleOutput).toContain('Action:   RETRY (1/3)');
    });
  });

  describe('printStepBlock', () => {
    it('prints step position and content', () => {
      const step: Step = {
        number: createStepNumber(1)!,
        description: 'First step',
        prompts: [{ text: 'Do something.' }],
        command: { code: 'npm test' },
      };
      printStepBlock({ current: 1, total: 3 }, step);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Step:     1/3');
      expect(output).toContain('## 1. First step');
      expect(output).toContain('Do something.');
      expect(output).toContain('npm test');
    });
  });

  describe('printCommandExec', () => {
    it('prints command with $ prefix', () => {
      printCommandExec('npm test');
      expect(consoleOutput).toContain('$ npm test');
    });
  });

  describe('printWorkflowComplete', () => {
    it('prints completion message', () => {
      printWorkflowComplete();
      expect(consoleOutput).toContain('Workflow complete.');
    });
  });

  describe('printWorkflowStopped', () => {
    it('prints stopped message', () => {
      printWorkflowStopped();
      expect(consoleOutput).toContain('Workflow stopped.');
    });
  });

  describe('printWorkflowBlocked', () => {
    it('prints blocked message with step number', () => {
      printWorkflowBlocked({ current: 2, total: 5 });
      expect(consoleOutput).toContain('Workflow blocked at step 2.');
    });

    it('prints blocked message with substep', () => {
      printWorkflowBlocked({ current: 2, total: 5, substep: '1' });
      expect(consoleOutput).toContain('Workflow blocked at step 2.1.');
    });
  });

  describe('printWorkflowStashed', () => {
    it('prints step position and stashed message', () => {
      printWorkflowStashed({ current: 2, total: 5 });
      expect(consoleOutput).toContain('Step:     2/5');
      expect(consoleOutput).toContain('Workflow stashed.');
    });
  });

  describe('printNoActiveWorkflow', () => {
    it('prints no active workflow message', () => {
      printNoActiveWorkflow();
      expect(consoleOutput).toEqual(['No active workflow.']);
    });
  });
});
