// __tests__/workflow/renderer.test.ts
import { describe, it, expect } from '@jest/globals';
import {
  renderAction,
  renderTransitions,
  renderSubstep,
  renderStep
} from '../../src/workflow/renderer/renderer.js';
import { parseWorkflow } from '../../src/workflow/parser/parser.js';
import { createStepNumber, type Step, type Substep, type StepNumber } from '../../src/workflow/types.js';

describe('renderAction', () => {
  it('renders CONTINUE', () => {
    expect(renderAction({ type: 'CONTINUE' })).toBe('CONTINUE');
  });

  it('renders DONE', () => {
    expect(renderAction({ type: 'DONE' })).toBe('DONE');
  });

  it('renders STOP without message', () => {
    expect(renderAction({ type: 'STOP' })).toBe('STOP');
  });

  it('renders STOP with message', () => {
    expect(renderAction({ type: 'STOP', message: 'fix tests' })).toBe('STOP "fix tests"');
  });

  it('renders GOTO step only', () => {
    expect(renderAction({ type: 'GOTO', target: { step: 3 as StepNumber } })).toBe('GOTO 3');
  });

  it('renders GOTO with substep', () => {
    expect(renderAction({ type: 'GOTO', target: { step: 3 as StepNumber, substep: '2' } })).toBe('GOTO 3.2');
  });

  it('renders RETRY with nested action', () => {
    expect(renderAction({ type: 'RETRY', max: 2, then: { type: 'STOP' } })).toBe('RETRY 2 STOP');
  });
});

describe('renderTransitions', () => {
  it('renders pass and fail transitions', () => {
    const result = renderTransitions({
      all: true,
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP', message: 'failed' }
    });
    expect(result).toBe('- PASS: CONTINUE\n- FAIL: STOP "failed"');
  });
});

describe('renderSubstep', () => {
  it('renders substep with parent step number (N.M format)', () => {
    const substep: Substep = { id: '1', description: 'First reviewer', isDynamic: false };
    expect(renderSubstep(substep, 3)).toBe('### 3.1 First reviewer');
  });

  it('renders substep with agent type', () => {
    const substep: Substep = { id: '2', description: 'Second reviewer', agentType: 'code-agent', isDynamic: false };
    expect(renderSubstep(substep, 1)).toBe('### 1.2 Second reviewer (code-agent)');
  });

  it('renders dynamic substep template', () => {
    const substep: Substep = { id: '{n}', description: 'Execute step', isDynamic: true };
    expect(renderSubstep(substep, 2)).toBe('### 2.{n} Execute step');
  });

  it('renders substep with workflows', () => {
    const substep: Substep = { id: '1', description: 'With workflow', isDynamic: false, workflows: ['task.workflow.md'] };
    expect(renderSubstep(substep, 1)).toBe('### 1.1 With workflow [@task.workflow.md]');
  });
});

describe('renderStep', () => {
  it('renders basic step', () => {
    const step: Step = {
      number: createStepNumber(1)!,
      description: 'First step',
      prompts: []
    };
    const result = renderStep(step);
    expect(result).toContain('## 1. First step');
  });

  it('renders step with substeps including parent step number', () => {
    const step: Step = {
      number: createStepNumber(3)!,
      description: 'Dispatch reviewers',
      prompts: [],
      substeps: [
        { id: '1', description: 'First reviewer', isDynamic: false },
        { id: '2', description: 'Second reviewer', agentType: 'code-agent', isDynamic: false }
      ]
    };
    const result = renderStep(step);
    expect(result).toContain('### 3.1 First reviewer');
    expect(result).toContain('### 3.2 Second reviewer (code-agent)');
  });

  it('renders step with command', () => {
    const step: Step = {
      number: createStepNumber(1)!,
      description: 'Run tests',
      prompts: [],
      command: { code: 'npm test' }
    };
    const result = renderStep(step);
    expect(result).toContain('```bash');
    expect(result).toContain('npm test');
    expect(result).toContain('```');
  });
});

describe('round-trip: parse -> render -> parse', () => {
  it('round-trips simple workflow', () => {
    const original = `## 1. First step

Some description

## 2. Second step

More description`;

    const parsed1 = parseWorkflow(original);
    const rendered = parsed1.map(renderStep).join('\n\n');
    const parsed2 = parseWorkflow(rendered);

    expect(parsed2).toHaveLength(2);
    expect(parsed2[0].number).toBe(1);
    expect(parsed2[0].description).toBe('First step');
    expect(parsed2[1].number).toBe(2);
    expect(parsed2[1].description).toBe('Second step');
  });

  it('round-trips workflow with substeps', () => {
    const original = `## 1. Dispatch reviewers

### 1.1 First reviewer (code-review-agent)
### 1.2 Second reviewer (code-agent)

PASS ALL: CONTINUE
FAIL ANY: STOP

## 2. Complete`;

    const parsed1 = parseWorkflow(original);
    expect(parsed1[0].substeps).toHaveLength(2);

    const rendered = parsed1.map(renderStep).join('\n\n');
    const parsed2 = parseWorkflow(rendered);

    // Verify substeps survive round-trip
    expect(parsed2[0].substeps).toHaveLength(2);
    expect(parsed2[0].substeps?.[0].id).toBe('1');
    expect(parsed2[0].substeps?.[0].description).toBe('First reviewer');
    expect(parsed2[0].substeps?.[0].agentType).toBe('code-review-agent');
    expect(parsed2[0].substeps?.[1].id).toBe('2');
    expect(parsed2[0].substeps?.[1].agentType).toBe('code-agent');
  });

  it('round-trips workflow with dynamic substeps', () => {
    const original = `## 1. Execute batch

### 1.{n} Execute step

PASS ALL: CONTINUE
FAIL ANY: STOP`;

    const parsed1 = parseWorkflow(original);
    expect(parsed1[0].substeps?.[0].isDynamic).toBe(true);

    const rendered = parsed1.map(renderStep).join('\n\n');
    const parsed2 = parseWorkflow(rendered);

    expect(parsed2[0].substeps).toHaveLength(1);
    expect(parsed2[0].substeps?.[0].isDynamic).toBe(true);
    expect(parsed2[0].substeps?.[0].id).toBe('{n}');
  });

  it('round-trips workflow with GOTO substep targets', () => {
    const original = `## 1. First step

PASS: GOTO 2.1
FAIL: STOP

## 2. Target step

### 2.1 First substep
### 2.2 Second substep

PASS ALL: CONTINUE
FAIL ANY: STOP`;

    const parsed1 = parseWorkflow(original);
    expect(parsed1[0].transitions?.pass).toEqual({ type: 'GOTO', target: { step: 2, substep: '1' } });

    const rendered = parsed1.map(renderStep).join('\n\n');
    const parsed2 = parseWorkflow(rendered);

    expect(parsed2[0].transitions?.pass).toEqual({ type: 'GOTO', target: { step: 2, substep: '1' } });
  });

  it('round-trips workflow with step-level workflows', () => {
    const original = `## 1. Setup

 - setup.workflow.md

## 2. Continue`;

    const parsed1 = parseWorkflow(original);
    expect(parsed1[0].workflows).toEqual(['setup.workflow.md']);

    const rendered = parsed1.map(renderStep).join('\n\n');
    const parsed2 = parseWorkflow(rendered);

    expect(parsed2[0].workflows).toEqual(['setup.workflow.md']);
  });
});
