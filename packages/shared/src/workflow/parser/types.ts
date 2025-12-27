// src/workflow/parser/types.ts

import type { Action, Task, Conditions, Prompt, Command, TaskNumber } from '../types.js';

export class WorkflowSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowSyntaxError';
  }
}

/**
 * Aggregation modifier for conditions
 */
export type AggregationModifier = 'ALL' | 'ANY' | null;

/**
 * Parsed conditional line
 */
export interface ParsedConditional {
  type: 'pass' | 'fail';
  action: Action;
  modifier: AggregationModifier;
}

// Note: With mdast-util-from-markdown, we use local variables in parseWorkflow()
// instead of a full ParserState object. The AST walking approach is simpler
// than event-based state machines.
