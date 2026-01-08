import { describe, it, expect } from '@jest/globals';
import { renderStepForCLI } from '../../src/cli/render.js';
import type { Step } from '../../src/workflow/types.js';
import { createStepNumber } from '../../src/workflow/types.js';

describe('renderStepForCLI', () => {
  it('renders step with prompts before command', () => {
    const step: Step = {
      number: createStepNumber(1)!,
      description: 'Install dependencies',
      prompts: [{ text: 'Run npm install to set up project.' }],
      command: { code: 'npm install' },
    };

    const result = renderStepForCLI(step);

    // Check order: heading, prompt, command
    const headingIdx = result.indexOf('## 1. Install dependencies');
    const promptIdx = result.indexOf('Run npm install');
    const commandIdx = result.indexOf('npm install');

    expect(headingIdx).toBeLessThan(promptIdx);
    expect(promptIdx).toBeLessThan(commandIdx);
  });

  it('renders step without command', () => {
    const step: Step = {
      number: createStepNumber(2)!,
      description: 'Review changes',
      prompts: [{ text: 'Review the diff and approve.' }],
    };

    const result = renderStepForCLI(step);

    expect(result).toContain('## 2. Review changes');
    expect(result).toContain('Review the diff and approve.');
    expect(result).not.toContain('```bash');
  });

  it('renders step without prompts', () => {
    const step: Step = {
      number: createStepNumber(3)!,
      description: 'Run build',
      prompts: [],
      command: { code: 'npm run build' },
    };

    const result = renderStepForCLI(step);

    expect(result).toContain('## 3. Run build');
    expect(result).toContain('npm run build');
  });

  it('omits transitions and substeps', () => {
    const step: Step = {
      number: createStepNumber(1)!,
      description: 'With extras',
      prompts: [],
      command: { code: 'npm test' },
      transitions: {
        all: true,
        pass: { type: 'CONTINUE' },
        fail: { type: 'STOP' },
      },
      substeps: [{ id: '1', description: 'Substep', isDynamic: false }],
    };

    const result = renderStepForCLI(step);

    expect(result).not.toContain('CONTINUE');
    expect(result).not.toContain('STOP');
    expect(result).not.toContain('Substep');
  });
});

describe('renderStepForCLI with response prompt', () => {
  it('should show Yes/No prompt for yes-no transitions', () => {
    const step: Step = {
      number: createStepNumber(1)!,
      isDynamic: false,
      description: 'Review plan',
      prompts: [{ text: 'Is the plan clear?' }],
      transitions: {
        all: true,
        pass: { kind: 'yes', action: { type: 'CONTINUE' } },
        fail: { kind: 'no', action: { type: 'STOP' } },
      },
    };
    const result = renderStepForCLI(step);
    expect(result).toContain('Yes/No? (tsv yes | tsv no)');
  });

  it('should show Pass/Fail prompt for pass-fail transitions', () => {
    const step: Step = {
      number: createStepNumber(1)!,
      isDynamic: false,
      description: 'Run tests',
      prompts: [],
      command: { code: 'npm test' },
      transitions: {
        all: true,
        pass: { kind: 'pass', action: { type: 'CONTINUE' } },
        fail: { kind: 'fail', action: { type: 'STOP' } },
      },
    };
    const result = renderStepForCLI(step);
    expect(result).toContain('Pass/Fail? (tsv pass | tsv fail)');
  });
});
