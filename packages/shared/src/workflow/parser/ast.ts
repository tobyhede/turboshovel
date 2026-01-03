import { type Node, type Parent } from 'unist';
import { type StepNumber, type Transitions } from '../types.js';

export interface WorkflowStepNode extends Parent {
  type: 'workflowStep';
  number: StepNumber;
  description: string;
  command?: string;
  prompts: string[];
  transitions?: Transitions;
  substeps?: WorkflowSubstepNode[];
  nestedWorkflow?: string;
}

export interface WorkflowSubstepNode extends Node {
  type: 'workflowSubstep';
  id: string;
  description: string;
  agentType?: string;
  isDynamic: boolean;
  workflows?: string[];
}
