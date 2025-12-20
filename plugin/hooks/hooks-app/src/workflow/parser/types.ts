// src/workflow/parser/types.ts

import type { Action, Step, Conditions, Prompt, Command, StepNumber } from '../types';

export interface ParsedConditional {
  type: 'pass' | 'fail';
  action: Action;
}

// Note: With mdast-util-from-markdown, we use local variables in parseWorkflow()
// instead of a full ParserState object. The AST walking approach is simpler
// than event-based state machines.

export class WorkflowSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowSyntaxError';
  }
}
