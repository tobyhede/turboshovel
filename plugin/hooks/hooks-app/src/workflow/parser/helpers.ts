// src/workflow/parser/helpers.ts

import { createStepNumber, type Action, type StepNumber } from '../types';
import type { ParsedConditional } from './types';

/**
 * Strip common separators and whitespace
 */
export function stripSeparator(text: string): string {
  return text
    .replace(/^[.:—\-)\s]+/, '')
    .trim();
}

/**
 * Extract step number and description from header text
 * Returns null if not a valid step header
 */
export function extractStepHeader(text: string): { number: StepNumber; description: string } | null {
  const trimmed = text.trim();

  // Find where the number ends
  let numEnd = 0;
  while (numEnd < trimmed.length && /\d/.test(trimmed[numEnd])) {
    numEnd++;
  }

  if (numEnd === 0) {
    return null; // No number at start
  }

  // Parse the number
  const number = parseInt(trimmed.slice(0, numEnd), 10);
  const stepNumber = createStepNumber(number);
  if (!stepNumber) {
    return null; // Invalid step number (zero or negative)
  }

  // Strip separator and extract description
  const description = stripSeparator(trimmed.slice(numEnd));

  // Reject "Step" keyword explicitly
  if (description.startsWith('Step ') || description === 'Step') {
    return null;
  }

  if (!description) {
    return null;
  }

  return { number: stepNumber, description };
}

/**
 * Parse an action string into an Action object
 */
export function parseAction(text: string): Action | null {
  const trimmed = text.trim();

  if (trimmed === 'CONTINUE') {
    return { type: 'CONTINUE' };
  }

  if (trimmed === 'DONE') {
    return { type: 'DONE' };
  }

  if (trimmed === 'STOP') {
    return { type: 'STOP' };
  }

  if (trimmed.startsWith('STOP ')) {
    const message = trimmed.slice(5).trim();
    return { type: 'STOP', message };
  }

  if (trimmed.startsWith('GOTO ')) {
    const stepStr = trimmed.slice(5).trim();
    const stepNum = parseInt(stepStr, 10);
    const step = createStepNumber(stepNum);
    if (!step) {
      return null;
    }
    return { type: 'GOTO', step };
  }

  if (trimmed === 'RETRY') {
    return { type: 'RETRY' };
  }

  if (trimmed.startsWith('RETRY ')) {
    const maxStr = trimmed.slice(6).trim();
    const max = parseInt(maxStr, 10);
    if (isNaN(max)) {
      return null;
    }
    return { type: 'RETRY', max };
  }

  // Backward compatibility: old syntax
  if (trimmed === 'Continue') {
    return { type: 'CONTINUE' };
  }

  if (trimmed.startsWith('Go to Step ')) {
    const stepStr = trimmed.slice(11).trim();
    const stepNum = parseInt(stepStr, 10);
    const step = createStepNumber(stepNum);
    if (!step) {
      return null;
    }
    return { type: 'GOTO', step };
  }

  if (trimmed.startsWith('STOP (') && trimmed.endsWith(')')) {
    const message = trimmed.slice(6, -1);
    return { type: 'STOP', message };
  }

  return null;
}

/**
 * Parse a conditional line (PASS: action or FAIL: action)
 */
export function parseConditional(text: string): ParsedConditional | null {
  const trimmed = text.trim();

  // Try ALLCAPS first (new syntax)
  if (trimmed.startsWith('PASS')) {
    const rest = trimmed.slice(4);
    const actionStr = stripSeparator(rest);
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'pass', action };
  }

  if (trimmed.startsWith('FAIL')) {
    const rest = trimmed.slice(4);
    const actionStr = stripSeparator(rest);
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'fail', action };
  }

  // Backward compatibility: old syntax (Pass: / Fail:)
  if (trimmed.startsWith('Pass:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'pass', action };
  }

  if (trimmed.startsWith('Fail:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'fail', action };
  }

  return null;
}

/**
 * Convert pending conditionals to Conditions object
 */
export function convertConditionals(conditionals: ParsedConditional[]): { pass: Action; fail: Action } | null {
  if (conditionals.length === 0) {
    return null;
  }

  let passAction: Action | null = null;
  let failAction: Action | null = null;

  for (const conditional of conditionals) {
    if (conditional.type === 'pass') {
      passAction = conditional.action;
    } else {
      failAction = conditional.action;
    }
  }

  // If we have both, create Conditions
  if (passAction && failAction) {
    return { pass: passAction, fail: failAction };
  }

  if (passAction && !failAction) {
    return { pass: passAction, fail: { type: 'STOP' } };
  }

  if (!passAction && failAction) {
    return { pass: { type: 'CONTINUE' }, fail: failAction };
  }

  return null;
}
