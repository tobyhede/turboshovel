# Subagent-Task Mapping Research

> Research conducted 2025-12-22

---

## Problem Statement

When a workflow dispatches subagents for tasks, we need to:
1. **At dispatch**: Know which workflow task the subagent corresponds to
2. **At completion**: Correlate the returning `agent_id` back to the workflow task
3. **Support parallel execution**: Multiple subagents running simultaneously

---

## Current Implementation Analysis

### What Exists (`src/workflow/hooks/`)

**task-tracker.ts:**
```typescript
// Creates random task IDs
const task: TaskState = {
  id: generateTaskId(),  // "task-abc123-xyz"
  status: 'running',
  startedAt: new Date().toISOString(),
};
```

**subagent-stop.ts:**
```typescript
// Uses FIFO matching
const runningTaskIndex = state.tasks.findIndex(t => t.status === 'running');
// Assumes first running task = completed subagent
```

### Problems with Current Approach

1. **No TaskId parsing**: Task IDs are random, not derived from workflow structure
2. **No agent_id tracking**: Doesn't capture `agent_id` from SubagentStop (v2.0.42+)
3. **FIFO breaks parallel**: If tasks 3.A and 3.B are dispatched, and 3.B finishes first, it incorrectly marks 3.A as done
4. **No tool_use_id**: Doesn't capture correlation key from PostToolUse (v2.0.43+)

---

## Available Data Points

### PostToolUse (Task dispatch)
```typescript
{
  hook_event_name: "PostToolUse",
  tool_name: "Task",
  tool_input: {
    description: "3.A - Cross-check reviews",  // TaskId here!
    prompt: "...",
    subagent_type: "cipherpowers:code-review-agent"
  },
  tool_use_id: "toolu_01ABC123..."  // Correlation key (v2.0.43+)
}
```

### SubagentStop (Task completion)
```typescript
{
  hook_event_name: "SubagentStop",
  agent_id: "unique-agent-id",           // Unique per agent (v2.0.42+)
  agent_transcript_path: "/path/to/agent/transcript.jsonl",
  output: "WORKFLOW: DONE..."
}
```

---

## Correlation Strategies

### Strategy 1: Direct tool_use_id ↔ agent_id Correlation

**Hypothesis:** Claude Code may use `tool_use_id` as the `agent_id`

**Implementation:**
```typescript
// PostToolUse
pendingDispatches.set(input.tool_use_id, {
  taskId: parseTaskId(input.tool_input.description),
  dispatchedAt: Date.now()
});

// SubagentStop
const pending = pendingDispatches.get(input.agent_id);
if (pending) {
  // Direct match!
  markTaskComplete(pending.taskId);
}
```

**Pros:**
- Simple and reliable
- Zero parsing overhead

**Cons:**
- Requires empirical testing to confirm correlation
- May not work if IDs differ

**Status:** NEEDS TESTING

---

### Strategy 2: Description-Based TaskId Extraction

**Approach:** Parse TaskId from `tool_input.description`

**Implementation:**
```typescript
// Convention: "3.A - Description" or "3 - Description"
function parseTaskId(description: string): TaskId | null {
  // Match "3.A" or "3" at start
  const match = description.match(/^(\d+)(?:\.([A-Z0-9]+))?\s*[-:]/);
  if (!match) return null;

  return {
    task: parseInt(match[1]),
    subtask: match[2] || undefined
  };
}

// Example:
// "3.A - Cross-check reviews" → { task: 3, subtask: 'A' }
// "3 - Run verification" → { task: 3 }
```

**Pros:**
- Works regardless of ID correlation
- TaskId in description is human-readable

**Cons:**
- Requires strict naming convention
- Can fail if description format varies

**Status:** VIABLE (requires convention enforcement)

---

### Strategy 3: Ordered Queue with Subagent Type

**Approach:** FIFO within same `subagent_type`

**Implementation:**
```typescript
// PostToolUse
const queue = dispatchQueues.get(input.tool_input.subagent_type) || [];
queue.push({
  taskId: parseTaskId(input.tool_input.description),
  toolUseId: input.tool_use_id,
  dispatchedAt: Date.now()
});
dispatchQueues.set(input.tool_input.subagent_type, queue);

// SubagentStop - parse subagent_type from transcript
const queue = dispatchQueues.get(subagentType);
const oldest = queue.shift();  // FIFO
markTaskComplete(oldest.taskId);
```

**Pros:**
- Works for different agent types in parallel
- Simple queue logic

**Cons:**
- Breaks if same-type agents complete out of order
- SubagentStop doesn't include `subagent_type` directly

**Status:** PARTIAL (only works for heterogeneous parallel tasks)

---

### Strategy 4: Transcript Path Parsing

**Approach:** Parse `agent_transcript_path` to find TaskId in agent's conversation

