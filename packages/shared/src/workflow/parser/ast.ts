import { type Node, type Parent } from 'unist';
import { type StepNumber, type Conditions } from '../types.js';

export interface WorkflowStepNode extends Parent {
  type: 'workflowStep';
  number: StepNumber;
  description: string;
  command?: string;
  prompts: string[];
  conditions?: Conditions;
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
