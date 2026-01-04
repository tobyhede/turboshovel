// src/workflow/parser/helpers.ts

import { createStepNumber, type Action, type NonRetryAction, type Transitions, type StepNumber } from '../types.js';
import type { ParsedConditional, AggregationModifier } from './types.js';
import { WorkflowSyntaxError } from './types.js';
import { parseStepIdFromString } from '../step-id.js';

export interface ParsedSubstepHeader {
  stepNumber: number;
  id: string; // "1", "2", or "{n}" for dynamic
  description: string;
  agentType?: string;
  isDynamic: boolean;
}

/**
 * Strip common separators and whitespace
 */
export function stripSeparator(text: string): string {
  return text.replace(/^[.:—→\-)\s]+/, '').trim();
}

export interface ParsedStepHeader {
  number?: StepNumber;
  isDynamic: boolean;
  description: string;
}

/**
 * Extract step number and description from header text
 * Returns null if not a valid step header
 *
 * Supports:
 *   "1. Description" -> { number: 1, isDynamic: false, description }
 *   "{N}. Description" -> { isDynamic: true, description }
 */
export function extractStepHeader(text: string): ParsedStepHeader | null {
  const trimmed = text.trim();

  // Check for dynamic step: "{N}. Description"
  if (trimmed.startsWith('{N}')) {
    const rest = trimmed.slice(3); // Skip "{N}"
    const description = stripSeparator(rest);
    if (!description) {
      return null;
    }
    return { isDynamic: true, description };
  }

  // Static step: "N. Description"
  let numEnd = 0;
  while (numEnd < trimmed.length && /\d/.test(trimmed[numEnd])) {
    numEnd++;
  }

  if (numEnd === 0) {
    return null; // No number at start
  }

  const number = parseInt(trimmed.slice(0, numEnd), 10);
  const stepNumber = createStepNumber(number);
  if (!stepNumber) {
    return null; // Invalid step number (zero or negative)
  }

  const description = stripSeparator(trimmed.slice(numEnd));
  if (!description) {
    return null;
  }

  return { number: stepNumber, isDynamic: false, description };
}

/**
 * Extract substep header from H3 text
 * Patterns:
 *   "1.1 First reviewer (code-agent)" -> { stepNumber: 1, id: "1", ... }
 *   "3.{n} Execute step" -> { stepNumber: 3, id: "{n}", isDynamic: true }
 */
export function extractSubstepHeader(text: string): ParsedSubstepHeader | null {
  const trimmed = text.trim();

  // Match: "N.M description" or "N.{n} description" with optional (agent-type)
  const match = /^(\d+)\.(\{n\}|\d+)\s+(.+?)(?:\s+\(([^)]+)\))?$/.exec(trimmed);
  if (!match) return null;

  const [, stepStr, substepId, desc, agent] = match;
  const stepNumber = parseInt(stepStr, 10);
  if (stepNumber <= 0) return null;

  const isDynamic = substepId === '{n}';
  const id = substepId; // Keep as-is: "{n}" or numeric string

  return {
    stepNumber,
    id,
    description: desc.trim(),
    agentType: agent ? agent.trim() : undefined,
    isDynamic
  };
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
    const targetStr = trimmed.slice(5).trim();
    const target = parseStepIdFromString(targetStr);
    if (!target) {
      return null;
    }
    return { type: 'GOTO', target };
  }

  if (trimmed === 'RETRY') {
    return { type: 'RETRY', max: 1, then: { type: 'STOP' } };
  }

  if (trimmed.startsWith('RETRY ')) {
    const rest = trimmed.slice(6).trim();
    return parseRetryWithArgs(rest);
  }

  return null;
}

/**
 * Parse RETRY action with arguments (called when input starts with "RETRY ")
 */
function parseRetryWithArgs(rest: string): Action | null {
  let max = 1;
  let remaining = rest;

  // Check if starts with a number
  const numberMatch = /^(\d+)(?:\s+(.*))?$/.exec(remaining);
  if (numberMatch) {
    max = parseInt(numberMatch[1], 10);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    remaining = numberMatch[2] ?? '';
    remaining = remaining.trim();
  }

  // If nothing remaining, default to STOP
  if (!remaining) {
    return { type: 'RETRY', max, then: { type: 'STOP' } };
  }

  // Check for quoted message (implies STOP)
  if (remaining.startsWith('"') && remaining.endsWith('"')) {
    const message = remaining.slice(1, -1);
    return { type: 'RETRY', max, then: { type: 'STOP', message } };
  }

  // Parse the exhaustion action
  const thenAction = parseNonRetryAction(remaining);
  if (!thenAction) {
    return null;
  }

  return { type: 'RETRY', max, then: thenAction };
}

/**
 * Parse a non-RETRY action (CONTINUE, STOP, GOTO, DONE)
 */
