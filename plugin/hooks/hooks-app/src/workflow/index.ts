// src/workflow/index.ts
/**
 * Workflow System - Persistent state tracking for Claude Code workflows.
 *
 * This module provides:
 * - **Types:** `Task`, `TaskNumber`, `TaskState`, `WorkflowState`, `Action`
 * - **Parser:** `parseWorkflow()` - Parse .workflow.md files into Task arrays
 * - **State:** `WorkflowStateManager` - Persist and manage workflow state
 * - **Context:** `getWorkflowContext()` - Generate context for injection
 *
 * @example
 * ```typescript
 * import { parseWorkflow, WorkflowStateManager, getWorkflowContext } from './workflow';
 *
 * // Parse a workflow file
 * const tasks = parseWorkflow(markdownContent);
 *
 * // Create and manage state
 * const manager = new WorkflowStateManager(process.cwd());
 * const state = await manager.create('my-workflow.md', tasks[0].description);
 *
 * // Get context for Claude
 * const context = await getWorkflowContext(process.cwd());
 * ```
 *
 * @module workflow
 */
export * from './types';
export { WorkflowStateManager } from './state';
export { parseWorkflow, WorkflowSyntaxError } from './parser';
export { getWorkflowContext } from './context';
