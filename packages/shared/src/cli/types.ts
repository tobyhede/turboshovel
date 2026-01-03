/**
 * Workflow metadata for display
 */
export interface WorkflowMetadata {
  file: string;
  state: string;
  prompted?: boolean;  // Only include if true
}

/**
 * Step position (n/N format)
 */
export interface StepPosition {
  current: number;
  total: number;
}

/**
 * Action block data
 */
export interface ActionBlockData {
  action: string;  // START, CONTINUE, GOTO n, COMPLETE, STOP, RETRY (n/N)
  prev?: StepPosition;
  outcome?: 'PASS' | 'FAIL';
}
