import { describe, it, expect } from '@jest/globals';
import { parseWorkflow } from '../src/index.js';

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
    expect(() => parseWorkflow(markdown)).toThrow(/Violates Exclusivity Rule/i);
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

describe('code block flexibility', () => {
  it('supports sh and shell aliases for commands', () => {
    const markdown = `## 1. Sh
\`\`\`sh
ls
\`\`\`

## 2. Shell
\`\`\`shell
pwd
\`\`\`
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].command?.code).toBe('ls');
    expect(steps[1].command?.code).toBe('pwd');
  });

  it('supports prompt tag for non-executable prompts', () => {
    const markdown = `## 1. Instruction
\`\`\`prompt
Please look at this example.
\`\`\`
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].command).toBeUndefined();
    expect(steps[0].prompts[0].text).toBe('Please look at this example.');
  });

  it('treats other tags as passive prose', () => {
    const markdown = `## 1. Example
\`\`\`json
{"key": "value"}
\`\`\`
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].command).toBeUndefined();
    expect(steps[0].prompts[0].text).toContain('```json');
    expect(steps[0].prompts[0].text).toContain('{"key": "value"}');
  });

  it('parses prompt code blocks as prompted commands', () => {
    const md = `## 1. Step with prompted code

Show this to agent.

\`\`\`prompt
npm run example --flag value
\`\`\`

- PASS: DONE
`;
    const steps = parseWorkflow(md);
    expect(steps[0].command).toEqual({
      code: 'npm run example --flag value',
      prompted: true,
    });
  });

  it('parses bash code blocks as executable commands (no prompted flag)', () => {
    const md = `## 1. Step with bash code

Run this automatically.

\`\`\`bash
npm run build
\`\`\`

- PASS: DONE
`;
    const steps = parseWorkflow(md);
    expect(steps[0].command).toEqual({
      code: 'npm run build',
    });
    expect(steps[0].command?.prompted).toBeUndefined();
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

describe('Mixed implicit and explicit prompts', () => {
  it('preserves both explicit and implicit prompts', () => {
    const markdown = `## 1. Execute
**Prompt:** Explicit instruction.
- Implicit instruction 1
- Implicit instruction 2

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    const combinedPrompt = steps[0].prompts.map(p => p.text).join('\n');
    expect(combinedPrompt).toContain('Explicit instruction.');
    expect(combinedPrompt).toContain('- Implicit instruction 1');
    expect(combinedPrompt).toContain('- Implicit instruction 2');
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
    expect(() => parseWorkflow(markdown)).toThrow(/substep does not exist/i);
  });
});

describe('substep with prompts', () => {
  it('parses explicit prompt in substep', () => {
    const markdown = `## 1. Execute

### 1.1 Implement task

**Prompt:** Do the implementation work.

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].substeps![0].prompts).toHaveLength(1);
    expect(steps[0].substeps![0].prompts[0].text).toBe('Do the implementation work.');
  });

  it('parses implicit prompt in substep', () => {
    const markdown = `## 1. Execute

### 1.1 Implement task

This is the implicit prompt text.

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].substeps![0].prompts).toHaveLength(1);
    expect(steps[0].substeps![0].prompts[0].text).toBe('This is the implicit prompt text.');
  });
});

describe('substep with transitions', () => {
  it('parses transitions in substep', () => {
    const markdown = `## 1. Execute

### 1.1 First step

Do work.

- PASS: CONTINUE
- FAIL: STOP "BLOCKED"

### 1.2 Second step

More work.

- PASS: DONE
- FAIL: GOTO 1.1
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].substeps![0].transitions?.pass).toEqual({ type: 'CONTINUE' });
    expect(steps[0].substeps![0].transitions?.fail).toEqual({ type: 'STOP', message: 'BLOCKED' });
    expect(steps[0].substeps![1].transitions?.pass).toEqual({ type: 'DONE' });
    expect(steps[0].substeps![1].transitions?.fail).toEqual({ type: 'GOTO', target: { step: 1, substep: '1' } });
  });

  it('single substep gets transitions not step', () => {
    const markdown = `## 1. Execute

### 1.1 First step

Do work.

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].substeps![0].transitions?.pass).toEqual({ type: 'CONTINUE' });
    expect(steps[0].substeps![0].transitions?.fail).toEqual({ type: 'STOP' });
  });
});

describe('substep GOTO validation', () => {
  it('accepts GOTO to sibling substep', () => {
    const markdown = `## 1. Execute

### 1.1 First step

- PASS: CONTINUE
- FAIL: GOTO 1.2

### 1.2 Second step

- PASS: CONTINUE
- FAIL: STOP

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].substeps![0].transitions?.fail).toEqual({
      type: 'GOTO',
      target: { step: 1, substep: '2' }
    });
  });

  it('rejects GOTO to non-existent substep from substep', () => {
    const markdown = `## 1. Execute

### 1.1 First step

- PASS: CONTINUE
- FAIL: GOTO 1.99

### 1.2 Second step

- PASS: CONTINUE
- FAIL: STOP

- PASS: CONTINUE
- FAIL: STOP
`;
    expect(() => parseWorkflow(markdown)).toThrow(/substep.*does not exist|invalid/i);
  });
});

describe('substep with command', () => {
  it('parses bash code block in substep', () => {
    const markdown = `## 1. Execute

### 1.1 Run checks

\`\`\`bash
npm run lint
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`;
    const steps = parseWorkflow(markdown);
    expect(steps[0].substeps).toHaveLength(1);
    expect(steps[0].substeps![0].command?.code).toBe('npm run lint');
  });

  it('rejects multiple code blocks in substep', () => {
    const markdown = `## 1. Execute

### 1.1 Run checks

\`\`\`bash
npm run lint
\`\`\`

\`\`\`bash
npm test
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`;
    expect(() => parseWorkflow(markdown)).toThrow(/multiple code blocks/i);
  });
});
