# Test Coverage Improvements Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Increase test coverage for context.ts, dispatcher.ts, and workflow/parser/helpers.ts

**Architecture:** Add targeted unit tests for uncovered code paths, focusing on error handling, edge cases, and branching logic

**Tech Stack:** TypeScript, Jest, fast-check (for property tests where applicable)

---

## Task 1: Add parseAction Edge Case Tests

**Files:**
- Modify: `__tests__/workflow/parser/helpers.test.ts`

**Step 1: Add tests for uncovered parseAction variants**

Add to existing `parseAction` describe block:

```typescript
describe('parseAction edge cases', () => {
  it('parses RETRY without max', () => {
    expect(parseAction('RETRY')).toEqual({ type: 'RETRY' });
  });

  it('parses RETRY with max', () => {
    expect(parseAction('RETRY 3')).toEqual({ type: 'RETRY', max: 3 });
  });

  it('returns null for RETRY with invalid max', () => {
    expect(parseAction('RETRY abc')).toBeNull();
  });

  it('parses GOTO with valid task number', () => {
    expect(parseAction('GOTO 5')).toEqual({ type: 'GOTO', task: 5 });
  });

  it('returns null for GOTO with invalid task number', () => {
    expect(parseAction('GOTO 0')).toBeNull();
    expect(parseAction('GOTO -1')).toBeNull();
  });

  it('parses old syntax Continue', () => {
    expect(parseAction('Continue')).toEqual({ type: 'CONTINUE' });
  });

  it('parses old syntax STOP with parentheses', () => {
    expect(parseAction('STOP (error message)')).toEqual({ type: 'STOP', message: 'error message' });
  });

  it('parses DONE', () => {
    expect(parseAction('DONE')).toEqual({ type: 'DONE' });
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --testPathPattern=helpers.test`
Expected: PASS

**Step 3: Commit**

```bash
git add __tests__/workflow/parser/helpers.test.ts
git commit -m "test(parser): add parseAction edge case coverage"
```

---

## Task 2: Add resolveAggregationMode Error Tests

**Files:**
- Modify: `__tests__/workflow/parser/helpers.test.ts`

**Step 1: Add tests for invalid aggregation combinations**

```typescript
describe('convertConditionals aggregation', () => {
  it('accepts PASS ALL + FAIL ANY (pessimistic)', () => {
    const result = convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: 'ALL' },
      { type: 'fail', action: { type: 'STOP' }, modifier: 'ANY' }
    ]);
    expect(result).toEqual({
      all: true,
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP' }
    });
  });

  it('accepts PASS ANY + FAIL ALL (optimistic)', () => {
    const result = convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: 'ANY' },
      { type: 'fail', action: { type: 'STOP' }, modifier: 'ALL' }
    ]);
    expect(result).toEqual({
      all: false,
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP' }
    });
  });

  it('throws on invalid PASS ALL + FAIL ALL', () => {
    expect(() => convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: 'ALL' },
      { type: 'fail', action: { type: 'STOP' }, modifier: 'ALL' }
    ])).toThrow('Invalid aggregation combination');
  });

  it('throws on invalid PASS ANY + FAIL ANY', () => {
    expect(() => convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: 'ANY' },
      { type: 'fail', action: { type: 'STOP' }, modifier: 'ANY' }
    ])).toThrow('Invalid aggregation combination');
  });

  it('defaults pass-only to STOP on fail', () => {
    const result = convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' }, modifier: null }
    ]);
    expect(result?.fail).toEqual({ type: 'STOP' });
  });

  it('defaults fail-only to CONTINUE on pass', () => {
    const result = convertConditionals([
      { type: 'fail', action: { type: 'STOP' }, modifier: null }
    ]);
    expect(result?.pass).toEqual({ type: 'CONTINUE' });
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --testPathPattern=helpers.test`
Expected: PASS

**Step 3: Commit**

```bash
git add __tests__/workflow/parser/helpers.test.ts
git commit -m "test(parser): add convertConditionals aggregation coverage"
```

---

## Task 3: Add extractSubtaskHeader Tests

**Files:**
- Modify: `__tests__/workflow/parser/helpers.test.ts`

**Step 1: Add tests for subtask header parsing**

```typescript
describe('extractSubtaskHeader', () => {
  it('parses standard subtask', () => {
    const result = extractSubtaskHeader('1.A First reviewer');
    expect(result).toEqual({
      taskNumber: 1,
      id: 'A',
      description: 'First reviewer',
      agentType: undefined,
      isDynamic: false
    });
  });

  it('parses subtask with agent type', () => {
    const result = extractSubtaskHeader('2.B Review code (code-agent)');
    expect(result).toEqual({
      taskNumber: 2,
      id: 'B',
      description: 'Review code',
      agentType: 'code-agent',
      isDynamic: false
    });
  });

  it('parses dynamic subtask pattern', () => {
    const result = extractSubtaskHeader('3.{n} Execute task');
    expect(result).toEqual({
      taskNumber: 3,
      id: '{n}',
      description: 'Execute task',
      agentType: undefined,
      isDynamic: true
    });
  });

  it('normalizes lowercase subtask id to uppercase', () => {
    const result = extractSubtaskHeader('1.a lowercase id');
    expect(result?.id).toBe('A');
  });

  it('returns null for invalid task number', () => {
    expect(extractSubtaskHeader('0.A Invalid')).toBeNull();
  });

  it('returns null for malformed header', () => {
    expect(extractSubtaskHeader('Not a subtask')).toBeNull();
    expect(extractSubtaskHeader('1A Missing dot')).toBeNull();
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --testPathPattern=helpers.test`
Expected: PASS

