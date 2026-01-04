import { createStepNumber, type StepNumber } from './types.js';

/**
 * Step identifier with optional substep
 * Format: "3", "3.1", or "{N}.1" (dynamic substep navigation)
 * Note: "{N}" alone is NOT supported - use NEXT action instead
 */
export interface StepId {
  readonly step: StepNumber | '{N}';  // Numeric or dynamic reference
  readonly substep?: string;          // Numeric string "1", "2", or "{n}"
}

export interface ParseStepIdOptions {
  /** Require a separator after the step ID (space, dash, colon) */
  readonly requireSeparator?: boolean;
}

/**
 * Parse StepId from string with configurable behavior
 *
 * The requireSeparator option controls parsing strictness:
 *
 * Without requireSeparator (CLI argument parsing):
 *   Used when parsing StepIds from CLI arguments like `--step 3` or `--step 3.1`
 *   Expects the entire string to be the step ID with no trailing text
 *   "3" -> { step: 3 }
 *   "3.1" -> { step: 3, substep: '1' }
 *   "{N}.1" -> { step: '{N}', substep: '1' } (dynamic substep)
 *   "3 - description" -> null (fails because of space)
 *
 * With requireSeparator (Step description parsing):
 *   Used when parsing StepIds from agent step descriptions where additional text
 *   follows the ID. The separator requirement prevents false matches on text
 *   that happens to start with a number.
 *   "3 - Review code" -> { step: 3 }
 *   "3.1 - First reviewer" -> { step: 3, substep: '1' }
 *   "5: Execute" -> { step: 5 }
 *   "3" -> null (fails because no separator found)
 *
 */
export function parseStepIdFromString(input: string, options?: ParseStepIdOptions): StepId | null {
  if (!input) return null;

  const requireSeparator = options?.requireSeparator ?? false;

  // Check for dynamic substep reference: {N}.M (NOT {N} alone - use NEXT)
  if (input.startsWith('{N}.')) {
    // Check for {N}.M pattern (M is numeric or {n})
    const dynamicMatch = /^\{N\}\.(\d+|\{n\})$/.exec(input);
    if (dynamicMatch) {
      // Validate substep is >= 1 for numeric
      if (dynamicMatch[1] !== '{n}') {
        const substepNum = parseInt(dynamicMatch[1], 10);
        if (substepNum < 1) return null;
      }
      return { step: '{N}', substep: dynamicMatch[1] };
    }
    // With separator: {N}.1 Description
    if (requireSeparator) {
      const sepMatch = /^\{N\}\.(\d+|\{n\})[\s\-:]/.exec(input);
      if (sepMatch) {
        return { step: '{N}', substep: sepMatch[1] };
      }
    }
    return null;
  }

  // Reject {N} alone - use NEXT action instead
  if (input === '{N}' || input.startsWith('{N}')) {
    return null;
  }

  // Numeric step: existing logic
  const pattern = requireSeparator
    ? /^(\d+)(?:\.(\d+))?[\s\-:]/ // Must have separator
    : /^(\d+)(?:\.(\d+))?$/; // Must match entire string

  const match = input.match(pattern);
  if (!match) return null;

  const stepNum = parseInt(match[1], 10);
  const step = createStepNumber(stepNum);
  if (!step) return null; // Invalid step number (0, negative, or too large)

  // Validate substep is >= 1 (1-indexed, reject 0)
  if (match[2]) {
    const substepNum = parseInt(match[2], 10);
    if (substepNum < 1) return null;
  }

  return {
    step,
    substep: match[2] // Already a numeric string
  };
}

/**
 * Serialize StepId to string (e.g., { step: 3, substep: '1' } -> "3.1" or { step: '{N}', substep: '1' } -> "{N}.1")
 */
export function stepIdToString(stepId: StepId): string {
  const stepStr = stepId.step === '{N}' ? '{N}' : String(stepId.step);
  return stepId.substep ? `${stepStr}.${stepId.substep}` : stepStr;
}

/**
 * Compare two StepIds for equality
 */
export function stepIdEquals(a: StepId, b: StepId): boolean {
  return a.step === b.step && a.substep === b.substep;
}