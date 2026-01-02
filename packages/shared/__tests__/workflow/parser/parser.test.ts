import { describe, it, expect } from '@jest/globals';
import { parseWorkflow } from '../../../src/workflow/parser/parser.js';

describe('parseWorkflow with substep workflows', () => {
  it('should parse workflow list in substep', () => {
    const markdown = `# Test Workflow

## 1. Dispatch agents

### 1.{n} Review step
 - review.workflow.md
 - security.workflow.md

- PASS: CONTINUE
- FAIL: STOP
`;

    const steps = parseWorkflow(markdown);
    expect(steps[0].substeps).toHaveLength(1);
    expect(steps[0].substeps![0].workflows).toEqual([
      'review.workflow.md',
      'security.workflow.md'
    ]);
  });
});