**Implementation:**
```typescript
// SubagentStop
const transcript = await fs.readFile(input.agent_transcript_path, 'utf-8');
const lines = transcript.split('\n').slice(0, 10); // First 10 messages
for (const line of lines) {
  const msg = JSON.parse(line);
  if (msg.role === 'user') {
    const taskId = parseTaskIdFromPrompt(msg.content);
    if (taskId) return taskId;
  }
}
```

**Pros:**
- Definitive - TaskId is in the agent's instructions
- Works regardless of completion order

**Cons:**
- File I/O overhead
- Transcript format may vary
- Parsing complexity

**Status:** VIABLE (as fallback)

---

### Strategy 5: Hybrid Approach (Recommended)

**Multi-layer correlation with fallbacks:**

```typescript
interface PendingDispatch {
  toolUseId: string;
  taskId: TaskId;
  description: string;
  subagentType: string;
  dispatchedAt: number;
  agentId?: string;  // Filled at completion
}

// Storage: Map by toolUseId and secondary index by description
const pendingByToolUseId = new Map<string, PendingDispatch>();
const pendingByDescription = new Map<string, PendingDispatch>();

// PostToolUse (Task)
function trackDispatch(input: PostToolUseInput) {
  const taskId = parseTaskId(input.tool_input.description);
  if (!taskId) return; // No TaskId in description

  const pending: PendingDispatch = {
    toolUseId: input.tool_use_id,
    taskId,
    description: input.tool_input.description,
    subagentType: input.tool_input.subagent_type,
    dispatchedAt: Date.now()
  };

  pendingByToolUseId.set(input.tool_use_id, pending);
  pendingByDescription.set(input.tool_input.description, pending);
}

// SubagentStop
function correlateAgent(input: SubagentStopInput): TaskId | null {
  // Layer 1: Direct tool_use_id match
  const byId = pendingByToolUseId.get(input.agent_id);
  if (byId) {
    byId.agentId = input.agent_id;
    return byId.taskId;
  }

  // Layer 2: Parse transcript for TaskId hint
  const taskId = parseTranscriptForTaskId(input.agent_transcript_path);
  if (taskId) {
    const byDesc = pendingByDescription.get(`${taskId.task}.${taskId.subtask}`);
    if (byDesc) {
      byDesc.agentId = input.agent_id;
      return byDesc.taskId;
    }
  }

  // Layer 3: FIFO fallback (last resort)
  const oldest = Array.from(pendingByToolUseId.values())
    .filter(p => !p.agentId)
    .sort((a, b) => a.dispatchedAt - b.dispatchedAt)[0];
  if (oldest) {
    oldest.agentId = input.agent_id;
    return oldest.taskId;
  }

  return null;
}
```

---

## Workflow Models

### Model A: Sequential Tasks with Optional Subagents

```
Main Workflow:
  Step 1: Setup
  Step 2: Dispatch Subagent → Subagent runs own workflow → DONE
  Step 3: Cleanup
```

**Flow:**
1. Main workflow reaches Step 2
2. Claude dispatches Task tool → PostToolUse fires
3. Store: `{ taskId: 2, toolUseId: "tu-1", status: "dispatched" }`
4. Subagent runs its workflow → outputs "WORKFLOW: DONE"
5. SubagentStop fires with `agent_id`
6. Correlate → mark Step 2 complete
7. Main workflow advances to Step 3

**Correlation:** Simple - only one pending dispatch at a time

---

### Model B: Parallel Subtasks

```
Main Workflow:
  Step 1: Setup
  Step 2: Parallel verification
    Step 2.A: Cross-check → Subagent A
    Step 2.B: Revise → Subagent B
  Step 3: Finalize

# Aggregation
PASS (ALL): CONTINUE
FAIL (ANY): STOP
```

**Flow:**
1. Main workflow reaches Step 2, sees subtasks
2. Claude dispatches Task(description: "2.A - Cross-check")
   → PostToolUse: store `{ taskId: {task:2,subtask:'A'}, toolUseId: "tu-1" }`
3. Claude dispatches Task(description: "2.B - Revise")
   → PostToolUse: store `{ taskId: {task:2,subtask:'B'}, toolUseId: "tu-2" }`
4. Subagent B finishes first → SubagentStop(agent_id: "abc")
   → Correlate "abc" → task 2.B → mark complete
5. Subagent A finishes → SubagentStop(agent_id: "xyz")
   → Correlate "xyz" → task 2.A → mark complete
6. All subtasks done → evaluate aggregation rule
7. PASS (ALL): both passed → workflow next --pass

**Correlation:** Critical - must not mix up 2.A and 2.B

---

### Model C: Nested Subagent Workflows

