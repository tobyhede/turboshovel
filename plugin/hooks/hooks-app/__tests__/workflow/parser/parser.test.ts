// __tests__/workflow/parser/parser.test.ts
import { parseWorkflow } from '../../../src/workflow/parser/parser';
import { WorkflowSyntaxError } from '../../../src/workflow/parser/types';

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

    test('ignores non-bash code blocks', () => {
      const markdown = `
## 1. Test

\`\`\`python
print("test")
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].command).toBeUndefined();
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
      expect(steps[0].conditions).toBeDefined();
      expect(steps[0].conditions?.pass).toEqual({ type: 'CONTINUE' });
      expect(steps[0].conditions?.fail).toEqual({ type: 'STOP', message: 'fix tests' });
    });

    test('parses list-based conditionals', () => {
      const markdown = `
## 1. Run tests

\`\`\`bash
npm test
\`\`\`

- PASS: CONTINUE
- FAIL: STOP fix tests
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].conditions).toBeDefined();
      expect(steps[0].conditions?.pass).toEqual({ type: 'CONTINUE' });
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
      expect(steps[0].conditions?.pass).toEqual({ type: 'GOTO', step: 3 });
    });
  });

  describe('prompts', () => {
    test('parses explicit prompts', () => {
      const markdown = `
## 1. Verify tests

**Prompt:** Do all functions have tests?
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].prompts).toHaveLength(1);
      expect(steps[0].prompts[0].text).toBe('Do all functions have tests?');
    });

    test('creates implicit prompts for steps without code blocks', () => {
      const markdown = `
## 1. Review code

Review the code changes carefully.

- PASS: CONTINUE
- FAIL: STOP

## 2. Fix issues

\`\`\`bash
echo "fix"
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].prompts).toHaveLength(1);
      expect(steps[0].prompts[0].text).toContain('Review the code');
    });

    test('no implicit prompt when code block exists', () => {
      const markdown = `
## 1. Run tests

\`\`\`bash
npm test
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].prompts).toHaveLength(0);
      expect(steps[0].command).toBeDefined();
    });

    test('parses multiple explicit prompts per step', () => {
      const markdown = `
## 1. Verify implementation

**Prompt:** Are all edge cases handled?

**Prompt:** Is error handling complete?
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].prompts).toHaveLength(2);
      expect(steps[0].prompts[0].text).toBe('Are all edge cases handled?');
      expect(steps[0].prompts[1].text).toBe('Is error handling complete?');
    });

    test('explicit prompts take precedence over implicit text', () => {
      // When explicit prompts exist, other text is NOT converted to implicit prompts
      const markdown = `
## 1. Review code

This is some descriptive text that should not become a prompt.

**Prompt:** Check for security issues.

More descriptive text here.
`;

      const steps = parseWorkflow(markdown);
      // Only the explicit prompt should be captured
      expect(steps[0].prompts).toHaveLength(1);
      expect(steps[0].prompts[0].text).toBe('Check for security issues.');
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

    test('throws on multiple code blocks per step', () => {
      const markdown = `
## 1. Test with multiple blocks

\`\`\`bash
echo "first"
\`\`\`

\`\`\`bash
echo "second"
\`\`\`
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('Multiple code blocks');
    });

    test('throws on invalid GOTO target', () => {
      const markdown = `
## 1. Bad goto

PASS: GOTO 99
FAIL: STOP

\`\`\`bash
echo "test"
\`\`\`
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('does not exist');
    });

    test('throws on GOTO self (infinite loop)', () => {
      const markdown = `
## 1. Self loop

PASS: GOTO 1
FAIL: STOP

\`\`\`bash
echo "test"
\`\`\`
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('infinite loop');
    });

    test('rejects H1 as step header', () => {
      const markdown = `
# 1. First step

\`\`\`bash
echo "test"
\`\`\`
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('H1 headers');
    });
  });

  describe('header separators', () => {
    test.each([
      ['1. First step', 'dot'],
      ['1: First step', 'colon'],
      ['1 - First step', 'dash'],
      ['1) First step', 'paren'],
      ['1 First step', 'space'],
    ])('parses header with %s separator', (header) => {
      const markdown = `
## ${header}

\`\`\`bash
echo "test"
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps).toHaveLength(1);
      expect(steps[0].number).toBe(1);
      expect(steps[0].description).toBe('First step');
    });
  });
});
