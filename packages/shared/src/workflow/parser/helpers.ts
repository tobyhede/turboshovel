// src/workflow/parser/helpers.ts

import { createTaskNumber, type Action, type Conditions, type TaskNumber } from '../types.js';
import type { ParsedConditional, AggregationModifier } from './types.js';
import { WorkflowSyntaxError } from './types.js';

export interface ParsedSubtaskHeader {
  taskNumber: number;
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

/**
 * Extract task number and description from header text
 * Returns null if not a valid task header
 */
export function extractTaskHeader(
  text: string
): { number: TaskNumber; description: string } | null {
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
  const taskNumber = createTaskNumber(number);
  if (!taskNumber) {
    return null; // Invalid task number (zero or negative)
  }

  // Strip separator and extract description
  const description = stripSeparator(trimmed.slice(numEnd));

  // Keep the guard unchanged - still rejects "Step ..." to discourage old terminology
  // Descriptions like "Task setup" are legitimate, so don't reject "Task ..."
  if (description.startsWith('Step ') || description === 'Step') {
    return null;
  }

  if (!description) {
    return null;
  }

  return { number: taskNumber, description };
}

/**
 * Extract subtask header from H3 text
 * Patterns:
 *   "1.1 First reviewer (code-agent)" -> { taskNumber: 1, id: "1", ... }
 *   "3.{n} Execute task" -> { taskNumber: 3, id: "{n}", isDynamic: true }
 */
export function extractSubtaskHeader(text: string): ParsedSubtaskHeader | null {
  const trimmed = text.trim();

  // Match: "N.M description" or "N.{n} description" with optional (agent-type)
  // Subtasks are now numeric (e.g., 1.1, 1.2) not alphabetic (1.A, 1.B)
  const match = trimmed.match(/^(\d+)\.(\{n\}|\d+)\s+(.+?)(?:\s+\(([^)]+)\))?$/);
  if (!match) return null;

  const [, taskStr, subtaskId, desc, agent] = match;
  const taskNumber = parseInt(taskStr, 10);
  if (taskNumber <= 0) return null;

  const isDynamic = subtaskId === '{n}';
  const id = subtaskId; // Keep as-is: "{n}" or numeric string

  return {
    taskNumber,
    id,
    description: desc.trim(),
    agentType: agent?.trim(),
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
    const taskStr = trimmed.slice(5).trim();
    const taskNum = parseInt(taskStr, 10);
    const task = createTaskNumber(taskNum);
    if (!task) {
      return null;
    }
    return { type: 'GOTO', task };
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

  if (trimmed.startsWith('STOP (') && trimmed.endsWith(')')) {
    const message = trimmed.slice(6, -1);
    return { type: 'STOP', message };
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
  const modifierMatch = remaining.match(/^\s+(ALL|ANY)[\s:→\-]/);
  if (modifierMatch) {
    modifier = modifierMatch[1] as 'ALL' | 'ANY';
    remaining = remaining.slice(modifierMatch[0].length);
  }

  const actionStr = stripSeparator(remaining);
  const action = parseAction(actionStr);
  if (!action) {
    return null;
  }
  return { type, action, modifier };
}

/**
 * Parse a conditional line (PASS [ALL|ANY]: action or FAIL [ALL|ANY]: action)
 * Supports new syntax with aggregation modifiers and backward compatibility
 */
export function parseConditional(text: string): ParsedConditional | null {
  const trimmed = text.trim();

  // Try ALLCAPS first (new syntax)
  if (trimmed.startsWith('PASS')) {
    return parseConditionalPrefix(trimmed.slice(4), 'pass');
  }

  if (trimmed.startsWith('FAIL')) {
    return parseConditionalPrefix(trimmed.slice(4), 'fail');
  }

  // Backward compatibility: old syntax (Pass: / Fail:)
  if (trimmed.startsWith('Pass:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'pass', action, modifier: null };
  }

  if (trimmed.startsWith('Fail:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'fail', action, modifier: null };
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
 * Convert pending conditionals to Conditions object
 * Defaults to all: true (PASS ALL + FAIL ANY, pessimistic)
 */
export function convertConditionals(conditionals: ParsedConditional[]): Conditions | null {
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
