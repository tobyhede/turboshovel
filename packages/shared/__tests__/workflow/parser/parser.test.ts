import { describe, it, expect } from '@jest/globals';
import { parseWorkflow } from '../../../src/workflow/parser/parser.js';

describe('Step-level workflows', () => {
  it('parses workflow list in substep', () => {
    const markdown = `## 1. Execute

### 1.1 Execute workflow

 - task-details.workflow.md

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].substeps).toHaveLength(1);
    expect(steps[0].substeps![0].workflows).toEqual(['task-details.workflow.md']);
  });

  it('rejects step with both workflows and substeps', () => {
    const markdown = `## 1. Execute

 - task.workflow.md

### 1.1 Substep

Do work.

- PASS: CONTINUE
- FAIL: STOP
`;
    expect(() => parseWorkflow(markdown)).toThrow(/cannot have both/i);
  });

  it('parses multiple workflows on substep', () => {
    const markdown = `## 1. Execute

### 1.1 Workflows

 - workflow-a.workflow.md
 - workflow-b.workflow.md

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].substeps).toHaveLength(1);
    expect(steps[0].substeps![0].workflows).toEqual([
      'workflow-a.workflow.md',
      'workflow-b.workflow.md'
    ]);
  });
});

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

describe('Implicit prompts with lists', () => {
  it('preserves bulleted instructions in prompts', () => {
    const markdown = `## 1. Execute
The following instructions are important:
- instruction 1
- instruction 2

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].prompts[0].text).toContain('The following instructions are important:');
    expect(steps[0].prompts[0].text).toContain('- instruction 1');
    expect(steps[0].prompts[0].text).toContain('- instruction 2');
  });
});

describe('GOTO substep validation', () => {
  it('accepts GOTO 2.1 when step 2 has static substep 1', () => {
    const markdown = `
## 1. First

- PASS: GOTO 2.1
- FAIL: STOP

## 2. Second

### 2.1 Substep one

Do something.

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].transitions?.pass).toEqual({
      type: 'GOTO',
      target: { step: 2, substep: '1' }
    });
  });

  it('rejects GOTO 2.99 when substep does not exist', () => {
    const markdown = `
## 1. First

- PASS: GOTO 2.99
- FAIL: STOP

## 2. Second

### 2.1 Only substep

- PASS: CONTINUE
- FAIL: STOP
`;
    expect(() => parseWorkflow(markdown)).toThrow(/substep does not exist/i);
  });

  it('rejects GOTO N.M into dynamic substeps', () => {
    const markdown = `
## 1. First

- PASS: GOTO 2.1
- FAIL: STOP

## 2. Dynamic

### 2.{n} Agent dispatch

Do work.

- PASS ALL: CONTINUE
- FAIL ANY: STOP
`;
    expect(() => parseWorkflow(markdown)).toThrow(/cannot GOTO substep.*dynamic|use GOTO 2 instead/i);
  });
});