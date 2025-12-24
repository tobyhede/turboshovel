# Code Review: Workflow Step to Task Rename

## Summary
Review of commits from `d3396036` to `HEAD` focusing on the refactoring of "Step" to "Task" within the workflow system.

**Commits Reviewed:**
- `dfa81cc` fix(workflow): address code review non-blocking suggestions
- `a5543dd` docs(workflow): update CLI output examples from Step to Task
- `c4cae38` refactor(workflow): update remaining test files for Task rename
- `c53b072` refactor(workflow): rename Step to Task in CLI
- `4cb7a19` refactor(workflow): rename Step to Task in context output
- `b7f572a` refactor(workflow): rename step to task in state manager
- `3ebdeed` refactor(workflow): rename Step to Task in parser
- `1b2a4f0` refactor(workflow): rename Step to Task in parser helpers
- `69d7fb2` refactor(workflow): update parser types imports for Task rename

## Assessment

### 1. Consistency
The rename has been applied consistently across:
- **Core Logic:** Parser, State Manager, CLI.
- **Types:** `Step` -> `Task`, `StepNumber` -> `TaskNumber`.
- **Tests:** Test files updated to reflect new terminology.
- **Documentation:** `README.md` and `CLAUDE.md` updated.

The mechanical application of the rename is high quality and thorough.

### 2. Naming Ambiguity (Potential Issue)
The rename creates a semantic collision between:
1.  **Workflow Task**: A stage in the workflow (formerly "Step").
2.  **Tool Task**: A specific unit of work executed by the agent (the `Task` tool).

**Evidence:**
In `plugin/hooks/README.md`:
> "Tasks represent parallel work items within a workflow task"

In `src/workflow/types.ts`:
```typescript
export interface WorkflowState {
  readonly task: TaskNumber;      // Current workflow stage (1, 2...)
  readonly tasks: readonly TaskState[]; // List of executed tool actions
}
```

This overloading (`state.task` vs `state.tasks`) is potentially confusing for developers and could lead to state management bugs.

### 3. Documentation
The documentation updates are accurate to the code changes, but the sentence "Tasks represent parallel work items within a workflow task" highlights the terminological friction.

## Recommendations

### BLOCKING
*None.* The changes are functional and consistent.

### NON-BLOCKING
1.  **Disambiguate "Task" in State:**
    Consider renaming the tool execution tracking to "Subtask" or "Action" to distinguish it from the workflow stage.
    - Rename `TaskState` (tool tracking) to `SubtaskState` or `ToolExecutionState`.
    - Rename `WorkflowState.tasks` to `WorkflowState.subtasks` or `WorkflowState.history`.

2.  **Clarify Documentation:**
    If the terminology remains, add an explicit note in the architecture documentation distinguishing "Workflow Tasks" (stages) from "Agent Tasks" (tool usage).

## Conclusion
The refactoring is successful and ready to merge, provided the team accepts the terminological overloading of "Task". The risk is primarily cognitive load for maintainers rather than runtime stability.
