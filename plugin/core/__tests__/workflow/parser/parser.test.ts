// __tests__/workflow/parser/parser.test.ts
import { parseWorkflow, WorkflowSyntaxError } from '@turboshovel/shared';

describe('parseWorkflow', () => {
  describe('basic parsing', () => {
    test('parses simple two-step workflow', () => {
      const markdown = `
## 1. First step

Some description

## 2. Second step

More description
`;

      const steps = parseWorkflow(markdown);
      expect(steps).toHaveLength(2);
      expect(steps[0].number).toBe(1);
      expect(steps[0].description).toBe('First step');
      expect(steps[1].number).toBe(2);
      expect(steps[1].description).toBe('Second step');
    });

    test('parses commands in steps', () => {
      const markdown = `
## 1. Run tests

\`\`\`bash
npm test
\`\`\`

## 2. Check status

\`\`\`bash
git status
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].command?.code).toBe('npm test');
      expect(steps[1].command?.code).toBe('git status');
    });
  });

  describe('conditionals', () => {
    test('parses PASS/FAIL conditionals', () => {
      const markdown = `
## 1. Run tests

PASS: CONTINUE
FAIL: STOP fix tests

\`\`\`bash
npm test
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].transitions).toBeDefined();
      expect(steps[0].transitions?.pass).toEqual({ type: 'CONTINUE' });
      expect(steps[0].transitions?.fail).toEqual({ type: 'STOP', message: 'fix tests' });
    });

    test('parses GOTO action', () => {
      const markdown = `
## 1. Test

PASS: GOTO 3
FAIL: STOP

\`\`\`bash
echo "test"
\`\`\`

## 2. Skip

\`\`\`bash
echo "skipped"
\`\`\`

## 3. Target

\`\`\`bash
echo "reached"
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].transitions?.pass).toEqual({ type: 'GOTO', target: { step: 3, substep: undefined } });
    });
  });

  describe('validation', () => {
    test('throws on empty workflow', () => {
      expect(() => parseWorkflow('')).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow('')).toThrow('at least one step');
    });

    test('throws on non-sequential steps', () => {
      const markdown = `
## 1. First step

## 5. Fifth step
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('sequential');
    });
  });

  describe('parseWorkflow with substeps', () => {
    it('parses static substeps', () => {
      const markdown = `
## 1. Dispatch reviewers

### 1.1 First reviewer (code-review-agent)
### 1.2 Second reviewer (code-agent)

PASS ALL: CONTINUE
FAIL ANY: STOP
`;
      const steps = parseWorkflow(markdown);

      expect(steps[0].substeps).toHaveLength(2);
      expect(steps[0].substeps?.[0]).toEqual({
        id: '1',
        description: 'First reviewer',
        agentType: 'code-review-agent',
        isDynamic: false
      });
      expect(steps[0].substeps?.[1].id).toBe('2');
    });

    it('parses dynamic substep template', () => {
      const markdown = `
## 1. Execute batch

### 1.{n} Execute step

PASS ALL: CONTINUE
FAIL ANY: STOP
`;
      const steps = parseWorkflow(markdown);

      expect(steps[0].substeps).toHaveLength(1);
      expect(steps[0].substeps?.[0].isDynamic).toBe(true);
      expect(steps[0].substeps?.[0].id).toBe('{n}');
    });

    it('errors for duplicate substep IDs', () => {
      const markdown = `
## 1. Step

### 1.1 First
### 1.1 Duplicate
`;
      expect(() => parseWorkflow(markdown)).toThrow('Duplicate substep');
    });
  });

  describe('parseWorkflow with dynamic steps', () => {
    it('parses single dynamic step template', () => {
      const markdown = `
## {N}. Process batch item

Execute the item processing workflow.

- PASS: CONTINUE
- FAIL: STOP
`;
      const steps = parseWorkflow(markdown);

      expect(steps).toHaveLength(1);
      expect(steps[0].isDynamic).toBe(true);
      expect(steps[0].number).toBeUndefined();
      expect(steps[0].description).toBe('Process batch item');
    });

    it('parses dynamic step with static substeps', () => {
      const markdown = `
## {N}. Execute batch task

### {N}.1 Implement changes
### {N}.2 Run lint
### {N}.3 Run tests

- PASS: CONTINUE
- FAIL: STOP
`;
      const steps = parseWorkflow(markdown);

      expect(steps[0].isDynamic).toBe(true);
      expect(steps[0].substeps).toHaveLength(3);
      expect(steps[0].substeps?.[0].id).toBe('1');
      expect(steps[0].substeps?.[1].id).toBe('2');
      expect(steps[0].substeps?.[2].id).toBe('3');
    });

    it('parses dynamic step with dynamic substeps', () => {
      const markdown = `
## {N}. Review batch item

### {N}.{n} Code review (code-review-agent)

- PASS ALL: CONTINUE
- FAIL ANY: STOP
`;
      const steps = parseWorkflow(markdown);

      expect(steps[0].isDynamic).toBe(true);
      expect(steps[0].substeps).toHaveLength(1);
      expect(steps[0].substeps?.[0].id).toBe('{n}');
      expect(steps[0].substeps?.[0].isDynamic).toBe(true);
    });

    it('parses dynamic step with transitions', () => {
      const markdown = `
## {N}. Process item

Process the item.

- PASS: CONTINUE
- FAIL: RETRY 3 STOP
`;
      const steps = parseWorkflow(markdown);

      expect(steps[0].isDynamic).toBe(true);
      expect(steps[0].prompts).toHaveLength(1);
      expect(steps[0].prompts[0].text).toBe('Process the item.');
      expect(steps[0].transitions).toBeDefined();
      expect(steps[0].transitions?.pass).toEqual({ type: 'CONTINUE' });
    });
  });

  describe('parseWorkflow validation - step pattern', () => {
    it('rejects mixed static and dynamic steps', () => {
      const markdown = `
## 1. Setup

First step

## {N}. Process

Dynamic step
`;
      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('static steps OR exactly one dynamic');
    });

    it('rejects multiple dynamic step templates', () => {
      const markdown = `
## {N}. First template

## {N}. Second template
`;
      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('exactly one dynamic');
    });

    it('allows multiple static steps', () => {
      const markdown = `
## 1. First

Step one

## 2. Second

Step two
`;
      const steps = parseWorkflow(markdown);
      expect(steps).toHaveLength(2);
      expect(steps.every(s => !s.isDynamic)).toBe(true);
    });

    it('allows exactly one dynamic step template', () => {
      const markdown = `
## {N}. Process item

Process the item
`;
      const steps = parseWorkflow(markdown);
      expect(steps).toHaveLength(1);
      expect(steps[0].isDynamic).toBe(true);
    });
  });

  describe('parseWorkflow validation - body XOR workflows', () => {
    it('rejects step with command AND workflows', () => {
      const markdown = `
## 1. Mixed step

\`\`\`bash
echo "command"
\`\`\`

 - task.workflow.md

- PASS: CONTINUE
`;
      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('Cannot have both');
    });

    it('rejects step with prompts AND workflows', () => {
      const markdown = `
## 1. Mixed step

Some prompt text here.

 - task.workflow.md

- PASS: CONTINUE
`;
      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('Cannot have both');
    });

    it('allows substep with workflows only', () => {
      const markdown = `
## 1. Step with substeps

### 1.1 Execute workflow

 - task.workflow.md

- PASS ALL: CONTINUE
- FAIL ANY: STOP
`;
      const steps = parseWorkflow(markdown);
      expect(steps[0].substeps).toHaveLength(1);
      expect(steps[0].substeps?.[0].workflows).toEqual(['task.workflow.md']);
      expect(steps[0].command).toBeUndefined();
      // Note: The workflow reference text may be parsed as a prompt at step level
      // due to how list items are handled, but validation ensures proper XOR
    });

    // Existing validation already works - this test confirms it
    it('rejects step with workflows AND substeps (existing validation)', () => {
      const markdown = `
## 1. Mixed step

 - task.workflow.md

### 1.1 A substep
`;
      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('Cannot have both workflows and substeps');
    });
  });

  describe('parseWorkflow validation - heading hierarchy', () => {
    it('rejects H4 headings', () => {
      const markdown = `
## 1. Step one

#### Invalid H4 heading

Some content
`;
      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('H4');
    });

    it('rejects H5 headings', () => {
      const markdown = `
## 1. Step one

##### Invalid H5 heading
`;
      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
    });
  });
});