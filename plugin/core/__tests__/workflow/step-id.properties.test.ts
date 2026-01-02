import fc from 'fast-check';
import {
  createStepNumber,
  incrementStepNumber,
  decrementStepNumber,
  stepIdToString,
  parseStepIdFromString
} from '@turboshovel/shared';

describe('StepId Property Tests', () => {
  // Generator for valid step numbers (1-999999)
  const stepNumberArb = fc.integer({ min: 1, max: 999999 });

  // Generator for valid substep numbers (1-99 as strings)
  const substepArb = fc.integer({ min: 1, max: 99 }).map(n => n.toString());

  describe('createStepNumber bounds', () => {
    it('accepts all integers 1 to 999999', () => {
      fc.assert(
        fc.property(stepNumberArb, (n) => {
          const result = createStepNumber(n);
          expect(result).not.toBeNull();
          expect(result).toBe(n);
        }),
        { numRuns: 500 }
      );
    });

    it('rejects integers <= 0', () => {
      fc.assert(
        fc.property(fc.integer({ max: 0 }), (n) => {
          const result = createStepNumber(n);
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('rejects integers > 999999', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1000000 }), (n) => {
          const result = createStepNumber(n);
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('stepId roundtrip', () => {
    it('serializes and parses back to same stepId (step only)', () => {
      fc.assert(
        fc.property(stepNumberArb, (n) => {
          const stepNum = createStepNumber(n)!;
          const stepId = { step: stepNum };
          const str = stepIdToString(stepId);
          const parsed = parseStepIdFromString(str, { requireSeparator: false });

          expect(parsed).not.toBeNull();
          expect(parsed!.step).toBe(stepNum);
          expect(parsed!.substep).toBeUndefined();
        }),
        { numRuns: 200 }
      );
    });

    it('serializes and parses back to same stepId (with substep)', () => {
      fc.assert(
        fc.property(stepNumberArb, substepArb, (n, substep) => {
          const stepNum = createStepNumber(n)!;
          const stepId = { step: stepNum, substep };
          const str = stepIdToString(stepId);
          const parsed = parseStepIdFromString(str, { requireSeparator: false });

          expect(parsed).not.toBeNull();
          expect(parsed!.step).toBe(stepNum);
          expect(parsed!.substep).toBe(substep);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('increment/decrement properties', () => {
    it('increment then decrement returns original (except at bounds)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 999998 }), (n) => {
          const stepNum = createStepNumber(n)!;
          const incremented = incrementStepNumber(stepNum);
          expect(incremented).not.toBeNull();

          const decremented = decrementStepNumber(incremented!);
          expect(decremented).toBe(stepNum);
        }),
        { numRuns: 200 }
      );
    });

    it('decrement then increment returns original (except at bounds)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 999999 }), (n) => {
          const stepNum = createStepNumber(n)!;
          const decremented = decrementStepNumber(stepNum);
          expect(decremented).not.toBeNull();

          const incremented = incrementStepNumber(decremented!);
          expect(incremented).toBe(stepNum);
        }),
        { numRuns: 200 }
      );
    });

    it('increment at max returns null', () => {
      const maxStep = createStepNumber(999999)!;
      expect(incrementStepNumber(maxStep)).toBeNull();
    });

    it('decrement at min returns null', () => {
      const minStep = createStepNumber(1)!;
      expect(decrementStepNumber(minStep)).toBeNull();
    });
  });

  describe('substep parsing', () => {
    it('parses multi-digit substep numbers', () => {
      fc.assert(
        fc.property(
          stepNumberArb,
          substepArb,
          (n, substep) => {
            const str = `${String(n)}.${substep}`;
            const parsed = parseStepIdFromString(str, { requireSeparator: false });

            expect(parsed).not.toBeNull();
            expect(parsed!.substep).toBe(substep);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});