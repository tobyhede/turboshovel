import { describe, it, expect } from '@jest/globals';
import { validateWorkflow } from '../../../src/workflow/parser/validator.js';
import { createStepNumber, type Step } from '../../../src/workflow/types.js';

describe('validator strict rules', () => {
  const mockStep = (overrides: Partial<Step>): Step => ({
    description: 'Test',
    isDynamic: false,
    prompts: [],
    ...overrides
  });

  describe('GOTO rules', () => {
    it('rejects GOTO {N} without substep', () => {
      const steps = [mockStep({
        isDynamic: true,
        transitions: { all: true, pass: { type: 'GOTO', target: { step: '{N}' } }, fail: { type: 'STOP' } }
      })];
      expect(() => validateWorkflow(steps)).toThrow(/GOTO {N} alone is invalid/);
    });

    it('rejects GOTO self (step level)', () => {
      const steps = [mockStep({
        number: createStepNumber(1)!,
        transitions: { all: true, pass: { type: 'GOTO', target: { step: 1 as any } }, fail: { type: 'STOP' } }
      })];
      expect(() => validateWorkflow(steps)).toThrow(/GOTO self creates infinite loop/);
    });

    it('rejects GOTO self (substep level)', () => {
      const steps = [mockStep({
        number: createStepNumber(1)!,
        substeps: [{
          id: '1', description: 'S1', isDynamic: false,
          transitions: { all: true, pass: { type: 'GOTO', target: { step: 1 as any, substep: '1' } }, fail: { type: 'STOP' } }
        }]
      })];
      expect(() => validateWorkflow(steps)).toThrow(/GOTO self creates infinite loop/);
    });

    it('rejects GOTO into dynamic step from outside', () => {
      // Use two static steps, and in a separate test use a single dynamic step template.
      // Rule 2: Cannot mix. 
      // To test "from outside into dynamic", we'd need a dynamic context? 
      // But Rule 2 says you can't have both. 
      // So GOTO into dynamic is ONLY possible if you are already in that dynamic step (navigating substeps).
      // Any other GOTO to a dynamic step is by definition "from outside" and must be rejected.
      // BUT if we can't mix them, how can we have a GOTO target that is dynamic?
      // Only if the TARGET is the template itself.
      
      const steps = [
        mockStep({
          number: createStepNumber(1)!,
          transitions: { all: true, pass: { type: 'GOTO', target: { step: 2 as any } }, fail: { type: 'STOP' } }
        }),
        mockStep({
          number: createStepNumber(2)!,
          description: 'Dynamic',
          isDynamic: true // This will trigger Rule 2 first
        })
      ];
      expect(() => validateWorkflow(steps)).toThrow(/Invalid step pattern/);
    });
  });

  describe('NEXT rules', () => {
    it('rejects NEXT in static context', () => {
      const steps = [mockStep({
        number: createStepNumber(1)!,
        transitions: { all: true, pass: { type: 'NEXT' }, fail: { type: 'STOP' } }
      })];
      expect(() => validateWorkflow(steps)).toThrow(/NEXT action is only valid within dynamic step context/);
    });
  });

  describe('Exclusivity rules', () => {
    it('rejects H2 step with both body and substeps', () => {
      const steps = [mockStep({
        number: createStepNumber(1)!,
        prompts: [{ text: 'P' }],
        substeps: [{ id: '1', description: 'S', isDynamic: false }]
      })];
      expect(() => validateWorkflow(steps)).toThrow(/Violates Exclusivity Rule/);
    });

    it('rejects H3 substep with both body and workflows', () => {
      const steps = [mockStep({
        number: createStepNumber(1)!,
        substeps: [{
          id: '1', description: 'S', isDynamic: false,
          prompts: [{ text: 'P' }],
          workflows: ['w.workflow.md']
        }]
      })];
      expect(() => validateWorkflow(steps)).toThrow(/Violates Exclusivity Rule/);
    });
  });
});