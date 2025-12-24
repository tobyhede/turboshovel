# Turboshovel Workflow System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a workflow system that makes skills executable - markdown workflows with CLI control, hook integration for tracking, and state that survives sessions.

**Architecture:** Markdown workflows define processes with steps, conditionals (PASS/FAIL), and actions (CONTINUE/STOP/GOTO). A CLI tool (`workflow`) manages state. Hooks track Task dispatches and inject context. State persists in `.claude/turboshovel/workflows/`.

**Tech Stack:** TypeScript, Jest (testing), mdast-util-from-markdown (markdown parsing), Commander (CLI)

---

## Phase 1: Core Types & State Management

### Task 1.1: Create workflow types module

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/types.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/types.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/workflow/types.test.ts
import { createStepNumber, type StepNumber, type Action, type Step } from '../../src/workflow/types';

describe('StepNumber', () => {
  test('createStepNumber with valid number returns StepNumber', () => {
    const result = createStepNumber(1);
    expect(result).not.toBeNull();
    expect(result).toBe(1);
  });

  test('createStepNumber with zero returns null', () => {
    const result = createStepNumber(0);
    expect(result).toBeNull();
  });

  test('createStepNumber with negative returns null', () => {
    const result = createStepNumber(-1);
    expect(result).toBeNull();
  });

  test('createStepNumber with non-integer returns null', () => {
    const result = createStepNumber(1.5);
    expect(result).toBeNull();
  });
});

