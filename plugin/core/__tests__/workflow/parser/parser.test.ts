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

      const tasks = parseWorkflow(markdown);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].number).toBe(1);
      expect(tasks[0].description).toBe('First step');
      expect(tasks[1].number).toBe(2);
      expect(tasks[1].description).toBe('Second step');
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

      const tasks = parseWorkflow(markdown);
      expect(tasks[0].command?.code).toBe('npm test');
      expect(tasks[1].command?.code).toBe('git status');
    });

    test('ignores non-bash code blocks', () => {
      const markdown = `
## 1. Test

\`\`\`python
print("test")
\`\`\`
`;

      const tasks = parseWorkflow(markdown);
      expect(tasks[0].command).toBeUndefined();
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

      const tasks = parseWorkflow(markdown);
      expect(tasks[0].conditions).toBeDefined();
      expect(tasks[0].conditions?.pass).toEqual({ type: 'CONTINUE' });
      expect(tasks[0].conditions?.fail).toEqual({ type: 'STOP', message: 'fix tests' });
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

      const tasks = parseWorkflow(markdown);
      expect(tasks[0].conditions).toBeDefined();
      expect(tasks[0].conditions?.pass).toEqual({ type: 'CONTINUE' });
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

      const tasks = parseWorkflow(markdown);
      expect(tasks[0].conditions?.pass).toEqual({ type: 'GOTO', task: 3 });
    });
  });

  describe('prompts', () => {
    test('parses explicit prompts', () => {
      const markdown = `
## 1. Verify tests

**Prompt:** Do all functions have tests?
`;

      const tasks = parseWorkflow(markdown);
      expect(tasks[0].prompts).toHaveLength(1);
      expect(tasks[0].prompts[0].text).toBe('Do all functions have tests?');
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

      const tasks = parseWorkflow(markdown);
      expect(tasks[0].prompts).toHaveLength(1);
      expect(tasks[0].prompts[0].text).toContain('Review the code');
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

      const tasks = parseWorkflow(markdown);
      expect(tasks[0].prompts).toHaveLength(0);
      expect(tasks[0].command).toBeDefined();
    });

    test('parses multiple explicit prompts per step', () => {
      const markdown = `
## 1. Verify implementation

**Prompt:** Are all edge cases handled?

**Prompt:** Is error handling complete?
`;

      const tasks = parseWorkflow(markdown);
      expect(tasks[0].prompts).toHaveLength(2);
      expect(tasks[0].prompts[0].text).toBe('Are all edge cases handled?');
      expect(tasks[0].prompts[1].text).toBe('Is error handling complete?');
    });

    test('explicit prompts take precedence over implicit text', () => {
      // When explicit prompts exist, other text is NOT converted to implicit prompts
      const markdown = `
## 1. Review code

This is some descriptive text that should not become a prompt.

**Prompt:** Check for security issues.

More descriptive text here.
`;

      const tasks = parseWorkflow(markdown);
      // Only the explicit prompt should be captured
      expect(tasks[0].prompts).toHaveLength(1);
      expect(tasks[0].prompts[0].text).toBe('Check for security issues.');
    });
  });

  describe('validation', () => {
    test('throws on empty workflow', () => {
      expect(() => parseWorkflow('')).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow('')).toThrow('at least one task');
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
      ['1 First step', 'space']
    ])('parses header with %s separator', (header) => {
      const markdown = `
## ${header}

\`\`\`bash
echo "test"
\`\`\`
`;

      const tasks = parseWorkflow(markdown);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].number).toBe(1);
      expect(tasks[0].description).toBe('First step');
    });
  });

  describe('parseWorkflow with subtasks', () => {
    it('parses static subtasks', () => {
      const markdown = `
## 1. Dispatch reviewers

### 1.1 First reviewer (code-review-agent)
### 1.2 Second reviewer (code-agent)

PASS ALL: CONTINUE
FAIL ANY: STOP
`;
      const tasks = parseWorkflow(markdown);

      expect(tasks[0].subtasks).toHaveLength(2);
      expect(tasks[0].subtasks?.[0]).toEqual({
        id: '1',
        description: 'First reviewer',
        agentType: 'code-review-agent',
        isDynamic: false
      });
      expect(tasks[0].subtasks?.[1].id).toBe('2');
    });

    it('parses dynamic subtask template', () => {
      const markdown = `
## 1. Execute batch

### 1.{n} Execute task

PASS ALL: CONTINUE
FAIL ANY: STOP
`;
      const tasks = parseWorkflow(markdown);

      expect(tasks[0].subtasks).toHaveLength(1);
      expect(tasks[0].subtasks?.[0].isDynamic).toBe(true);
      expect(tasks[0].subtasks?.[0].id).toBe('{n}');
    });

    it('errors when subtask prefix doesnt match task', () => {
      const markdown = `
## 1. Task one

### 2.1 Wrong prefix
`;
      expect(() => parseWorkflow(markdown)).toThrow('does not belong');
    });

    it('errors for duplicate subtask IDs', () => {
      const markdown = `
## 1. Task

### 1.1 First
### 1.1 Duplicate
`;
      expect(() => parseWorkflow(markdown)).toThrow('Duplicate subtask');
    });

    it('errors when mixing static and dynamic subtasks', () => {
      const markdown = `
## 1. Task

### 1.1 Static
### 1.{n} Dynamic
`;
      expect(() => parseWorkflow(markdown)).toThrow('Cannot mix');
    });
  });
});
