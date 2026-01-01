import { describe, it, expect } from '@jest/globals';
import { parseAction, extractWorkflowList } from '../../../src/workflow/parser/helpers.js';

describe('parseAction RETRY with exhaustion', () => {
  it('parses RETRY (bare) as RETRY 1 STOP', () => {
    const result = parseAction('RETRY');
    expect(result).toEqual({
      type: 'RETRY',
      max: 1,
      then: { type: 'STOP' }
    });
  });

  it('parses RETRY 3 as RETRY 3 STOP', () => {
    const result = parseAction('RETRY 3');
    expect(result).toEqual({
      type: 'RETRY',
      max: 3,
      then: { type: 'STOP' }
    });
  });

  it('parses RETRY "message" as RETRY 1 STOP with message', () => {
    const result = parseAction('RETRY "Build failed"');
    expect(result).toEqual({
      type: 'RETRY',
      max: 1,
      then: { type: 'STOP', message: 'Build failed' }
    });
  });

  it('parses RETRY 3 "message" as RETRY 3 STOP with message', () => {
    const result = parseAction('RETRY 3 "Build failed"');
    expect(result).toEqual({
      type: 'RETRY',
      max: 3,
      then: { type: 'STOP', message: 'Build failed' }
    });
  });

  it('parses RETRY 3 STOP "message"', () => {
    const result = parseAction('RETRY 3 STOP "Build failed"');
    expect(result).toEqual({
      type: 'RETRY',
      max: 3,
      then: { type: 'STOP', message: 'Build failed' }
    });
  });

  it('parses RETRY 3 GOTO 2', () => {
    const result = parseAction('RETRY 3 GOTO 2');
    expect(result).toEqual({
      type: 'RETRY',
      max: 3,
      then: { type: 'GOTO', task: expect.any(Number) }
    });
  });

  it('parses RETRY GOTO 2 as RETRY 1 GOTO 2', () => {
    const result = parseAction('RETRY GOTO 2');
    expect(result).toEqual({
      type: 'RETRY',
      max: 1,
      then: { type: 'GOTO', task: expect.any(Number) }
    });
  });

  it('parses RETRY CONTINUE as RETRY 1 CONTINUE', () => {
    const result = parseAction('RETRY CONTINUE');
    expect(result).toEqual({
      type: 'RETRY',
      max: 1,
      then: { type: 'CONTINUE' }
    });
  });

  it('parses RETRY 5 CONTINUE', () => {
    const result = parseAction('RETRY 5 CONTINUE');
    expect(result).toEqual({
      type: 'RETRY',
      max: 5,
      then: { type: 'CONTINUE' }
    });
  });

  it('parses RETRY 2 DONE', () => {
    const result = parseAction('RETRY 2 DONE');
    expect(result).toEqual({
      type: 'RETRY',
      max: 2,
      then: { type: 'DONE' }
    });
  });
});

describe('extractWorkflowList', () => {
  it('should extract workflow files from markdown list', () => {
    const content = `### 1.{n} Dispatch agents
 - verify-review.workflow.md
 - security-review.workflow.md

Some other content`;

    const result = extractWorkflowList(content);
    expect(result).toEqual(['verify-review.workflow.md', 'security-review.workflow.md']);
  });

  it('should return empty array if no workflows', () => {
    const content = `### 1.{n} Dispatch agents

Just a description, no workflows.`;

    const result = extractWorkflowList(content);
    expect(result).toEqual([]);
  });

  it('should only match .workflow.md files', () => {
    const content = `### 1.{n}
 - valid.workflow.md
 - not-a-workflow.md
 - another.workflow.md`;

    const result = extractWorkflowList(content);
    expect(result).toEqual(['valid.workflow.md', 'another.workflow.md']);
  });
});