function parseNonRetryAction(input: string): NonRetryAction | null {
  const trimmed = input.trim();

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
    const rest = trimmed.slice(5).trim();
    // Handle quoted message
    if (rest.startsWith('"') && rest.endsWith('"')) {
      return { type: 'STOP', message: rest.slice(1, -1) };
    }
    return { type: 'STOP', message: rest };
  }

  if (trimmed.startsWith('GOTO ')) {
    const targetStr = trimmed.slice(5).trim();
    const target = parseStepIdFromString(targetStr);
    if (!target) {
      return null;
    }
    return { type: 'GOTO', target };
  }

  return null;
}

/**
 * Parse conditional line starting with given prefix (PASS or FAIL)
 * Returns action and modifier, or null if parsing fails
 */
function parseConditionalPrefix(rest: string, type: 'pass' | 'fail'): ParsedConditional | null {
  // Check for aggregation modifier (ALL or ANY)
  let modifier: AggregationModifier = null;
  let remaining = rest;

  // Match modifier: space + (ALL|ANY) + (space or colon or arrow or dash)
  const modifierMatch = /^\s+(ALL|ANY)[\s:→-]/.exec(remaining);
  if (modifierMatch) {
    modifier = modifierMatch[1] as 'ALL' | 'ANY';
    remaining = remaining.slice(modifierMatch[0].length);
  }

  const actionStr = stripSeparator(remaining);
  const action = parseAction(actionStr);
  if (!action) {
    return null;
  }
  return { type, action, modifier, raw: actionStr };
}

/**
 * Parse a conditional line (PASS [ALL|ANY]: action or FAIL [ALL|ANY]: action)
 * Supports new syntax with aggregation modifiers
 */
export function parseConditional(text: string): ParsedConditional | null {
  const trimmed = text.trim();

  if (trimmed.startsWith('PASS')) {
    return parseConditionalPrefix(trimmed.slice(4), 'pass');
  }

  if (trimmed.startsWith('FAIL')) {
    return parseConditionalPrefix(trimmed.slice(4), 'fail');
  }

  return null;
}

/**
 * Resolve aggregation mode from modifiers
 * Returns true for PASS ALL + FAIL ANY, false for PASS ANY + FAIL ALL
 * Throws WorkflowSyntaxError for invalid combinations
 */
function resolveAggregationMode(
  passModifier: AggregationModifier,
  failModifier: AggregationModifier
): boolean {
  // Explicit both specified - validate
  if (passModifier && failModifier) {
    if (passModifier === 'ALL' && failModifier === 'ANY') return true;
    if (passModifier === 'ANY' && failModifier === 'ALL') return false;
    throw new WorkflowSyntaxError(
      `Invalid aggregation combination: PASS ${passModifier} + FAIL ${failModifier}. ` +
        `Valid: PASS ALL + FAIL ANY (pessimistic) or PASS ANY + FAIL ALL (optimistic)`
    );
  }

  // One specified - infer the other
  if (passModifier === 'ALL') return true;
  if (passModifier === 'ANY') return false;
  if (failModifier === 'ANY') return true;
  if (failModifier === 'ALL') return false;

  // No modifiers - default to pessimistic
  return true;
}

/**
 * Convert pending conditionals to Transitions object
 * Defaults to all: true (PASS ALL + FAIL ANY, pessimistic)
 */
export function convertToTransitions(conditionals: ParsedConditional[]): Transitions | null {
  if (conditionals.length === 0) {
    return null;
  }

  let passAction: Action | null = null;
  let failAction: Action | null = null;
  let passModifier: AggregationModifier = null;
  let failModifier: AggregationModifier = null;

  for (const conditional of conditionals) {
    if (conditional.type === 'pass') {
      passAction = conditional.action;
      passModifier = conditional.modifier;
    } else {
      failAction = conditional.action;
      failModifier = conditional.modifier;
    }
  }

  // Resolve aggregation mode
  const all = resolveAggregationMode(passModifier, failModifier);

  // If we have both, create Conditions
  if (passAction && failAction) {
    return { all, pass: passAction, fail: failAction };
  }

  if (passAction && !failAction) {
    return { all, pass: passAction, fail: { type: 'STOP' } };
  }

  if (!passAction && failAction) {
    return { all, pass: { type: 'CONTINUE' }, fail: failAction };
  }

  return null;
}

/**
 * Extract workflow file references from substep content.
 * Looks for markdown list items ending in .workflow.md
 */
export function extractWorkflowList(content: string): string[] {
  const workflows: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match " - filename.workflow.md" pattern
    const match = /^\s*-\s+(\S+\.workflow\.md)\s*$/.exec(line);
    if (match) {
      workflows.push(match[1]);
    }
  }

  return workflows;
}