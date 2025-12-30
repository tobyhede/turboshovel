import { describe, it, expect } from '@jest/globals';
import { parseWorkflow } from '../../../src/workflow/parser/parser.js';

describe('parseWorkflow with subtask workflows', () => {
  it('should parse workflow list in subtask', () => {
    const markdown = `# Test Workflow

## 1. Dispatch agents

### 1.{n} Review task
 - review.workflow.md
 - security.workflow.md

- PASS: CONTINUE
- FAIL: STOP
`;

    const tasks = parseWorkflow(markdown);
    expect(tasks[0].subtasks).toHaveLength(1);
    expect(tasks[0].subtasks![0].workflows).toEqual([
      'review.workflow.md',
      'security.workflow.md'
    ]);
  });
});