```
Main Workflow:
  Step 2: Dispatch subagent
    ↓
    Subagent Workflow:
      Step 1: Analyze
      Step 2: Fix
      Step 3: Verify
    ↓
  WORKFLOW: DONE
```

**Key Insight:** Subagent has its OWN workflow state file

**At dispatch:**
```typescript
// Main workflow creates context for subagent
// Option A: Embed workflow file reference in prompt
prompt: `WORKFLOW: task-2-workflow.md\n\n${taskPrompt}`

// Option B: Create workflow state for subagent
const subWorkflowState = {
  id: `${parentWorkflowId}-task-2`,
  workflow: 'task-2-workflow.md',
  parentTask: { task: 2 }
};
```

**At SubagentStop:**
```typescript
// Read subagent's workflow state
const subState = await loadWorkflowState(input.agent_id);
// or parse from transcript
const subState = await parseTranscriptForWorkflowState(input.agent_transcript_path);

// Get status
if (subState.status === 'done') {
  markParentTaskComplete(subState.parentTask);
}
```

---

## Recommended Implementation

### Phase 1: Update HookInput Types

```typescript
// types.ts additions
export interface HookInput {
  // ... existing fields ...

  // PostToolUse (v2.0.43+)
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  tool_use_id?: string;

  // SubagentStop (v2.0.42+)
  agent_id?: string;
  agent_transcript_path?: string;
}
```

### Phase 2: TaskId Type

```typescript
// workflow/types.ts
export interface TaskId {
  readonly task: number | string;
  readonly subtask?: number | string;
}

export function formatTaskId(id: TaskId): string {
  return id.subtask !== undefined
    ? `${id.task}.${id.subtask}`
    : `${id.task}`;
}

export function parseTaskId(description: string): TaskId | null {
  const match = description.match(/^(\d+)(?:\.([A-Z0-9]+))?\s*[-:]/i);
  if (!match) return null;
  return {
    task: parseInt(match[1]),
    subtask: match[2]?.toUpperCase()
  };
}
```

### Phase 3: Dispatch Tracking

```typescript
// workflow/agent-mapping.ts
export interface PendingDispatch {
  readonly toolUseId: string;
  readonly taskId: TaskId;
  readonly description: string;
  readonly subagentType: string;
  readonly dispatchedAt: string;
  agentId?: string;
  status: 'dispatched' | 'completed' | 'failed';
}

export class AgentMapper {
  private dispatches: Map<string, PendingDispatch> = new Map();

  async recordDispatch(input: HookInput): Promise<void> {
    const taskId = parseTaskId(input.tool_input?.description as string);
    if (!taskId) return;

    const dispatch: PendingDispatch = {
      toolUseId: input.tool_use_id!,
      taskId,
      description: input.tool_input?.description as string,
      subagentType: input.tool_input?.subagent_type as string,
      dispatchedAt: new Date().toISOString(),
      status: 'dispatched'
    };

    this.dispatches.set(dispatch.toolUseId, dispatch);
    await this.persist();
  }

  async correlate(input: HookInput): Promise<TaskId | null> {
    // Try direct match first
    const direct = this.dispatches.get(input.agent_id!);
    if (direct) {
      direct.agentId = input.agent_id;
      direct.status = 'completed';
      await this.persist();
      return direct.taskId;
    }

    // Try transcript parsing...
    // Try FIFO fallback...

    return null;
  }
}
```

### Phase 4: Updated Workflow Commands

```bash
workflow next --pass --task 2.A    # Mark specific subtask complete
workflow next --fail --task 2.B    # Mark specific subtask failed
workflow status                     # Show all pending/running/complete
```

---

## Testing Checklist

- [ ] Confirm `tool_use_id` ↔ `agent_id` correlation (or lack thereof)
- [ ] Verify SubagentStart hook payload (if useful for early binding)
- [ ] Test parallel dispatch/completion ordering
- [ ] Test description parsing with various formats
- [ ] Test transcript parsing fallback
- [ ] Test FIFO fallback edge cases

---

## Open Questions

1. **Does SubagentStart include agent_id?**
   If yes, we can bind agent_id at dispatch time, not completion time.

2. **Is tool_use_id stable across retries?**
   If a Task fails and Claude retries, does it get a new tool_use_id?

3. **Can we inject TaskId into subagent prompt programmatically?**
   The main agent constructs the prompt - can we require a TASK_ID prefix?

---

## Summary

**Recommended approach:** Hybrid correlation with description-based TaskId as primary, transcript parsing as secondary, FIFO as fallback.

**Key changes needed:**
1. Update HookInput types for new Claude Code fields
2. Add TaskId type and parsing
3. Implement AgentMapper for dispatch tracking
4. Update SubagentStop handler to use correlation

**Next step:** Empirical testing of `tool_use_id` ↔ `agent_id` correlation.
