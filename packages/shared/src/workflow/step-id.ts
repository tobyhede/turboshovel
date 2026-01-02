import { createStepNumber, type StepNumber } from './types.js';

/**
 * Step identifier with optional substep
 * Format: "3" or "3.1" (step with optional numeric substep)
 */
export interface StepId {
  readonly step: StepNumber;
  readonly substep?: string; // Numeric string: "1", "2", etc.
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

  // Build regex based on options
  // Substep is now numeric (e.g., 3.1, 3.2)
  const pattern = requireSeparator
    ? /^(\d+)(?:\.(\d+))?[\s\-:]/ // Must have separator
    : /^(\d+)(?:\.(\d+))?$/; // Must match entire string

  const match = input.match(pattern);
  if (!match) return null;

  const stepNum = parseInt(match[1], 10);
  const step = createStepNumber(stepNum);
  if (!step) return null; // Invalid step number (0, negative, or too large)

  return {
    step,
    substep: match[2] // Already a numeric string
  };
}

/**
 * Serialize StepId to string (e.g., { step: 3, substep: '1' } -> "3.1")
 */
export function stepIdToString(stepId: StepId): string {
  return stepId.substep ? `${String(stepId.step)}.${stepId.substep}` : String(stepId.step);
}

/**
 * Compare two StepIds for equality
 */
export function stepIdEquals(a: StepId, b: StepId): boolean {
  return a.step === b.step && a.substep === b.substep;
}