**Step 3: Commit**

```bash
git add __tests__/workflow/parser/helpers.test.ts
git commit -m "test(parser): add extractSubtaskHeader coverage"
```

---

## Task 4: Add Dispatcher Error Path Tests

**Files:**
- Modify: `__tests__/dispatcher.test.ts`

**Step 1: Add tests for dispatcher edge cases**

```typescript
describe('dispatcher error paths', () => {
  describe('gateMatchesFilePattern', () => {
    it('returns false for invalid glob pattern', async () => {
      const gateConfig = {
        command: 'echo test',
        file_patterns: ['[invalid-glob']
      };
      const result = await gateMatchesFilePattern(gateConfig, '/some/file.ts', '/project');
      expect(result).toBe(false);
    });

    it('returns true when no file_patterns configured', async () => {
      const gateConfig = { command: 'echo test' };
      const result = await gateMatchesFilePattern(gateConfig, '/some/file.ts', '/project');
      expect(result).toBe(true);
    });

    it('returns false when no file path provided', async () => {
      const gateConfig = {
        command: 'echo test',
        file_patterns: ['**/*.ts']
      };
      const result = await gateMatchesFilePattern(gateConfig, undefined, '/project');
      expect(result).toBe(false);
    });

    it('handles relative file paths', async () => {
      const gateConfig = {
        command: 'echo test',
        file_patterns: ['src/**/*.ts']
      };
      const result = await gateMatchesFilePattern(gateConfig, 'src/index.ts', '/project');
      expect(result).toBe(true);
    });
  });

  describe('gateMatchesKeywords', () => {
    it('returns true when no keywords configured', () => {
      const gateConfig = { command: 'echo test' };
      expect(gateMatchesKeywords(gateConfig, 'any message')).toBe(true);
    });

    it('returns false when no user message', () => {
      const gateConfig = { command: 'echo test', keywords: ['test'] };
      expect(gateMatchesKeywords(gateConfig, undefined)).toBe(false);
    });

    it('matches case-insensitively', () => {
      const gateConfig = { command: 'echo test', keywords: ['TEST'] };
      expect(gateMatchesKeywords(gateConfig, 'run test now')).toBe(true);
    });
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --testPathPattern=dispatcher.test`
Expected: PASS

**Step 3: Commit**

```bash
git add __tests__/dispatcher.test.ts
git commit -m "test(dispatcher): add error path coverage"
```

---

## Task 5: Add Context Discovery Tests

**Files:**
- Modify: `__tests__/context.test.ts`

**Step 1: Add tests for context discovery edge cases**

```typescript
describe('extractNameAndStage coverage', () => {
  // Note: injectContext internally uses extractNameAndStage
  // We test via injectContext since extractNameAndStage is not exported

  it('handles SlashCommandStart', async () => {
    const input = {
      hook_event_name: 'SlashCommandStart',
      cwd: testDir,
      command: '/commit'
    };
    // Creates .claude/context/commit-start.md
    await fs.mkdir(path.join(testDir, '.claude', 'context'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.claude', 'context', 'commit-start.md'),
      'Start content'
    );
    const result = await injectContext('SlashCommandStart', input);
    expect(result).toBe('Start content');
  });

  it('handles SlashCommandEnd', async () => {
    const input = {
      hook_event_name: 'SlashCommandEnd',
      cwd: testDir,
      command: '/commit'
    };
    await fs.mkdir(path.join(testDir, '.claude', 'context'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.claude', 'context', 'commit-end.md'),
      'End content'
    );
    const result = await injectContext('SlashCommandEnd', input);
    expect(result).toBe('End content');
  });

  it('handles SkillStart', async () => {
    const input = {
      hook_event_name: 'SkillStart',
      cwd: testDir,
      skill: 'cipherpowers:brainstorm'
    };
    await fs.mkdir(path.join(testDir, '.claude', 'context'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.claude', 'context', 'brainstorm-start.md'),
      'Skill start'
    );
    const result = await injectContext('SkillStart', input);
    expect(result).toBe('Skill start');
  });

  it('handles UserPromptSubmit', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      cwd: testDir
    };
    await fs.mkdir(path.join(testDir, '.claude', 'context'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.claude', 'context', 'prompt-submit.md'),
      'Prompt context'
    );
    const result = await injectContext('UserPromptSubmit', input);
    expect(result).toBe('Prompt context');
  });

  it('returns null for unknown hook event', async () => {
    const input = {
      hook_event_name: 'UnknownEvent',
      cwd: testDir
    };
    const result = await injectContext('UnknownEvent', input);
    expect(result).toBeNull();
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --testPathPattern=context.test`
Expected: PASS

**Step 3: Commit**

```bash
git add __tests__/context.test.ts
git commit -m "test(context): add hook event coverage"
```

---

## Task 6: Run Full Coverage and Verify

**Step 1: Run tests with coverage**

Run: `npm test -- --coverage`
Expected: Coverage improved for context.ts, dispatcher.ts, helpers.ts

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Commit any formatting changes**

```bash
git add -A && git commit -m "style: format test files" || echo "Nothing to commit"
```

---

## Verification Checklist

| Check | Command |
|-------|---------|
| All tests pass | `npm test` |
| Coverage improved | `npm test -- --coverage` |
| Lint clean | `npm run lint` |

---

## Critical Files

- `__tests__/workflow/parser/helpers.test.ts` - Parser helper tests
- `__tests__/dispatcher.test.ts` - Dispatcher tests
- `__tests__/context.test.ts` - Context injection tests