describe('Action discriminated union', () => {
  test('CONTINUE action has correct type', () => {
    const action: Action = { type: 'CONTINUE' };
    expect(action.type).toBe('CONTINUE');
  });

  test('STOP action without message', () => {
    const action: Action = { type: 'STOP' };
    expect(action.type).toBe('STOP');
    expect('message' in action).toBe(false);
  });

  test('STOP action with message', () => {
    const action: Action = { type: 'STOP', message: 'fix tests' };
    expect(action.type).toBe('STOP');
    if (action.type === 'STOP') {
      expect(action.message).toBe('fix tests');
    }
  });

  test('GOTO action with step number', () => {
    const action: Action = { type: 'GOTO', step: 3 as StepNumber };
    expect(action.type).toBe('GOTO');
    if (action.type === 'GOTO') {
      expect(action.step).toBe(3);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types.test" --no-coverage`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/workflow/types.ts

/**
 * Branded type for step numbers (1-indexed, never zero)
 */
export type StepNumber = number & { readonly __brand: 'StepNumber' };

/**
 * Factory function to create a valid StepNumber
 * Returns null if the number is invalid (zero, negative, or non-integer)
 */
export function createStepNumber(n: number): StepNumber | null {
  if (n <= 0 || !Number.isInteger(n)) {
    return null;
  }
  return n as StepNumber;
}

/**
 * Discriminated union for workflow actions
 * Prevents invalid states at compile time
 */
export type Action =
  | { readonly type: 'CONTINUE' }
  | { readonly type: 'STOP'; readonly message?: string }
  | { readonly type: 'GOTO'; readonly step: StepNumber }
  | { readonly type: 'DONE' }
  | { readonly type: 'RETRY'; readonly max?: number };

/**
 * Conditional branch (PASS or FAIL)
 */
export interface Conditions {
  readonly pass: Action;
  readonly fail: Action;
}

/**
 * Command to execute (bash code block)
 */
export interface Command {
  readonly code: string;
}

/**
 * Prompt for agent (implicit or explicit)
 */
export interface Prompt {
  readonly text: string;
}

/**
 * A single step in a workflow
 */
export interface Step {
  readonly number: StepNumber;
  readonly description: string;
  readonly command?: Command;
  readonly prompts: readonly Prompt[];
  readonly conditions?: Conditions;
  readonly nestedWorkflow?: string; // Reference to nested workflow file
}

/**
 * Parsed workflow definition
 */
export interface Workflow {
  readonly name: string;
  readonly description?: string;
  readonly steps: readonly Step[];
}

/**
 * Task state within a workflow
 */
export interface TaskState {
  readonly id: string;
  readonly status: 'pending' | 'running' | 'complete' | 'blocked';
  readonly subagentType?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

/**
 * Workflow execution state (persisted)
 */
export interface WorkflowState {
  readonly id: string;
  readonly workflow: string;
  readonly step: StepNumber;
  readonly stepName: string;
  readonly retryCount: number;
  readonly retryMax: number;
  readonly variables: Record<string, boolean | number | string>;
  readonly tasks: readonly TaskState[];
  readonly nested?: {
    readonly workflow: string;
    readonly instanceId: string;
  };
  readonly startedAt: string;
  readonly updatedAt: string;
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/types.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/types.ts plugin/hooks/hooks-app/__tests__/workflow/types.test.ts
git commit -m "$(cat <<'EOF'
feat(workflow): add core type definitions

Branded StepNumber type, Action discriminated union, Step/Workflow interfaces.
EOF
)"
```

---

### Task 1.2: Create workflow state manager

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/state.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/state.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/workflow/state.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { WorkflowStateManager } from '../../src/workflow/state';
import { createStepNumber, type WorkflowState } from '../../src/workflow/types';

describe('WorkflowStateManager', () => {
  let testDir: string;
  let manager: WorkflowStateManager;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-state-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new WorkflowStateManager(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('create', () => {
    test('creates new workflow state with generated ID', async () => {
      const state = await manager.create('execute.workflow.md', 'Execute batch');

      expect(state.id).toMatch(/^wf-\d{4}-\d{2}-\d{2}-/);
      expect(state.workflow).toBe('execute.workflow.md');
      expect(state.step).toBe(1);
      expect(state.stepName).toBe('Execute batch');
      expect(state.retryCount).toBe(0);
      expect(state.variables).toEqual({});
      expect(state.tasks).toEqual([]);
    });

    test('persists state to file', async () => {
      const state = await manager.create('test.workflow.md', 'Test step');

      const statePath = join(testDir, '.claude/turboshovel/workflows', `${state.id}.json`);
      const fileContent = await fs.readFile(statePath, 'utf8');
      const parsed = JSON.parse(fileContent);

      expect(parsed.workflow).toBe('test.workflow.md');
    });

    test('state directory matches expected path (.claude/turboshovel/workflows)', async () => {
      // This test ensures STATE_DIR constant is correct - update this test if you change STATE_DIR
      const state = await manager.create('test.workflow.md', 'Test step');
      const expectedDir = join(testDir, '.claude/turboshovel/workflows');

      // Verify state file exists in expected directory
      const files = await fs.readdir(expectedDir);
      expect(files).toContain(`${state.id}.json`);
    });
  });

  describe('load', () => {
    test('loads existing workflow state by ID', async () => {
      const created = await manager.create('test.workflow.md', 'Test step');
      const loaded = await manager.load(created.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(created.id);
      expect(loaded?.workflow).toBe('test.workflow.md');
    });

    test('returns null for non-existent ID', async () => {
      const loaded = await manager.load('non-existent-id');
      expect(loaded).toBeNull();
    });
  });

  describe('getActive', () => {
    test('returns active workflow from session', async () => {
      const created = await manager.create('test.workflow.md', 'Test step');
      await manager.setActive(created.id);

      const active = await manager.getActive();
      expect(active?.id).toBe(created.id);
    });

    test('returns null when no active workflow', async () => {
      const active = await manager.getActive();
      expect(active).toBeNull();
    });
  });

  describe('update', () => {
    test('updates workflow state fields', async () => {
      const created = await manager.create('test.workflow.md', 'Step 1');

      const updated = await manager.update(created.id, {
        step: createStepNumber(2)!,
        stepName: 'Step 2',
        retryCount: 1,
      });

      expect(updated.step).toBe(2);
      expect(updated.stepName).toBe('Step 2');
      expect(updated.retryCount).toBe(1);
    });

    test('updates variables', async () => {
      const created = await manager.create('test.workflow.md', 'Step 1');

      const updated = await manager.update(created.id, {
        variables: { more_batches: true, completed_batches: 1 },
      });

      expect(updated.variables.more_batches).toBe(true);
      expect(updated.variables.completed_batches).toBe(1);
    });
  });

  describe('delete', () => {
    test('removes workflow state file', async () => {
      const created = await manager.create('test.workflow.md', 'Test step');
      await manager.delete(created.id);

      const loaded = await manager.load(created.id);
      expect(loaded).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state.test" --no-coverage`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/workflow/state.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { createStepNumber, type StepNumber, type WorkflowState, type TaskState } from './types';

const STATE_DIR = '.claude/turboshovel/workflows';
const SESSION_FILE = '.claude/turboshovel/session.json';

function generateId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const random = Math.random().toString(36).slice(2, 8);
  return `wf-${date}-${random}`;
}

export class WorkflowStateManager {
  private readonly cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  private get stateDir(): string {
    return path.join(this.cwd, STATE_DIR);
  }

  private get sessionPath(): string {
    return path.join(this.cwd, SESSION_FILE);
  }

  private statePath(id: string): string {
    return path.join(this.stateDir, `${id}.json`);
  }

  async create(workflow: string, stepName: string): Promise<WorkflowState> {
    const id = generateId();
    const now = new Date().toISOString();

    const state: WorkflowState = {
      id,
      workflow,
      step: createStepNumber(1)!,
      stepName,
      retryCount: 0,
      retryMax: 3,
      variables: {},
      tasks: [],
      startedAt: now,
      updatedAt: now,
    };

    await this.save(state);
    return state;
  }

  async load(id: string): Promise<WorkflowState | null> {
    try {
      const content = await fs.readFile(this.statePath(id), 'utf8');
      return JSON.parse(content) as WorkflowState;
    } catch {
      return null;
    }
  }

  async save(state: WorkflowState): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    const updated: WorkflowState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(this.statePath(state.id), JSON.stringify(updated, null, 2));
  }

  async update(id: string, updates: Partial<Omit<WorkflowState, 'id' | 'startedAt'>>): Promise<WorkflowState> {
    const existing = await this.load(id);
    if (!existing) {
      throw new Error(`Workflow ${id} not found`);
    }

    const updated: WorkflowState = {
      ...existing,
      ...updates,
      variables: { ...existing.variables, ...updates.variables },
      updatedAt: new Date().toISOString(),
    };

    await this.save(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    try {
      await fs.unlink(this.statePath(id));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async getActive(): Promise<WorkflowState | null> {
    try {
      const content = await fs.readFile(this.sessionPath, 'utf8');
      const session = JSON.parse(content);
      if (session.active_workflow) {
        return this.load(session.active_workflow);
      }
    } catch {
      // Session file doesn't exist or is invalid
    }
    return null;
  }

  async setActive(id: string | null): Promise<void> {
    await fs.mkdir(path.dirname(this.sessionPath), { recursive: true });

    let session: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(this.sessionPath, 'utf8');
      session = JSON.parse(content);
    } catch {
      // Start fresh if session doesn't exist
    }

    session.active_workflow = id;
    await fs.writeFile(this.sessionPath, JSON.stringify(session, null, 2));
  }

  async list(): Promise<WorkflowState[]> {
    try {
      const files = await fs.readdir(this.stateDir);
      const states: WorkflowState[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const state = await this.load(id);
          if (state) {
            states.push(state);
          }
        }
      }

      return states;
    } catch {
      return [];
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="workflow/state.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/state.ts plugin/hooks/hooks-app/__tests__/workflow/state.test.ts
git commit -m "$(cat <<'EOF'
feat(workflow): add workflow state manager

Create, load, update, delete workflow state. Session integration for active workflow.
EOF
)"
```

---

### Task 1.3: Create workflow module index

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/index.ts`

**Step 1: Write the module index**

```typescript
// src/workflow/index.ts
export * from './types';
export { WorkflowStateManager } from './state';
```

**Step 2: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/index.ts
git commit -m "$(cat <<'EOF'
feat(workflow): add module index

Re-export types and state manager from workflow module.
EOF
)"
```

---

## Phase 2: Workflow Parser

### Task 2.1: Install parser and CLI dependencies

**Step 1: Add dependencies**

Run: `cd plugin/hooks/hooks-app && npm install mdast-util-from-markdown unist-util-visit commander`

- `mdast-util-from-markdown` - Parse markdown to mdast AST (uses micromark internally)
- `unist-util-visit` - Walk AST nodes
- `commander` - CLI argument parsing

**Step 2: Add type dependencies**

Run: `cd plugin/hooks/hooks-app && npm install -D @types/mdast`

- `@types/mdast` - TypeScript types for mdast AST nodes

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/package.json plugin/hooks/hooks-app/package-lock.json
git commit -m "$(cat <<'EOF'
chore(deps): add mdast-util-from-markdown and commander

mdast-util-from-markdown for markdown parsing to AST,
unist-util-visit for tree walking, commander for CLI.
EOF
)"
```

---

### Task 2.2: Create parser types and helpers

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/parser/types.ts`
- Create: `plugin/hooks/hooks-app/src/workflow/parser/helpers.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts`

**Step 1: Write the failing test for helpers**

```typescript
// __tests__/workflow/parser/helpers.test.ts
import { stripSeparator, extractStepHeader, parseAction, parseConditional } from '../../../src/workflow/parser/helpers';

describe('stripSeparator', () => {
  test('strips colon separator', () => {
    expect(stripSeparator(': CONTINUE')).toBe('CONTINUE');
  });

  test('strips dot separator', () => {
    expect(stripSeparator('. First step')).toBe('First step');
  });

  test('strips dash separator', () => {
    expect(stripSeparator(' - CONTINUE')).toBe('CONTINUE');
  });

  test('strips paren separator', () => {
    expect(stripSeparator(') First step')).toBe('First step');
  });

  test('strips multiple separators', () => {
    expect(stripSeparator(': - First step')).toBe('First step');
  });
});

describe('extractStepHeader', () => {
  test('parses "1. First step"', () => {
    const result = extractStepHeader('1. First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('parses "1: First step"', () => {
    const result = extractStepHeader('1: First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('parses "1) First step"', () => {
    const result = extractStepHeader('1) First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('parses "1 - First step"', () => {
    const result = extractStepHeader('1 - First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('parses "1 First step" (space only)', () => {
    const result = extractStepHeader('1 First step');
    expect(result).toEqual({ number: 1, description: 'First step' });
  });

  test('rejects Step keyword', () => {
    const result = extractStepHeader('Step 1: First step');
    expect(result).toBeNull();
  });

  test('rejects zero', () => {
    const result = extractStepHeader('0. Zero step');
    expect(result).toBeNull();
  });

  test('rejects non-numeric start', () => {
    const result = extractStepHeader('First step');
    expect(result).toBeNull();
  });
});

describe('parseAction', () => {
  test('parses CONTINUE', () => {
    expect(parseAction('CONTINUE')).toEqual({ type: 'CONTINUE' });
  });

  test('parses STOP without message', () => {
    expect(parseAction('STOP')).toEqual({ type: 'STOP' });
  });

  test('parses STOP with message', () => {
    expect(parseAction('STOP fix tests first')).toEqual({ type: 'STOP', message: 'fix tests first' });
  });

  test('parses GOTO N', () => {
    const result = parseAction('GOTO 3');
    expect(result).toEqual({ type: 'GOTO', step: 3 });
  });

  test('parses DONE', () => {
    expect(parseAction('DONE')).toEqual({ type: 'DONE' });
  });

  test('parses RETRY without max', () => {
    expect(parseAction('RETRY')).toEqual({ type: 'RETRY' });
  });

  test('parses RETRY with max', () => {
    expect(parseAction('RETRY 3')).toEqual({ type: 'RETRY', max: 3 });
  });

  test('returns null for invalid action', () => {
    expect(parseAction('INVALID')).toBeNull();
  });
});

describe('parseConditional', () => {
  test('parses PASS: CONTINUE', () => {
    expect(parseConditional('PASS: CONTINUE')).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
    });
  });

  test('parses FAIL: STOP message', () => {
    expect(parseConditional('FAIL: STOP fix tests')).toEqual({
      type: 'fail',
      action: { type: 'STOP', message: 'fix tests' },
    });
  });

  test('parses with space separator', () => {
    expect(parseConditional('PASS CONTINUE')).toEqual({
      type: 'pass',
      action: { type: 'CONTINUE' },
    });
  });

  test('parses with dash separator', () => {
    expect(parseConditional('FAIL - STOP')).toEqual({
      type: 'fail',
      action: { type: 'STOP' },
    });
  });

  test('returns null for non-conditional', () => {
    expect(parseConditional('Some random text')).toBeNull();
  });

  test('rejects lowercase pass/fail', () => {
    expect(parseConditional('pass: CONTINUE')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/helpers.test" --no-coverage`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

```typescript
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
```

```typescript
// src/workflow/parser/helpers.ts

import { createStepNumber, type Action, type StepNumber } from '../types';
import type { ParsedConditional } from './types';

/**
 * Strip common separators and whitespace
 */
export function stripSeparator(text: string): string {
  return text
    .replace(/^[.:—\-)\s]+/, '')
    .trim();
}

/**
 * Extract step number and description from header text
 * Returns null if not a valid step header
 */
export function extractStepHeader(text: string): { number: StepNumber; description: string } | null {
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
  const stepNumber = createStepNumber(number);
  if (!stepNumber) {
    return null; // Invalid step number (zero or negative)
  }

  // Strip separator and extract description
  const description = stripSeparator(trimmed.slice(numEnd));

  // Reject "Step" keyword explicitly
  if (description.startsWith('Step ') || description === 'Step') {
    return null;
  }

  if (!description) {
    return null;
  }

  return { number: stepNumber, description };
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
    const stepStr = trimmed.slice(5).trim();
    const stepNum = parseInt(stepStr, 10);
    const step = createStepNumber(stepNum);
    if (!step) {
      return null;
    }
    return { type: 'GOTO', step };
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

  if (trimmed.startsWith('Go to Step ')) {
    const stepStr = trimmed.slice(11).trim();
    const stepNum = parseInt(stepStr, 10);
    const step = createStepNumber(stepNum);
    if (!step) {
      return null;
    }
    return { type: 'GOTO', step };
  }

  if (trimmed.startsWith('STOP (') && trimmed.endsWith(')')) {
    const message = trimmed.slice(6, -1);
    return { type: 'STOP', message };
  }

  return null;
}

/**
 * Parse a conditional line (PASS: action or FAIL: action)
 */
export function parseConditional(text: string): ParsedConditional | null {
  const trimmed = text.trim();

  // Try ALLCAPS first (new syntax)
  if (trimmed.startsWith('PASS')) {
    const rest = trimmed.slice(4);
    const actionStr = stripSeparator(rest);
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'pass', action };
  }

  if (trimmed.startsWith('FAIL')) {
    const rest = trimmed.slice(4);
    const actionStr = stripSeparator(rest);
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'fail', action };
  }

  // Backward compatibility: old syntax (Pass: / Fail:)
  if (trimmed.startsWith('Pass:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'pass', action };
  }

  if (trimmed.startsWith('Fail:')) {
    const actionStr = trimmed.slice(5).trim();
    const action = parseAction(actionStr);
    if (!action) {
      return null;
    }
    return { type: 'fail', action };
  }

  return null;
}

/**
 * Convert pending conditionals to Conditions object
 */
export function convertConditionals(conditionals: ParsedConditional[]): { pass: Action; fail: Action } | null {
  if (conditionals.length === 0) {
    return null;
  }

  let passAction: Action | null = null;
  let failAction: Action | null = null;

  for (const conditional of conditionals) {
    if (conditional.type === 'pass') {
      passAction = conditional.action;
    } else {
      failAction = conditional.action;
    }
  }

  // If we have both, create Conditions
  if (passAction && failAction) {
    return { pass: passAction, fail: failAction };
  }

  if (passAction && !failAction) {
    return { pass: passAction, fail: { type: 'STOP' } };
  }

  if (!passAction && failAction) {
    return { pass: { type: 'CONTINUE' }, fail: failAction };
  }

  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/helpers.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/parser/
git commit -m "$(cat <<'EOF'
feat(workflow): add parser types and helpers

Strip separators, extract step headers, parse actions and conditionals.
EOF
)"
```

---

### Task 2.3: Create main parser

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/parser/parser.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/parser/parser.test.ts`

**Step 1: Write the failing tests**

```typescript
// __tests__/workflow/parser/parser.test.ts
import { parseWorkflow } from '../../../src/workflow/parser/parser';
import { WorkflowSyntaxError } from '../../../src/workflow/parser/types';

describe('parseWorkflow', () => {
  describe('basic parsing', () => {
    test('parses simple two-step workflow', () => {
      const markdown = `
## 1. First step

Some description

## 2. Second step

More description
`;

      const steps = parseWorkflow(markdown);
      expect(steps).toHaveLength(2);
      expect(steps[0].number).toBe(1);
      expect(steps[0].description).toBe('First step');
      expect(steps[1].number).toBe(2);
      expect(steps[1].description).toBe('Second step');
    });

    test('parses commands in steps', () => {
      const markdown = `
## 1. Run tests

\`\`\`bash
npm test
\`\`\`

## 2. Check status

\`\`\`bash
git status
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].command?.code).toBe('npm test');
      expect(steps[1].command?.code).toBe('git status');
    });

    test('ignores non-bash code blocks', () => {
      const markdown = `
## 1. Test

\`\`\`python
print("test")
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].command).toBeUndefined();
    });
  });

  describe('conditionals', () => {
    test('parses PASS/FAIL conditionals', () => {
      const markdown = `
## 1. Run tests

PASS: CONTINUE
FAIL: STOP fix tests

\`\`\`bash
npm test
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].conditions).toBeDefined();
      expect(steps[0].conditions?.pass).toEqual({ type: 'CONTINUE' });
      expect(steps[0].conditions?.fail).toEqual({ type: 'STOP', message: 'fix tests' });
    });

    test('parses list-based conditionals', () => {
      const markdown = `
## 1. Run tests

\`\`\`bash
npm test
\`\`\`

- PASS: CONTINUE
- FAIL: STOP fix tests
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].conditions).toBeDefined();
      expect(steps[0].conditions?.pass).toEqual({ type: 'CONTINUE' });
    });

    test('parses GOTO action', () => {
      const markdown = `
## 1. Test

PASS: GOTO 3
FAIL: STOP

\`\`\`bash
echo "test"
\`\`\`

## 2. Skip

\`\`\`bash
echo "skipped"
\`\`\`

## 3. Target

\`\`\`bash
echo "reached"
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].conditions?.pass).toEqual({ type: 'GOTO', step: 3 });
    });
  });

  describe('prompts', () => {
    test('parses explicit prompts', () => {
      const markdown = `
## 1. Verify tests

**Prompt:** Do all functions have tests?
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].prompts).toHaveLength(1);
      expect(steps[0].prompts[0].text).toBe('Do all functions have tests?');
    });

    test('creates implicit prompts for steps without code blocks', () => {
      const markdown = `
## 1. Review code

Review the code changes carefully.

- PASS: CONTINUE
- FAIL: STOP

## 2. Fix issues

\`\`\`bash
echo "fix"
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].prompts).toHaveLength(1);
      expect(steps[0].prompts[0].text).toContain('Review the code');
    });

    test('no implicit prompt when code block exists', () => {
      const markdown = `
## 1. Run tests

\`\`\`bash
npm test
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`;

      const steps = parseWorkflow(markdown);
      expect(steps[0].prompts).toHaveLength(0);
      expect(steps[0].command).toBeDefined();
    });
  });

  describe('validation', () => {
    test('throws on empty workflow', () => {
      expect(() => parseWorkflow('')).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow('')).toThrow('at least one step');
    });

    test('throws on non-sequential steps', () => {
      const markdown = `
## 1. First step

## 5. Fifth step
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('sequential');
    });

    test('throws on multiple code blocks per step', () => {
      const markdown = `
## 1. Test with multiple blocks

\`\`\`bash
echo "first"
\`\`\`

\`\`\`bash
echo "second"
\`\`\`
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('Multiple code blocks');
    });

    test('throws on invalid GOTO target', () => {
      const markdown = `
## 1. Bad goto

PASS: GOTO 99
FAIL: STOP

\`\`\`bash
echo "test"
\`\`\`
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('does not exist');
    });

    test('throws on GOTO self (infinite loop)', () => {
      const markdown = `
## 1. Self loop

PASS: GOTO 1
FAIL: STOP

\`\`\`bash
echo "test"
\`\`\`
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('infinite loop');
    });

    test('rejects H1 as step header', () => {
      const markdown = `
# 1. First step

\`\`\`bash
echo "test"
\`\`\`
`;

      expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
      expect(() => parseWorkflow(markdown)).toThrow('H1 headers');
    });
  });

  describe('header separators', () => {
    test.each([
      ['1. First step', 'dot'],
      ['1: First step', 'colon'],
      ['1 - First step', 'dash'],
      ['1) First step', 'paren'],
      ['1 First step', 'space'],
    ])('parses header with %s separator', (header) => {
      const markdown = `
## ${header}

\`\`\`bash
echo "test"
\`\`\`
`;

      const steps = parseWorkflow(markdown);
      expect(steps).toHaveLength(1);
      expect(steps[0].number).toBe(1);
      expect(steps[0].description).toBe('First step');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/parser.test" --no-coverage`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

```typescript
// src/workflow/parser/parser.ts

import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';
import type { Root, Heading, Code, Paragraph, List, ListItem, Strong, Text, PhrasingContent } from 'mdast';
import type { Step, Action } from '../types';
import { extractStepHeader, parseConditional, convertConditionals } from './helpers';
import { WorkflowSyntaxError, type ParsedConditional } from './types';

/**
 * Extract plain text from mdast node
 */
function extractText(node: PhrasingContent | Heading | Paragraph | ListItem): string {
  if (node.type === 'text') {
    return (node as Text).value;
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => extractText(child as PhrasingContent)).join('');
  }
  return '';
}

/**
 * Check if paragraph contains **Prompt:** marker
 */
function hasPromptMarker(node: Paragraph): boolean {
  for (const child of node.children) {
    if (child.type === 'strong') {
      const text = extractText(child);
      if (text.trim() === 'Prompt:') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract prompt text (everything after **Prompt:** marker)
 */
function extractPromptText(node: Paragraph): string {
  let foundMarker = false;
  let promptText = '';

  for (const child of node.children) {
    if (child.type === 'strong' && extractText(child).trim() === 'Prompt:') {
      foundMarker = true;
      continue;
    }
    if (foundMarker) {
      promptText += extractText(child as PhrasingContent);
    }
  }

  return promptText.trim();
}

/**
 * Parse workflow markdown into Step array
 *
 * Uses mdast-util-from-markdown to parse markdown into AST,
 * then walks the tree to extract workflow semantics.
 * This mirrors the Rust pulldown-cmark pattern.
 */
export function parseWorkflow(markdown: string): Step[] {
  // Parse markdown to AST
  const tree = fromMarkdown(markdown) as Root;

  // State for walking
  const steps: Step[] = [];
  let currentStep: Partial<Step> | null = null;
  let pendingConditionals: ParsedConditional[] = [];
  let implicitText = '';

  // Walk AST nodes
  visit(tree, (node, index, parent) => {
    // Handle H1 headings - reject if they look like step headers
    if (node.type === 'heading' && node.depth === 1) {
      const headingText = extractText(node);
      const looksLikeStep = /^\d+[.:\-)\s]/.test(headingText);
      if (looksLikeStep) {
        throw new WorkflowSyntaxError(
          `H1 headers (# ...) cannot be used as step headers. Use H2 (## ${headingText}) instead.`
        );
      }
    }

    // Handle H2 headings - these are step headers
    if (node.type === 'heading' && node.depth === 2) {
      // Finalize previous step
      if (currentStep) {
        steps.push(finalizeStep(currentStep, pendingConditionals, implicitText));
        pendingConditionals = [];
        implicitText = '';
      }

      // Start new step
      const headingText = extractText(node);
      const parsed = extractStepHeader(headingText);
      if (parsed) {
        currentStep = {
          number: parsed.number,
          description: parsed.description,
          prompts: [],
        };
      }
    }

    // Handle code blocks
    if (node.type === 'code' && currentStep) {
      const codeNode = node as Code;
      const lang = codeNode.lang?.split(/\s+/)[0];

      if (lang === 'bash') {
        if (currentStep.command) {
          throw new WorkflowSyntaxError(
            `Multiple code blocks per step not allowed. Step ${currentStep.number} already has a command block. ` +
            `Suggestion: (1) Combine commands using && or ; operators, or (2) Split into separate steps.`
          );
        }
        currentStep.command = { code: codeNode.value };
      }
    }

    // Handle paragraphs - check for conditionals or prompts
    if (node.type === 'paragraph' && currentStep) {
      const paragraphNode = node as Paragraph;

      // Check for **Prompt:** marker
      if (hasPromptMarker(paragraphNode)) {
        const promptText = extractPromptText(paragraphNode);
        if (promptText) {
          currentStep.prompts = [
            ...(currentStep.prompts || []),
            { text: promptText },
          ];
        }
        return;
      }

      // Check for conditionals (PASS:/FAIL:)
      const text = extractText(paragraphNode);
      const conditional = parseConditional(text);
      if (conditional) {
        pendingConditionals.push(conditional);
        return;
      }

      // Collect as implicit text (not conditional, not prompt)
      if (text.trim()) {
        implicitText += text.trim() + '\n';
      }
    }

    // Handle list items - check for conditionals
    if (node.type === 'listItem' && currentStep) {
      const listItemNode = node as ListItem;
      // Get text from first paragraph child
      const firstParagraph = listItemNode.children.find(c => c.type === 'paragraph');
      if (firstParagraph) {
        const text = extractText(firstParagraph as Paragraph);
        const conditional = parseConditional(text);
        if (conditional) {
          pendingConditionals.push(conditional);
        }
      }
    }
  });

  // Finalize last step
  if (currentStep) {
    steps.push(finalizeStep(currentStep, pendingConditionals, implicitText));
  }

  // Validate workflow
  validateWorkflow(steps);

  return steps;
}

function finalizeStep(
  step: Partial<Step>,
  pendingConditionals: ParsedConditional[],
  implicitText: string
): Step {
  // Create implicit prompt if: no code block AND no explicit prompts
  if (!step.command && (!step.prompts || step.prompts.length === 0) && implicitText.trim()) {
    step.prompts = [{ text: implicitText.trim() }];
  }

  // Convert conditionals
  const conditions = convertConditionals(pendingConditionals);

  return {
    number: step.number!,
    description: step.description!,
    command: step.command,
    prompts: step.prompts || [],
    conditions: conditions || undefined,
  };
}

function validateWorkflow(steps: Step[]): void {
  // Validate non-empty
  if (steps.length === 0) {
    throw new WorkflowSyntaxError(
      "Workflow must contain at least one step (heading starting with '##')"
    );
  }

  // Validate sequential numbering
  for (let i = 0; i < steps.length; i++) {
    const expected = i + 1;
    if (steps[i].number !== expected) {
      throw new WorkflowSyntaxError(
        `Steps must be numbered sequentially. Expected step ${expected}, found step ${steps[i].number}.\n` +
        `Workflows must have exactly one algorithm with continuous numbering (1, 2, 3...).`
      );
    }
  }

  // Validate GOTO targets
  for (const step of steps) {
    if (step.conditions) {
      validateAction(step.conditions.pass, step.number, steps.length);
      validateAction(step.conditions.fail, step.number, steps.length);
    }
  }
}

function validateAction(action: Action, stepNum: number, totalSteps: number): void {
  if (action.type === 'GOTO') {
    const target = action.step as number;
    if (target < 1 || target > totalSteps) {
      throw new WorkflowSyntaxError(
        `Step ${stepNum}: GOTO target Step ${target} does not exist (workflow has ${totalSteps} steps)`
      );
    }
    if (target === stepNum) {
      throw new WorkflowSyntaxError(
        `Step ${stepNum}: GOTO self creates infinite loop (use RETRY instead)`
      );
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="parser/parser.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/parser/parser.ts plugin/hooks/hooks-app/__tests__/workflow/parser/parser.test.ts
git commit -m "$(cat <<'EOF'
feat(workflow): add markdown workflow parser

Parse workflow markdown into Step array with validation.
EOF
)"
```

---

### Task 2.4: Create parser module index

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/parser/index.ts`
- Modify: `plugin/hooks/hooks-app/src/workflow/index.ts`

**Step 1: Create parser index**

```typescript
// src/workflow/parser/index.ts
export { parseWorkflow } from './parser';
export { WorkflowSyntaxError } from './types';
export type { ParserState, ParsedConditional } from './types';
```

**Step 2: Update workflow index**

```typescript
// src/workflow/index.ts
export * from './types';
export { WorkflowStateManager } from './state';
export { parseWorkflow, WorkflowSyntaxError } from './parser';
```

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/parser/index.ts plugin/hooks/hooks-app/src/workflow/index.ts
git commit -m "$(cat <<'EOF'
feat(workflow): export parser from workflow module
EOF
)"
```

---

## Phase 3: Workflow CLI

### Task 3.1: Create CLI command structure

**Files:**
- Create: `plugin/hooks/hooks-app/src/cli/workflow-cli.ts`
- Test: `plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/cli/workflow-cli.test.ts
/**
 * CLI Integration Tests
 *
 * IMPORTANT: These tests require the project to be built first!
 * Run: npm run build
 *
 * These tests execute the compiled CLI binary (dist/cli/workflow-cli.js)
 * to verify end-to-end behavior.
 */
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';

describe('workflow CLI', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-cli-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  const runCli = (args: string): string => {
    const cliPath = join(__dirname, '../../dist/cli/workflow-cli.js');
    return execSync(`node ${cliPath} ${args}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: { ...process.env, TURBOSHOVEL_LOG: '0' },
    });
  };

  describe('workflow start', () => {
    test('creates workflow state from file', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP
`);

      const output = runCli(`start ${workflowPath}`);
      expect(output).toContain('Started workflow');
      expect(output).toContain('Step 1: First step');

      // Verify state file created
      const stateDir = join(testDir, '.claude/turboshovel/workflows');
      const files = await fs.readdir(stateDir);
      expect(files.length).toBe(1);
    });
  });

  describe('workflow status', () => {
    test('shows current workflow state', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`
`);

      runCli(`start ${workflowPath}`);
      const output = runCli('status');

      expect(output).toContain('test.workflow.md');
      expect(output).toContain('Step 1');
    });

    test('shows no active workflow message', () => {
      const output = runCli('status');
      expect(output).toContain('No active workflow');
    });
  });

  describe('workflow next', () => {
    test('advances to next step', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "first"
\`\`\`

- PASS: CONTINUE
- FAIL: STOP

## 2. Second step

\`\`\`bash
echo "second"
\`\`\`
`);

      runCli(`start ${workflowPath}`);
      const output = runCli('next');

      expect(output).toContain('Step 2: Second step');
    });

    test('shows done message on final step', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. Only step

\`\`\`bash
echo "done"
\`\`\`
`);

      runCli(`start ${workflowPath}`);
      const output = runCli('next');

      expect(output).toContain('complete');
    });
  });

  describe('workflow stop', () => {
    test('aborts current workflow', async () => {
      const workflowPath = join(testDir, 'test.workflow.md');
      await fs.writeFile(workflowPath, `
## 1. First step

\`\`\`bash
echo "test"
\`\`\`
`);

      runCli(`start ${workflowPath}`);
      const output = runCli('stop');

      expect(output).toContain('Stopped');

      // Status should show no active workflow
      const statusOutput = runCli('status');
      expect(statusOutput).toContain('No active workflow');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="cli/workflow-cli.test" --no-coverage`
Expected: FAIL with module not found

**Step 3: Write implementation**

```typescript
// src/cli/workflow-cli.ts
#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkflowStateManager } from '../workflow/state';
import { parseWorkflow, WorkflowSyntaxError } from '../workflow/parser';
import { createStepNumber, type Action, type Step, type WorkflowState } from '../workflow/types';

const program = new Command();

program
  .name('workflow')
  .description('Manage workflow execution')
  .version('1.0.0');

function getCwd(): string {
  return process.cwd();
}

program
  .command('start <file>')
  .description('Start a new workflow from a markdown file')
  .action(async (file: string) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      // Read and parse workflow file
      const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);
      const content = await fs.readFile(filePath, 'utf8');
      const steps = parseWorkflow(content);

      if (steps.length === 0) {
        console.error('Error: Workflow has no steps');
        process.exit(1);
      }

      // Create workflow state
      const workflowName = path.basename(file);
      const state = await manager.create(workflowName, steps[0].description);
      await manager.setActive(state.id);

      console.log(`Started workflow: ${workflowName}`);
      console.log(`ID: ${state.id}`);
      console.log(`Step 1: ${steps[0].description}`);
      printStepGuidance(steps[0]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`Error: Workflow file not found: ${file}`);
      } else if (error instanceof WorkflowSyntaxError) {
        console.error(`Syntax error: ${error.message}`);
      } else {
        console.error(`Error: ${(error as Error).message}`);
      }
      process.exit(1);
    }
  });

program
  .command('next')
  .description('Advance to the next step')
  .option('--step <n>', 'Jump to specific step (for GOTO)')
  .action(async (options: { step?: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      // Load workflow definition to get total steps
      const workflowPath = await findWorkflowFile(cwd, state.workflow);
      if (!workflowPath) {
        console.error(`Error: Workflow file ${state.workflow} not found`);
        process.exit(1);
      }

      const content = await fs.readFile(workflowPath, 'utf8');
      const steps = parseWorkflow(content);

      // Determine next step
      let nextStepNum: number;
      if (options.step) {
        nextStepNum = parseInt(options.step, 10);
      } else {
        nextStepNum = (state.step as number) + 1;
      }

      // Check if workflow is complete
      if (nextStepNum > steps.length) {
        console.log(`Workflow complete: ${state.workflow}`);
        await manager.setActive(null);
        return;
      }

      const nextStep = steps[nextStepNum - 1];
      const stepNumber = createStepNumber(nextStepNum);
      if (!stepNumber) {
        console.error('Error: Invalid step number');
        process.exit(1);
      }

      // Update state
      await manager.update(state.id, {
        step: stepNumber,
        stepName: nextStep.description,
        retryCount: 0,
      });

      console.log(`Step ${nextStepNum}: ${nextStep.description}`);
      printStepGuidance(nextStep);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('complete')
  .description('Mark current workflow as complete')
  .option('--status <status>', 'Completion status (ok|blocked)', 'ok')
  .action(async (options: { status: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      if (options.status === 'blocked') {
        await manager.update(state.id, {
          variables: { ...state.variables, blocked: true },
        });
        console.log(`Workflow BLOCKED: ${state.workflow}`);
      } else {
        await manager.setActive(null);
        console.log(`Workflow complete: ${state.workflow}`);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current workflow state')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      console.log(`Workflow: ${state.workflow}`);
      console.log(`ID: ${state.id}`);
      console.log(`Step ${state.step}: ${state.stepName}`);
      console.log(`Retry: ${state.retryCount}/${state.retryMax}`);

      if (Object.keys(state.variables).length > 0) {
        console.log('Variables:', JSON.stringify(state.variables, null, 2));
      }

      if (state.tasks.length > 0) {
        console.log(`Tasks: ${state.tasks.length}`);
        for (const task of state.tasks) {
          console.log(`  - ${task.id}: ${task.status}`);
        }
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Abort current workflow')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const state = await manager.getActive();

      if (!state) {
        console.log('No active workflow');
        return;
      }

      await manager.delete(state.id);
      await manager.setActive(null);
      console.log(`Stopped workflow: ${state.workflow}`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all workflows')
  .action(async () => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);
      const states = await manager.list();
      const active = await manager.getActive();

      if (states.length === 0) {
        console.log('No workflows');
        return;
      }

      for (const state of states) {
        const marker = active?.id === state.id ? ' (active)' : '';
        console.log(`${state.id}${marker}: ${state.workflow} - Step ${state.step}`);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

function printStepGuidance(step: Step): void {
  if (step.command) {
    console.log(`\nCommand: ${step.command.code}`);
  }

  if (step.prompts.length > 0) {
    console.log(`\nPrompt: ${step.prompts[0].text}`);
  }

  if (step.conditions) {
    console.log('\nConditions:');
    console.log(`  PASS: ${formatAction(step.conditions.pass)}`);
    console.log(`  FAIL: ${formatAction(step.conditions.fail)}`);
  }

  if (step.nestedWorkflow) {
    console.log(`\nNested workflow: ${step.nestedWorkflow}`);
  }
}

function formatAction(action: Action): string {
  switch (action.type) {
    case 'CONTINUE': return 'CONTINUE';
    case 'STOP': return action.message ? `STOP "${action.message}"` : 'STOP';
    case 'GOTO': return `GOTO ${action.step}`;
    case 'DONE': return 'DONE';
    case 'RETRY': return action.max ? `RETRY ${action.max}` : 'RETRY';
    default: return 'UNKNOWN';
  }
}

async function findWorkflowFile(cwd: string, filename: string): Promise<string | null> {
  // Check current directory
  const direct = path.join(cwd, filename);
  try {
    await fs.access(direct);
    return direct;
  } catch {
    // Not found
  }

  // Check .claude/workflows/
  const claudeDir = path.join(cwd, '.claude/workflows', filename);
  try {
    await fs.access(claudeDir);
    return claudeDir;
  } catch {
    // Not found
  }

  return null;
}

program.parse();
```

**Step 4: Add build script entry point**

Add to `plugin/hooks/hooks-app/package.json` in the `bin` section:

```json
{
  "bin": {
    "workflow": "dist/cli/workflow-cli.js"
  }
}
```

**Step 5: Build and run test**

Run: `cd plugin/hooks/hooks-app && npm run build && npm test -- --testPathPattern="cli/workflow-cli.test" --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add plugin/hooks/hooks-app/src/cli/workflow-cli.ts plugin/hooks/hooks-app/__tests__/cli/workflow-cli.test.ts plugin/hooks/hooks-app/package.json
git commit -m "$(cat <<'EOF'
feat(workflow): add workflow CLI tool

Commands: start, next, complete, status, stop, list. State persists across invocations.
EOF
)"
```

---

## Phase 4: Hook Integration

### Task 4.1: Add workflow context injection

**Files:**
- Modify: `plugin/hooks/hooks-app/src/context.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/context-integration.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/workflow/context-integration.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { WorkflowStateManager } from '../../src/workflow/state';
import { getWorkflowContext } from '../../src/workflow/context';
import { createStepNumber } from '../../src/workflow/types';

describe('Workflow Context Injection', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-context-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('returns null when no active workflow', async () => {
    const context = await getWorkflowContext(testDir);
    expect(context).toBeNull();
  });

  test('returns context for active workflow', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Run tests');
    await manager.setActive(state.id);

    const context = await getWorkflowContext(testDir);

    expect(context).not.toBeNull();
    expect(context).toContain('Active Workflow');
    expect(context).toContain('test.workflow.md');
    expect(context).toContain('Step 1');
    expect(context).toContain('Run tests');
  });

  test('includes BLOCKED warning when blocked', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Run tests');
    await manager.update(state.id, {
      variables: { has_blocked_task: true },
    });
    await manager.setActive(state.id);

    const context = await getWorkflowContext(testDir);

    expect(context).toContain('BLOCKED');
  });

  test('includes task progress', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.update(state.id, {
      tasks: [
        { id: 'task-1', status: 'complete' },
        { id: 'task-2', status: 'running' },
        { id: 'task-3', status: 'pending' },
      ],
    });
    await manager.setActive(state.id);

    const context = await getWorkflowContext(testDir);

    expect(context).toContain('1/3 complete');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="context-integration.test" --no-coverage`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

```typescript
// src/workflow/context.ts
import { WorkflowStateManager } from './state';
import type { WorkflowState, TaskState } from './types';

/**
 * Get workflow context for injection into agent prompts
 */
export async function getWorkflowContext(cwd: string): Promise<string | null> {
  const manager = new WorkflowStateManager(cwd);
  const state = await manager.getActive();

  if (!state) {
    return null;
  }

  return formatWorkflowContext(state);
}

function formatWorkflowContext(state: WorkflowState): string {
  const lines: string[] = [];

  lines.push('## Active Workflow');
  lines.push('');
  lines.push(`**Workflow:** ${state.workflow}`);
  lines.push(`**Step ${state.step}:** ${state.stepName}`);

  // Show retry info if relevant
  if (state.retryCount > 0) {
    lines.push(`**Attempt:** ${state.retryCount + 1} of ${state.retryMax}`);
  }

  // Show task progress if there are tasks
  if (state.tasks.length > 0) {
    const complete = state.tasks.filter(t => t.status === 'complete').length;
    const running = state.tasks.filter(t => t.status === 'running').length;
    const blocked = state.tasks.filter(t => t.status === 'blocked').length;

    lines.push('');
    lines.push(`**Tasks:** ${complete}/${state.tasks.length} complete`);

    if (running > 0) {
      lines.push(`  - ${running} running`);
    }
    if (blocked > 0) {
      lines.push(`  - ${blocked} blocked`);
    }
  }

  // Show variables
  if (Object.keys(state.variables).length > 0) {
    lines.push('');
    lines.push('**Variables:**');
    for (const [key, value] of Object.entries(state.variables)) {
      lines.push(`  - ${key}: ${value}`);
    }
  }

  // BLOCKED warning
  if (state.variables.has_blocked_task || state.variables.blocked) {
    lines.push('');
    lines.push('⚠️ **WORKFLOW BLOCKED** - Present options to user before continuing.');
  }

  // Next action guidance
  lines.push('');
  lines.push('**Actions:**');
  lines.push('- Continue: `workflow next`');
  lines.push('- Jump to step: `workflow next --step N`');
  lines.push('- Abort: `workflow stop`');

  return lines.join('\n');
}
```

**Step 4: Update workflow module index**

```typescript
// src/workflow/index.ts
export * from './types';
export { WorkflowStateManager } from './state';
export { parseWorkflow, WorkflowSyntaxError } from './parser';
export { getWorkflowContext } from './context';
```

**Step 5: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="context-integration.test" --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/context.ts plugin/hooks/hooks-app/__tests__/workflow/context-integration.test.ts plugin/hooks/hooks-app/src/workflow/index.ts
git commit -m "$(cat <<'EOF'
feat(workflow): add workflow context injection

Format active workflow state for injection into agent prompts.
EOF
)"
```

---

### Task 4.2: Integrate workflow context into dispatcher

**Files:**
- Modify: `plugin/hooks/hooks-app/src/dispatcher.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/dispatcher-integration.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/workflow/dispatcher-integration.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { dispatch } from '../../src/dispatcher';
import { WorkflowStateManager } from '../../src/workflow/state';
import type { HookInput } from '../../src/types';

describe('Dispatcher Workflow Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `dispatcher-workflow-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create minimal config
    await fs.mkdir(join(testDir, '.claude'), { recursive: true });
    await fs.writeFile(
      join(testDir, '.claude/gates.json'),
      JSON.stringify({ gates: {}, hooks: {} })
    );
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('includes workflow context in dispatch output', async () => {
    // Create active workflow
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Run tests');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'UserPromptSubmit',
      cwd: testDir,
      user_message: 'test prompt',
    };

    const result = await dispatch(input);

    expect(result.blockReason).toBeUndefined();
    expect(result.stopMessage).toBeUndefined();
    expect(result.context).toContain('Active Workflow');
    expect(result.context).toContain('test.workflow.md');
  });

  test('no workflow context when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'UserPromptSubmit',
      cwd: testDir,
      user_message: 'test prompt',
    };

    const result = await dispatch(input);

    expect(result.blockReason).toBeUndefined();
    // Should not contain workflow context
    expect(result.context || '').not.toContain('Active Workflow');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="dispatcher-integration.test" --no-coverage`
Expected: FAIL

**Step 3: Modify dispatcher.ts**

In `plugin/hooks/hooks-app/src/dispatcher.ts`, add workflow context injection:

Add import at top (use direct path to avoid circular dependency):
```typescript
import { getWorkflowContext } from './workflow/context';
```

In the `dispatch` function, after line 223 (after `injectContext()` call and `accumulatedContext` initialization), before line 225 (config loading):

```typescript
  // After line 223: let accumulatedContext = contextContent || '';

  // Inject workflow context if active
  const workflowContext = await getWorkflowContext(input.cwd);
  if (workflowContext) {
    accumulatedContext += '\n\n' + workflowContext;
  }

  // Before line 225: const config = await loadConfig(cwd);
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="dispatcher-integration.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/dispatcher.ts plugin/hooks/hooks-app/__tests__/workflow/dispatcher-integration.test.ts
git commit -m "$(cat <<'EOF'
feat(workflow): integrate workflow context into dispatcher

Active workflow context is now injected into all hook dispatches.
EOF
)"
```

---

### Task 4.3: Add Task tool tracking hook

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/hooks/task-tracker.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/hooks/task-tracker.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/workflow/hooks/task-tracker.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { trackTaskDispatch } from '../../../src/workflow/hooks/task-tracker';
import { WorkflowStateManager } from '../../../src/workflow/state';
import type { HookInput } from '../../../src/types';

describe('Task Tracker Hook', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `task-tracker-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('registers task when Task tool used', async () => {
    // Setup active workflow
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.setActive(state.id);

    // Note: HookInput doesn't provide tool_input, so we can only track
    // that a Task was dispatched, not which subagent type was used
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
    };

    await trackTaskDispatch(input);

    // Verify task was added
    const updated = await manager.getActive();
    expect(updated?.tasks).toHaveLength(1);
    expect(updated?.tasks[0].status).toBe('running');
    expect(updated?.tasks[0].id).toMatch(/^task-/);
  });

  test('does nothing when no active workflow', async () => {
    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Task',
    };

    // Should not throw
    await trackTaskDispatch(input);
  });

  test('does nothing for non-Task tools', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'PostToolUse',
      cwd: testDir,
      tool_name: 'Edit',
    };

    await trackTaskDispatch(input);

    const updated = await manager.getActive();
    expect(updated?.tasks).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="task-tracker.test" --no-coverage`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/workflow/hooks/task-tracker.ts
import { WorkflowStateManager } from '../state';
import type { HookInput } from '../../types';
import type { TaskState } from '../types';

function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `task-${timestamp}-${random}`;
}

/**
 * Track Task tool dispatches in workflow state
 *
 * Note: HookInput doesn't expose tool_input, so we cannot determine
 * which subagent type was used. We only track that a Task was dispatched.
 */
export async function trackTaskDispatch(input: HookInput): Promise<void> {
  // Only handle Task tool
  if (input.tool_name !== 'Task') {
    return;
  }

  const manager = new WorkflowStateManager(input.cwd);
  const state = await manager.getActive();

  // No active workflow, nothing to track
  if (!state) {
    return;
  }

  // Create task entry
  const task: TaskState = {
    id: generateTaskId(),
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  // Add task to state
  await manager.update(state.id, {
    tasks: [...state.tasks, task],
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="task-tracker.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/hooks/task-tracker.ts plugin/hooks/hooks-app/__tests__/workflow/hooks/task-tracker.test.ts
git commit -m "$(cat <<'EOF'
feat(workflow): add Task tool tracking hook

Track subagent dispatches in workflow state for progress monitoring.
EOF
)"
```

---

### Task 4.4: Add SubagentStop hook

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/hooks/subagent-stop.ts`
- Test: `plugin/hooks/hooks-app/__tests__/workflow/hooks/subagent-stop.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/workflow/hooks/subagent-stop.test.ts
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs/promises';
import { handleSubagentStop } from '../../../src/workflow/hooks/subagent-stop';
import { WorkflowStateManager } from '../../../src/workflow/state';
import type { HookInput } from '../../../src/types';

describe('SubagentStop Hook', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `subagent-stop-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('marks running task as complete on STATUS: OK', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.update(state.id, {
      tasks: [{ id: 'task-1', status: 'running', startedAt: new Date().toISOString() }],
    });
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      output: 'Task complete.\n\nSTATUS: OK',
    };

    const result = await handleSubagentStop(input);

    const updated = await manager.getActive();
    expect(updated?.tasks[0].status).toBe('complete');
    expect(result).toContain('complete');
  });

  test('marks running task as blocked on STATUS: BLOCKED', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.update(state.id, {
      tasks: [{ id: 'task-1', status: 'running', startedAt: new Date().toISOString() }],
    });
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      output: 'Cannot proceed.\n\nSTATUS: BLOCKED',
    };

    const result = await handleSubagentStop(input);

    const updated = await manager.getActive();
    expect(updated?.tasks[0].status).toBe('blocked');
    expect(updated?.variables.has_blocked_task).toBe(true);
    expect(result).toContain('BLOCKED');
  });

  test('returns guidance when all batch tasks done', async () => {
    const manager = new WorkflowStateManager(testDir);
    const state = await manager.create('test.workflow.md', 'Execute batch');
    await manager.update(state.id, {
      tasks: [
        { id: 'task-1', status: 'complete' },
        { id: 'task-2', status: 'running', startedAt: new Date().toISOString() },
      ],
    });
    await manager.setActive(state.id);

    const input: HookInput = {
      hook_event_name: 'SubagentStop',
      cwd: testDir,
      output: 'Done.\n\nSTATUS: OK',
    };

    const result = await handleSubagentStop(input);

    expect(result).toContain('workflow next');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="subagent-stop.test" --no-coverage`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/workflow/hooks/subagent-stop.ts
import { WorkflowStateManager } from '../state';
import type { HookInput } from '../../types';
import type { TaskState } from '../types';

/**
 * Parse STATUS field from subagent output
 */
function parseAgentStatus(output?: string): 'ok' | 'blocked' | null {
  if (!output) return null;

  // Look for STATUS: OK or STATUS: BLOCKED
  const match = output.match(/STATUS:\s*(OK|BLOCKED)/i);
  if (match) {
    return match[1].toLowerCase() as 'ok' | 'blocked';
  }

  return null;
}

/**
 * Handle subagent completion
 */
export async function handleSubagentStop(input: HookInput): Promise<string | undefined> {
  if (input.hook_event_name !== 'SubagentStop') {
    return undefined;
  }

  const manager = new WorkflowStateManager(input.cwd);
  const state = await manager.getActive();

  if (!state) {
    return undefined;
  }

  // Find running task
  const runningTaskIndex = state.tasks.findIndex(t => t.status === 'running');
  if (runningTaskIndex === -1) {
    return undefined;
  }

  // Parse status from output
  const status = parseAgentStatus(input.output);
  const isBlocked = status === 'blocked';

  // Update task
  const updatedTasks = [...state.tasks];
  updatedTasks[runningTaskIndex] = {
    ...updatedTasks[runningTaskIndex],
    status: isBlocked ? 'blocked' : 'complete',
    completedAt: new Date().toISOString(),
  };

  // Update state
  const variables = { ...state.variables };
  if (isBlocked) {
    variables.has_blocked_task = true;
  }

  await manager.update(state.id, { tasks: updatedTasks, variables });

  // Check if all tasks done
  const allDone = updatedTasks.every(t => t.status !== 'running' && t.status !== 'pending');

  if (isBlocked) {
    return `Task BLOCKED. Present options to user before continuing.`;
  }

  if (allDone) {
    return `All tasks in batch complete. Run: workflow next`;
  }

  return `Task complete. ${updatedTasks.filter(t => t.status === 'complete').length}/${updatedTasks.length} tasks done.`;
}
```

**Step 4: Run test to verify it passes**

Run: `cd plugin/hooks/hooks-app && npm test -- --testPathPattern="subagent-stop.test" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/hooks/subagent-stop.ts plugin/hooks/hooks-app/__tests__/workflow/hooks/subagent-stop.test.ts
git commit -m "$(cat <<'EOF'
feat(workflow): add SubagentStop hook

Track task completion and BLOCKED status from subagent output.
EOF
)"
```

---

### Task 4.5: Create workflow hooks module and integrate

**Files:**
- Create: `plugin/hooks/hooks-app/src/workflow/hooks/index.ts`
- Modify: `plugin/hooks/hooks-app/src/dispatcher.ts` to call workflow hooks

**Step 1: Create hooks index**

```typescript
// src/workflow/hooks/index.ts
export { trackTaskDispatch } from './task-tracker';
export { handleSubagentStop } from './subagent-stop';
```

**Step 2: Integrate into dispatcher**

In `plugin/hooks/hooks-app/src/dispatcher.ts`, add after the context injection:

Add import:
```typescript
import { trackTaskDispatch, handleSubagentStop } from './workflow/hooks';
```

In the dispatch function, after workflow context injection:

```typescript
// Workflow hooks
if (input.hook_event_name === 'PostToolUse' && input.tool_name === 'Task') {
  await trackTaskDispatch(input);
}

if (input.hook_event_name === 'SubagentStop') {
  const subagentContext = await handleSubagentStop(input);
  if (subagentContext) {
    accumulatedContext += '\n\n' + subagentContext;
  }
}
```

**Step 3: Run full test suite**

Run: `cd plugin/hooks/hooks-app && npm test --no-coverage`
Expected: All tests pass

**Step 4: Commit**

```bash
git add plugin/hooks/hooks-app/src/workflow/hooks/index.ts plugin/hooks/hooks-app/src/dispatcher.ts
git commit -m "$(cat <<'EOF'
feat(workflow): integrate workflow hooks into dispatcher

Task tracking and SubagentStop handling now automatic in dispatch pipeline.
EOF
)"
```

---

## Phase 5: Final Integration

### Task 5.1: Add workflow CLI to plugin hooks

**Files:**
- Modify: `plugin/hooks/hooks.json` to add workflow CLI as hook output

**Step 1: Verify hooks.json exists and add bin reference**

The `workflow` command should be available when the plugin is installed.

**Step 2: Build and verify**

Run: `cd plugin/hooks/hooks-app && npm run build && npm run lint && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add plugin/hooks/hooks-app/
git commit -m "$(cat <<'EOF'
feat(workflow): complete workflow system implementation

Phase 1-5 complete: types, state, parser, CLI, hooks integrated.
EOF
)"
```

---

### Task 5.2: Create example workflows

**Files:**
- Create: `plugin/hooks/examples/execute.workflow.md`
- Create: `plugin/hooks/examples/code-review.workflow.md`

**Step 1: Create execute workflow example**

```markdown
# Execute Workflow

Execute implementation plans in controlled batches with review checkpoints.

## 1. Load plan

Load plan from path or discover in `.work/` directory.

Read plan file and review critically for questions or concerns.

- PASS: CONTINUE
- FAIL: STOP "No plan file found."

## 2. Create tracking

Create TodoWrite tracking items for plan tasks.

- PASS: CONTINUE
- FAIL: STOP "Could not create task tracking."

## 3. Execute batch

Execute next batch of tasks (3 tasks per batch).

Dispatch subagent for each task with embedded following-plans skill.

- PASS: CONTINUE
- BLOCKED: STOP "Agent reported BLOCKED. Escalate to user."
- FAIL: RETRY 3

## 4. Review batch

Dispatch code-review-agent to review batch implementation.

- PASS: CONTINUE
- FAIL: STOP "BLOCKING issues found. Fix before continuing."

## 5. Report progress

Show what was implemented. Say: "Ready for feedback."

- PASS: CONTINUE

## 6. Check progress

- IF: more_batches
  - GOTO: 3
- ELSE: CONTINUE

## 7. Complete

Verify tests pass. Present completion options.

- PASS: DONE
- FAIL: STOP "Tests failing. Fix before completing."
```

**Step 2: Create code-review workflow example**

```markdown
# Code Review Workflow

Dispatch code-review-agent to review implementation.

## 1. Dispatch reviewer

Dispatch code-review-agent subagent.

- PASS: CONTINUE
- FAIL: RETRY 1

## 2. Categorize issues

Categorize feedback as BLOCKING or NON-BLOCKING.

- PASS: CONTINUE
- FAIL: STOP "Could not categorize issues."

## 3. Handle blocking issues

- IF: has_blocking_issues
  - STOP "BLOCKING issues found. Fix before continuing."
- ELSE: CONTINUE

## 4. Address feedback

Address NON-BLOCKING feedback or defer with justification.

- PASS: DONE
```

**Step 3: Commit**

```bash
git add plugin/hooks/examples/
git commit -m "$(cat <<'EOF'
docs(workflow): add example workflow files

Execute and code-review workflow examples for reference.
EOF
)"
```

---

### Task 5.3: Update documentation

**Files:**
- Modify: `plugin/hooks/README.md`
- Modify: `CLAUDE.md`

**Step 1: Add workflow section to README**

Add to `plugin/hooks/README.md`:

```markdown
## Workflow System

Turboshovel includes an executable workflow system that makes skills enforceable.

### Quick Start

```bash
# Start a workflow
workflow start execute.workflow.md

# Check status
workflow status

# Advance to next step
workflow next

# Stop workflow
workflow stop
```

### Workflow Syntax

Workflows are markdown files with numbered steps:

```markdown
## 1. Run tests

\`\`\`bash
npm test
\`\`\`

- PASS: CONTINUE
- FAIL: STOP "Tests failed"

## 2. Check coverage

Review coverage report.

- PASS: CONTINUE
- FAIL: GOTO 1
```

### Actions

| Action | Description |
|--------|-------------|
| `CONTINUE` | Proceed to next step |
| `STOP [message]` | End workflow with failure |
| `DONE` | End workflow with success |
| `GOTO N` | Jump to step N |
| `RETRY [N]` | Retry current step (max N times) |

See `examples/` for full workflow examples.
```

**Step 2: Update CLAUDE.md**

Add workflow section:

```markdown
## Workflow System

Execute multi-step processes with state tracking:

- `workflow start <file>` - Start workflow
- `workflow next` - Advance to next step
- `workflow status` - Show current state
- `workflow stop` - Abort workflow

State persists in `.claude/turboshovel/workflows/` and survives context clears.
```

**Step 3: Commit**

```bash
git add plugin/hooks/README.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: add workflow system documentation

Quick start, syntax reference, and action descriptions.
EOF
)"
```

---

## Summary

This plan implements the turboshovel workflow system in 5 phases:

1. **Core Types & State** - Type definitions and state manager
2. **Parser** - Markdown workflow parser using mdast-util-from-markdown with AST walking (mirrors Rust pulldown-cmark)
3. **CLI** - `workflow` command with start/next/complete/status/stop
4. **Hook Integration** - Task tracking, SubagentStop handling, context injection
5. **Final Integration** - Examples and documentation

Each task follows TDD with exact file paths, complete code, and frequent commits. Total: ~25 tasks.
