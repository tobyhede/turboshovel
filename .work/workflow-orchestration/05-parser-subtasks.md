# Workflow Orchestration: Parser Subtasks & Aggregation

> **For Claude:** Use cipherpowers:executing-plans (or execute tasks manually if preferred) to implement this plan task-by-task.

**Goal:** Add parser support for subtasks (### N.A) and aggregation modifiers (PASS ALL, FAIL ANY).

**Architecture:** Extend parser to handle H3 headings as subtasks. Update Conditions type to discriminated union with `all` field.

**Tech Stack:** TypeScript, mdast parsing

**Prerequisite:** Complete 04-hook-handlers.md first

---

## Task 1: Add Subtask Type to types.ts

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/types.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/types.test.ts`

**Step 1: Write failing test for Subtask type**

Add to `__tests__/workflow/types.test.ts`. Note: `createTaskNumber` is already imported in this file (line 2). Add `Subtask` and `Task` to the imports:

```typescript
// Update imports at top of file:
import { createTaskNumber, type TaskNumber, type Action, type Subtask, type Task } from '../../src/workflow/types';

describe('Subtask type', () => {
  it('accepts static subtask', () => {
    const subtask: Subtask = {
      id: 'A',
      description: 'First reviewer',
      isDynamic: false,
    };
    expect(subtask.isDynamic).toBe(false);
  });

  it('accepts subtask with agent type', () => {
    const subtask: Subtask = {
      id: 'B',
      description: 'Second reviewer',
      agentType: 'code-review-agent',
      isDynamic: false,
    };
    expect(subtask.agentType).toBe('code-review-agent');
  });

  it('accepts dynamic subtask template', () => {
    const subtask: Subtask = {
      id: '{n}',
      description: 'Execute task',
      isDynamic: true,
    };
    expect(subtask.isDynamic).toBe(true);
  });
});

describe('Task with subtasks', () => {
  it('accepts task with subtasks array', () => {
    const task: Task = {
      number: createTaskNumber(1)!,
      description: 'Dispatch reviewers',
      prompts: [],
      subtasks: [
        { id: 'A', description: 'First', isDynamic: false },
        { id: 'B', description: 'Second', isDynamic: false },
      ],
    };
    expect(task.subtasks).toHaveLength(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" --no-coverage`
Expected: FAIL - Subtask not exported

**Step 3: Add Subtask type and update Task**

Add to `types.ts`:

```typescript
/**
 * A subtask within a task (H3 header)
 */
export interface Subtask {
  readonly id: string;  // A, B, C or {n} for dynamic
  readonly description: string;
  readonly agentType?: string;  // e.g., "code-review-agent" from "(code-review-agent)"
  readonly isDynamic: boolean;  // true for ### N.{n}, false for ### N.A
}
```

Update Task interface:

```typescript
/**
 * A single task in a workflow
 */
export interface Task {
  readonly number: TaskNumber;
  readonly description: string;
  readonly command?: Command;
  readonly prompts: readonly Prompt[];
  readonly conditions?: Conditions;
  readonly subtasks?: readonly Subtask[];  // NEW
  readonly nestedWorkflow?: string;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/types.ts __tests__/workflow/types.test.ts && git commit -m "feat(types): add Subtask type and Task.subtasks field"
```

---

## Task 2: Update Conditions to Discriminated Union

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/types.ts:30-36`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/types.test.ts`

**Step 1: Write failing tests for discriminated Conditions**

Add to `__tests__/workflow/types.test.ts`:

```typescript
describe('Conditions discriminated union', () => {
  it('accepts PASS ALL + FAIL ANY (all: true)', () => {
    const conditions: Conditions = {
      all: true,
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP' },
    };
    expect(conditions.all).toBe(true);
  });

  it('accepts PASS ANY + FAIL ALL (all: false)', () => {
    const conditions: Conditions = {
      all: false,
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP', message: 'All failed' },
    };
    expect(conditions.all).toBe(false);
  });

  it('works with exhaustive switch', () => {
    const conditions: Conditions = { all: true, pass: { type: 'CONTINUE' }, fail: { type: 'STOP' } };

    // TypeScript exhaustiveness check
    function checkAll(c: Conditions): string {
      switch (c.all) {
        case true: return 'pessimistic';
        case false: return 'optimistic';
      }
    }

    expect(checkAll(conditions)).toBe('pessimistic');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" --no-coverage`
Expected: FAIL - Conditions doesn't have `all` field

**Step 3: Update Conditions to discriminated union**

Replace Conditions in `types.ts`:

```typescript
/**
 * Aggregation conditions for subtasks
 *
 * Valid combinations only:
 * - all: true  = PASS ALL + FAIL ANY (pessimistic, default)
 * - all: false = PASS ANY + FAIL ALL (optimistic)
 */
interface PassAllConditions {
  readonly all: true;
  readonly pass: Action;  // triggers when ALL complete
  readonly fail: Action;  // triggers when ANY blocked
}

interface PassAnyConditions {
  readonly all: false;
  readonly pass: Action;  // triggers when ANY complete
  readonly fail: Action;  // triggers when ALL blocked
}

export type Conditions = PassAllConditions | PassAnyConditions;
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/types.ts __tests__/workflow/types.test.ts && git commit -m "feat(types): update Conditions to discriminated union with all field"
```

---

## Task 3: Add AggregationModifier to Parser Types

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/types.ts`
- Create: (no test needed - type-only change)

**Step 1: Update parser types**

Update `src/workflow/parser/types.ts`:

```typescript
// src/workflow/parser/types.ts

import type { Action } from '../types';

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
  modifier: AggregationModifier;  // NEW
}
```

**Step 2: Verify types are syntactically valid**

Run: `cd plugin/hooks/hooks-app && npx tsc --noEmit src/workflow/parser/types.ts`
Expected: No syntax errors in the types file itself.

> **Note:** The full build (`npm run build`) will fail at this point because existing callers of `ParsedConditional` don't provide the new `modifier` field. This is expected TDD behavior—Task 4 updates `parseConditional()` to provide the field, which will fix the build.

**Step 3: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/parser/types.ts && git commit -m "feat(parser): add AggregationModifier to ParsedConditional"
```

---

## Task 4: Update parseConditional for Aggregation Modifiers

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/helpers.ts:117-161`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts`

**Step 1: Write failing tests**

Add to `__tests__/workflow/parser/helpers.test.ts`. Ensure `parseConditional` is imported at the top of the file:

```typescript
// Verify import exists at top of file:
import { parseConditional } from '../../../src/workflow/parser/helpers';
```

Then add the tests:

```typescript
describe('parseConditional with aggregation', () => {
  it('parses PASS ALL: CONTINUE', () => {
    const result = parseConditional('PASS ALL: CONTINUE');
    expect(result).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
      modifier: 'ALL',
    });
  });

  it('parses FAIL ANY: STOP', () => {
    const result = parseConditional('FAIL ANY: STOP');
    expect(result).toEqual({
      type: 'fail',
      action: { type: 'STOP' },
      modifier: 'ANY',
    });
  });

  it('parses PASS: CONTINUE (no modifier)', () => {
    const result = parseConditional('PASS: CONTINUE');
    expect(result).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
      modifier: null,
    });
  });

  it('parses with arrow syntax: PASS ANY → CONTINUE', () => {
    const result = parseConditional('PASS ANY → CONTINUE');
    expect(result).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
      modifier: 'ANY',
    });
  });

  it('parses FAIL ALL → STOP "message"', () => {
    const result = parseConditional('FAIL ALL → STOP All approaches failed');
    expect(result).toEqual({
      type: 'fail',
      action: { type: 'STOP', message: 'All approaches failed' },
      modifier: 'ALL',
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/helpers" --no-coverage`
Expected: FAIL - modifier not in result

**Step 3: Update parseConditional**

Update `helpers.ts`:

```typescript
/**
 * Parse a conditional line with optional aggregation modifier
 * Examples:
 *   "PASS: CONTINUE" -> { type: 'pass', action: CONTINUE, modifier: null }
 *   "PASS ALL: CONTINUE" -> { type: 'pass', action: CONTINUE, modifier: 'ALL' }
 *   "FAIL ANY → STOP" -> { type: 'fail', action: STOP, modifier: 'ANY' }
 */
export function parseConditional(text: string): ParsedConditional | null {
  const trimmed = text.trim();

  // Match PASS [ALL|ANY] separator ACTION
  const passMatch = trimmed.match(/^PASS(?:\s+(ALL|ANY))?\s*[:→\-]\s*(.+)$/);
  if (passMatch) {
    const [, modifier, actionStr] = passMatch;
    const action = parseAction(actionStr);
    if (!action) return null;
    return {
      type: 'pass',
      action,
      modifier: (modifier as AggregationModifier) || null,
    };
  }

  // Match FAIL [ALL|ANY] separator ACTION
  const failMatch = trimmed.match(/^FAIL(?:\s+(ALL|ANY))?\s*[:→\-]\s*(.+)$/);
  if (failMatch) {
    const [, modifier, actionStr] = failMatch;
    const action = parseAction(actionStr);
    if (!action) return null;
    return {
      type: 'fail',
      action,
      modifier: (modifier as AggregationModifier) || null,
    };
  }

  // Backward compatibility: old syntax (Pass: / Fail:)
  if (trimmed.startsWith('Pass:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) return null;
    return { type: 'pass', action, modifier: null };
  }

  if (trimmed.startsWith('Fail:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) return null;
    return { type: 'fail', action, modifier: null };
  }

  return null;
}
```

Add import at top:

```typescript
import type { AggregationModifier } from './types';
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/helpers" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/parser/helpers.ts __tests__/workflow/parser/helpers.test.ts && git commit -m "feat(parser): add aggregation modifier parsing to parseConditional"
```

---

## Task 5: Update convertConditionals for Aggregation

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/helpers.ts:166-196`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts`

**Step 1: Write failing tests**

Add to `__tests__/workflow/parser/helpers.test.ts`:

```typescript
describe('convertConditionals with aggregation', () => {
  it('returns all: true for PASS ALL', () => {
    const result = convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: 'ALL' },
      { type: 'fail', action: { type: 'STOP' }, modifier: null },
    ]);
    expect(result?.all).toBe(true);
  });

  it('returns all: false for PASS ANY', () => {
    const result = convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: 'ANY' },
      { type: 'fail', action: { type: 'STOP' }, modifier: null },
    ]);
    expect(result?.all).toBe(false);
  });

  it('infers all: true from FAIL ANY', () => {
    const result = convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: null },
      { type: 'fail', action: { type: 'STOP' }, modifier: 'ANY' },
    ]);
    expect(result?.all).toBe(true);
  });

  it('infers all: false from FAIL ALL', () => {
    const result = convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: null },
      { type: 'fail', action: { type: 'STOP' }, modifier: 'ALL' },
    ]);
    expect(result?.all).toBe(false);
  });

  it('defaults to all: true (pessimistic)', () => {
    const result = convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: null },
      { type: 'fail', action: { type: 'STOP' }, modifier: null },
    ]);
    expect(result?.all).toBe(true);
  });

  it('throws for invalid combination PASS ALL + FAIL ALL', () => {
    expect(() =>
      convertConditionals([
        { type: 'pass', action: { type: 'CONTINUE' }, modifier: 'ALL' },
        { type: 'fail', action: { type: 'STOP' }, modifier: 'ALL' },
      ])
    ).toThrow('Invalid aggregation');
  });

  it('throws for invalid combination PASS ANY + FAIL ANY', () => {
    expect(() =>
      convertConditionals([
        { type: 'pass', action: { type: 'CONTINUE' }, modifier: 'ANY' },
        { type: 'fail', action: { type: 'STOP' }, modifier: 'ANY' },
      ])
    ).toThrow('Invalid aggregation');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/helpers" --no-coverage`
Expected: FAIL - all field not present

**Step 3: Update convertConditionals**

```typescript
import { WorkflowSyntaxError, type AggregationModifier, type ParsedConditional } from './types';
import type { Action, Conditions } from '../types';

/**
 * Convert parsed conditionals to Conditions object with aggregation
 *
 * Validation rules:
 * - PASS ALL + FAIL ANY = valid (pessimistic)
 * - PASS ANY + FAIL ALL = valid (optimistic)
 * - PASS ALL + FAIL ALL = INVALID
 * - PASS ANY + FAIL ANY = INVALID
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

  // Defaults
  if (passAction && !failAction) {
    failAction = { type: 'STOP' };
  }
  if (!passAction && failAction) {
    passAction = { type: 'CONTINUE' };
  }
  if (!passAction || !failAction) {
    return null;
  }

  // Determine aggregation mode
  const all = resolveAggregationMode(passModifier, failModifier);

  return {
    all,
    pass: passAction,
    fail: failAction,
  };
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
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/helpers" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/parser/helpers.ts __tests__/workflow/parser/helpers.test.ts && git commit -m "feat(parser): update convertConditionals with aggregation validation"
```

---

## Task 6: Add extractSubtaskHeader Helper

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/helpers.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts`

**Step 1: Write failing tests**

Add to `__tests__/workflow/parser/helpers.test.ts`:

```typescript
import { extractSubtaskHeader } from '../../../src/workflow/parser/helpers';

describe('extractSubtaskHeader', () => {
  it('parses static subtask: 1.A First reviewer', () => {
    const result = extractSubtaskHeader('1.A First reviewer');
    expect(result).toEqual({
      taskNumber: 1,
      id: 'A',
      description: 'First reviewer',
      agentType: undefined,
      isDynamic: false,
    });
  });

  it('parses subtask with agent type: 2.B Second (code-agent)', () => {
    const result = extractSubtaskHeader('2.B Second reviewer (code-agent)');
    expect(result).toEqual({
      taskNumber: 2,
      id: 'B',
      description: 'Second reviewer',
      agentType: 'code-agent',
      isDynamic: false,
    });
  });

  it('parses dynamic subtask: 3.{n} Execute task', () => {
    const result = extractSubtaskHeader('3.{n} Execute task');
    expect(result).toEqual({
      taskNumber: 3,
      id: '{n}',
      description: 'Execute task',
      agentType: undefined,
      isDynamic: true,
    });
  });

  it('normalizes lowercase id to uppercase', () => {
    const result = extractSubtaskHeader('1.a First');
    expect(result?.id).toBe('A');
  });

  it('returns null for invalid format', () => {
    expect(extractSubtaskHeader('Not a subtask')).toBeNull();
    expect(extractSubtaskHeader('1 Missing dot')).toBeNull();
    expect(extractSubtaskHeader('.A No number')).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/helpers" --no-coverage`
Expected: FAIL - extractSubtaskHeader not defined

**Step 3: Implement extractSubtaskHeader**

Add to `helpers.ts`:

```typescript
export interface ParsedSubtaskHeader {
  taskNumber: number;
  id: string;  // A, B, or {n}
  description: string;
  agentType?: string;
  isDynamic: boolean;
}

/**
 * Extract subtask header from H3 text
 * Patterns:
 *   "1.A First reviewer (code-agent)" -> { taskNumber: 1, id: "A", ... }
 *   "3.{n} Execute task" -> { taskNumber: 3, id: "{n}", isDynamic: true }
 */
export function extractSubtaskHeader(text: string): ParsedSubtaskHeader | null {
  const trimmed = text.trim();

  // Match: "N.A description" or "N.{n} description" with optional (agent-type)
  const match = trimmed.match(/^(\d+)\.(\{n\}|[A-Za-z])\s+(.+?)(?:\s+\(([^)]+)\))?$/);
  if (!match) return null;

  const [, taskStr, subtaskId, desc, agent] = match;
  const taskNumber = parseInt(taskStr, 10);
  if (taskNumber <= 0) return null;

  const isDynamic = subtaskId === '{n}';
  const id = isDynamic ? '{n}' : subtaskId.toUpperCase();

  return {
    taskNumber,
    id,
    description: desc.trim(),
    agentType: agent?.trim(),
    isDynamic,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/helpers" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/parser/helpers.ts __tests__/workflow/parser/helpers.test.ts && git commit -m "feat(parser): add extractSubtaskHeader for H3 parsing"
```

---

## Task 7: Update Parser for H3 Subtasks

**Files:**
- Modify: `plugin/hooks/hooks-app/src/workflow/parser/parser.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/parser/parser.test.ts`

**Step 1: Write failing tests**

Add to `__tests__/workflow/parser/parser.test.ts`:

```typescript
describe('parseWorkflow with subtasks', () => {
  it('parses static subtasks', () => {
    const markdown = `
## 1. Dispatch reviewers

### 1.A First reviewer (code-review-agent)
### 1.B Second reviewer (code-agent)

PASS ALL: CONTINUE
FAIL ANY: STOP
`;
    const tasks = parseWorkflow(markdown);

    expect(tasks[0].subtasks).toHaveLength(2);
    expect(tasks[0].subtasks?.[0]).toEqual({
      id: 'A',
      description: 'First reviewer',
      agentType: 'code-review-agent',
      isDynamic: false,
    });
    expect(tasks[0].subtasks?.[1].id).toBe('B');
  });

  it('parses dynamic subtask template', () => {
    const markdown = `
## 1. Execute batch

### 1.{n} Execute task

PASS ALL: CONTINUE
FAIL ANY: STOP
`;
    const tasks = parseWorkflow(markdown);

    expect(tasks[0].subtasks).toHaveLength(1);
    expect(tasks[0].subtasks?.[0].isDynamic).toBe(true);
    expect(tasks[0].subtasks?.[0].id).toBe('{n}');
  });

  it('errors when subtask prefix doesnt match task', () => {
    const markdown = `
## 1. Task one

### 2.A Wrong prefix
`;
    expect(() => parseWorkflow(markdown)).toThrow('does not belong');
  });

  it('errors for duplicate subtask IDs', () => {
    const markdown = `
## 1. Task

### 1.A First
### 1.A Duplicate
`;
    expect(() => parseWorkflow(markdown)).toThrow('Duplicate subtask');
  });

  it('errors when mixing static and dynamic subtasks', () => {
    const markdown = `
## 1. Task

### 1.A Static
### 1.{n} Dynamic
`;
    expect(() => parseWorkflow(markdown)).toThrow('Cannot mix');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/parser" --no-coverage`
Expected: FAIL - subtasks not parsed

**Step 3: Update parser.ts to handle H3 headings**

Update `parser.ts`:

```typescript
import { extractTaskHeader, extractSubtaskHeader, parseConditional, convertConditionals } from './helpers';
import type { Subtask } from '../types';

interface TaskBuilder {
  number: TaskNumber;
  description: string;
  command?: { code: string };
  prompts: { text: string }[];
  subtasks: Subtask[];  // NEW
}

// Inside parseWorkflow(), update the visitor to handle H3:

// Handle H3 headings - these are subtask headers
if (node.type === 'heading' && node.depth === 3) {
  if (!currentTask) {
    throw new WorkflowSyntaxError(
      'Subtask (### ...) must appear within a task (## ...). ' +
      'Found subtask header before any task header.'
    );
  }

  const headingText = extractText(node);
  const parsed = extractSubtaskHeader(headingText);

  if (parsed) {
    // Validate subtask belongs to current task
    if (parsed.taskNumber !== currentTask.number) {
      throw new WorkflowSyntaxError(
        `Subtask ${parsed.taskNumber}.${parsed.id} does not belong to current task ${currentTask.number}. ` +
        `Subtask prefix must match parent task number.`
      );
    }

    // Check for duplicate subtask IDs
    const existing = currentTask.subtasks.find(s => s.id === parsed.id);
    if (existing) {
      throw new WorkflowSyntaxError(
        `Duplicate subtask ID: ${currentTask.number}.${parsed.id}`
      );
    }

    // Check for mixing static and dynamic
    const hasStatic = currentTask.subtasks.some(s => !s.isDynamic);
    const hasDynamic = currentTask.subtasks.some(s => s.isDynamic);
    if ((hasStatic && parsed.isDynamic) || (hasDynamic && !parsed.isDynamic)) {
      throw new WorkflowSyntaxError(
        `Cannot mix static (### N.A) and dynamic (### N.{n}) subtasks in task ${currentTask.number}`
      );
    }

    currentTask.subtasks.push({
      id: parsed.id,
      description: parsed.description,
      agentType: parsed.agentType,
      isDynamic: parsed.isDynamic,
    });
  }
}

// Update TaskBuilder initialization in H2 handler:
currentTask = {
  number: parsed.number,
  description: parsed.description,
  prompts: [],
  subtasks: [],  // NEW
};

// Update finalizeTask to include subtasks:
function finalizeTask(
  task: TaskBuilder,
  pendingConditionals: ParsedConditional[],
  implicitText: string
): Task {
  // ... existing logic ...

  return {
    number: task.number,
    description: task.description,
    command: task.command,
    prompts: task.prompts,
    conditions: conditions || undefined,
    subtasks: task.subtasks.length > 0 ? task.subtasks : undefined,  // NEW
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/parser" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/parser/parser.ts __tests__/workflow/parser/parser.test.ts && git commit -m "feat(parser): add H3 subtask parsing with validation"
```

---

## Task 8: Add evaluateConditions Function

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/evaluation.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/evaluation.test.ts`

**Step 1: Write failing tests**

Create `__tests__/workflow/evaluation.test.ts`:

> **Fixture Note:** Tests use a minimal `TaskState` shape with only `id` and `status` fields. The real `TaskState` interface includes additional fields (`completedAt`, etc.), but `evaluateConditions()` only inspects `status`. Use type assertion `as TaskState` if TypeScript requires the full interface:
> ```typescript
> const tasks = [
>   { id: '1', status: 'complete' },
> ] as TaskState[];
> ```

```typescript
import { evaluateConditions } from '../../src/workflow/evaluation';
import type { Conditions, TaskState } from '../../src/workflow/types';

describe('evaluateConditions', () => {
  const passAction = { type: 'CONTINUE' as const };
  const failAction = { type: 'STOP' as const };

  describe('all: true (PASS ALL + FAIL ANY)', () => {
    const conditions: Conditions = { all: true, pass: passAction, fail: failAction };

    it('returns pass when all complete', () => {
      const tasks = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'complete' },
      ] as TaskState[];
      expect(evaluateConditions(tasks, conditions)).toEqual(passAction);
    });

    it('returns fail when any blocked', () => {
      const tasks = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'blocked' },
      ] as TaskState[];
      expect(evaluateConditions(tasks, conditions)).toEqual(failAction);
    });
  });

  describe('all: false (PASS ANY + FAIL ALL)', () => {
    const conditions: Conditions = { all: false, pass: passAction, fail: failAction };

    it('returns pass when any complete', () => {
      const tasks = [
        { id: '1', status: 'complete' },
        { id: '2', status: 'blocked' },
      ] as TaskState[];
      expect(evaluateConditions(tasks, conditions)).toEqual(passAction);
    });

    it('returns fail when all blocked', () => {
      const tasks = [
        { id: '1', status: 'blocked' },
        { id: '2', status: 'blocked' },
      ] as TaskState[];
      expect(evaluateConditions(tasks, conditions)).toEqual(failAction);
    });
  });

  describe('single task (unified behavior)', () => {
    it('works identically for both modes with single task', () => {
      const pessimistic: Conditions = { all: true, pass: passAction, fail: failAction };
      const optimistic: Conditions = { all: false, pass: passAction, fail: failAction };

      const complete = [{ id: '1', status: 'complete' }] as TaskState[];
      const blocked = [{ id: '1', status: 'blocked' }] as TaskState[];

      // Both modes should produce same result for single task
      expect(evaluateConditions(complete, pessimistic)).toEqual(passAction);
      expect(evaluateConditions(complete, optimistic)).toEqual(passAction);
      expect(evaluateConditions(blocked, pessimistic)).toEqual(failAction);
      expect(evaluateConditions(blocked, optimistic)).toEqual(failAction);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="evaluation" --no-coverage`
Expected: FAIL - module not found

**Step 3: Implement evaluation.ts**

```typescript
// src/workflow/evaluation.ts
import type { Action, Conditions, TaskState } from './types';

/**
 * Evaluate aggregated conditions based on task states
 *
 * For PASS ALL + FAIL ANY (all: true, pessimistic):
 *   - Any blocked -> fail action
 *   - All complete -> pass action
 *
 * For PASS ANY + FAIL ALL (all: false, optimistic):
 *   - Any complete -> pass action
 *   - All blocked -> fail action
 */
export function evaluateConditions(
  tasks: readonly TaskState[],
  conditions: Conditions
): Action {
  const anyBlocked = tasks.some(t => t.status === 'blocked');
  const anyComplete = tasks.some(t => t.status === 'complete');

  // Exhaustive switch on discriminant
  switch (conditions.all) {
    case true:
      // PASS ALL + FAIL ANY: any failure triggers fail
      return anyBlocked ? conditions.fail : conditions.pass;
    case false:
      // PASS ANY + FAIL ALL: any success triggers pass
      return anyComplete ? conditions.pass : conditions.fail;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="evaluation" --no-coverage`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test --no-coverage`
Expected: PASS (all tests green)

**Step 6: Commit**

```bash
cd plugin/hooks/hooks-app && git add src/workflow/evaluation.ts __tests__/workflow/evaluation.test.ts && git commit -m "feat(workflow): add evaluateConditions for aggregated task results"
```

---

## Exit Criteria

Before marking implementation complete, verify ALL of the following:

| Criterion | Verification Command |
|-----------|---------------------|
| Subtask type exists | `grep "interface Subtask" src/workflow/types.ts` returns match |
| Conditions has `all` field | `grep "readonly all:" src/workflow/types.ts` returns match |
| Parser handles H3 subtasks | Parse "### 1.A Reviewer" -> task has subtasks array |
| Parser rejects wrong prefix | Parse "### 2.A" under task 1 -> throws error |
| Parser rejects duplicate ID | Parse two "### 1.A" -> throws error |
| PASS ALL parses correctly | parseConditional("PASS ALL: CONTINUE") returns modifier: 'ALL' |
| Invalid combo throws | convertConditionals with PASS ALL + FAIL ALL -> throws |
| evaluateConditions works | all:true + any blocked -> returns fail action |
| All parser tests pass | `npm test -- --testPathPattern="parser" --no-coverage` |
| Evaluation tests pass | `npm test -- --testPathPattern="evaluation" --no-coverage` |
| All tests pass | `npm test --no-coverage` exits 0 |
| Build succeeds | `npm run build` exits 0 |
| Lint passes | `npm run lint` exits 0 |

**E2E parser verification:**
```typescript
const markdown = `
## 1. Dispatch reviewers

### 1.A First reviewer (code-review-agent)
### 1.B Second reviewer (code-agent)

PASS ALL: CONTINUE
FAIL ANY: STOP
`;
const tasks = parseWorkflow(markdown);
assert(tasks[0].subtasks?.length === 2);
assert(tasks[0].conditions?.all === true);
```

---

## Summary

After completing this plan:
- [x] Subtask type added to types.ts
- [x] Conditions updated to discriminated union with `all` field
- [x] parseConditional handles PASS ALL, FAIL ANY syntax
- [x] convertConditionals validates aggregation combinations
- [x] extractSubtaskHeader parses H3 headers
- [x] Parser handles H3 subtasks with validation
- [x] evaluateConditions for aggregated task results

**All Plans Complete!**

Run: `cd plugin/hooks/hooks-app && npm test && npm run build && npm run lint`
Expected: All pass - implementation complete
