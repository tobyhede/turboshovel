import { describe, it, expect } from '@jest/globals';
import { extractWorkflowList } from '../../../src/workflow/parser/helpers.js';

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
