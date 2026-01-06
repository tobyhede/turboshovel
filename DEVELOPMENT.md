# Development Guide

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
# Clone and install
git clone <repo-url>
cd turboshovel
npm install
```

## Commands

All commands run from the repository root:

```bash
# Build all packages
npm run build

# Run all tests
npm run test

# Lint all packages
npm run lint

# Auto-fix lint issues
npm run lint:fix
```

### Package-specific commands

```bash
# Build specific package
npm run build -w packages/shared
npm run build -w packages/cli
npm run build -w plugin/core

# Test specific package
npm run test -w packages/shared
npm run test -w plugin/core

# Lint specific package
npm run lint -w plugin/core
```

## Project Structure

```
turboshovel/
├── packages/
│   ├── shared/          # Shared types, schemas, utilities
│   │   ├── src/
│   │   └── __tests__/
│   └── cli/             # CLI tool (@turboshovel/cli)
│       └── src/
├── plugin/
│   └── core/            # Claude Code plugin (@turboshovel/core)
│       ├── src/
│       └── __tests__/
├── eslint.config.js     # ESLint 9 flat config
├── tsconfig.eslint.json # TypeScript config for linting
└── package.json         # Workspace root
```

## Development Workflow

1. **Make changes** in `src/` directories
2. **Build** to check for TypeScript errors: `npm run build`
3. **Test** to verify behavior: `npm run test`
4. **Lint** to check code quality: `npm run lint`

## Testing

Tests use Jest with ESM support. **Important:** Test coverage is not a proxy for confidence—significant workflow bugs have shipped with passing tests. Use multiple test strategies and manual verification for critical paths.

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode (per-package)
cd packages/shared && npm test -- --watch

# Run specific test file
cd plugin/core && npm test -- __tests__/session.test.ts

# Run tests matching pattern
npm test -w plugin/core -- --testNamePattern="dispatch"

# Run with coverage
npm test -- --coverage
```

### Test Inventory

The project uses multiple testing strategies, each with different strengths:

| Strategy | Location | Purpose | Confidence Level |
|----------|----------|---------|------------------|
| Unit Tests | `*.test.ts` | Isolated function behavior | Medium - tests what you think, not what happens |
| Property Tests | `*.properties.test.ts` | Invariant discovery | High - finds edge cases you didn't anticipate |
| Integration Tests | `*.integration.test.ts` | Component interaction | High - tests real behavior |
| CLI Integration | `packages/cli/__tests__/` | End-to-end CLI flows | Highest - tests actual user experience |
| Manual Tests | `INTEGRATION_TESTS.md` | Real agent behavior | Critical - only way to test hook integration |

### Test Categories

#### 1. Unit Tests

Isolated tests for pure functions with mocked dependencies.

**Example:** `plugin/core/__tests__/dispatcher.test.ts`

```typescript
describe('Keyword Matching', () => {
  test('no keywords - gate always runs', () => {
    const gateConfig: GateConfig = { command: 'npm test' };
    expect(gateMatchesKeywords(gateConfig, 'hello world')).toBe(true);
  });
});
```

**When to use:** Testing pure functions, schema validation, parsing logic.

**Limitations:** Mocks can drift from reality. A unit test passing doesn't mean the integrated system works.

#### 2. Property-Based Tests (fast-check)

Generate random inputs to discover invariants and edge cases.

**Example:** `plugin/core/__tests__/session.properties.test.ts`

```typescript
import fc from 'fast-check';

it('roundtrips session state through save/load', async () => {
  await fc.assert(
    fc.asyncProperty(sessionStateArb, async (state) => {
      const session = new Session(testDir);
      await session.set('active_command', state.active_command);
      const loaded = await session.get('active_command');
      expect(loaded).toEqual(state.active_command);
    }),
    { numRuns: 50 }
  );
});
```

**When to use:** 
- State serialization/deserialization
- Parser robustness
- ID generation uniqueness
- Schema validation

**Writing property tests:**
1. Define arbitraries (generators) for your domain types
2. Express invariants that should always hold
3. Use `numRuns` appropriate to complexity (50-200 typical)

#### 3. Integration Tests

Test real component interactions without mocks.

**Example:** `plugin/core/__tests__/workflow/dispatcher-integration.test.ts`

```typescript
test('includes workflow context in dispatch output', async () => {
  const manager = new WorkflowStateManager(testDir);
  const state = await manager.create('test.runbook.md', mockSteps);
  await manager.setActive(state.id);

  const input: HookInput = {
    hook_event_name: 'UserPromptSubmit',
    cwd: testDir,
    user_message: 'test prompt'
  };

  const result = await dispatch(input);
  expect(result.context).toContain('Active Workflow');
});
```

**When to use:** Testing state transitions, file system interactions, component communication.

#### 4. CLI Integration Tests

Full end-to-end tests via subprocess execution.

**Example:** `packages/cli/__tests__/integration.test.ts`

```typescript
it('completes simple two-step workflow', async () => {
  let result = runCli('run runbooks/simple.runbook.md', workspace);
  expect(result.exitCode).toBe(0);
  
  result = runCli('next', workspace);
  expect(result.stdout).toContain('Step 2');
  
  result = runCli('next', workspace);
  expect(result.stdout).toContain('complete');
});
```

**Test utilities:** See `packages/cli/__tests__/helpers/test-utils.ts` for:
- `createTestWorkspace()` - Isolated temp directory with fixtures
- `runCli(args, workspace)` - Execute CLI in workspace
- `readSession(workspace)` - Read session state
- `getActiveState(workspace)` - Get active workflow state

#### 5. Manual Integration Tests

Testing with real Claude Code agents. **Required before releases.**

See `INTEGRATION_TESTS.md` for scenarios:
- PostToolUse hook triggers
- SubagentStop hook triggers  
- Gate chaining behavior
- BLOCK/CONTINUE actions
- Tool/agent filtering

### Test Fixtures

Workflow fixtures in `packages/cli/__tests__/fixtures/`:

| Fixture | Purpose |
|---------|---------|
| `simple.runbook.md` | Basic two-task flow |
| `retry.runbook.md` | RETRY condition handling |
| `goto.runbook.md` | GOTO navigation |
| `fail-goto.runbook.md` | FAIL with GOTO |
| `subtasks.runbook.md` | Nested subtask structure |

**Adding fixtures:**
1. Create `.runbook.md` file in fixtures directory
2. Fixtures are auto-copied to test workspaces
3. Reference via `workspace.workflowPath('name.runbook.md')`

### Known Testing Gaps

Current test suite has gaps in these areas:

1. **Concurrent agent execution** - Tests don't verify parallel agent behavior
2. **State corruption recovery** - Limited testing of malformed state files
3. **Hook timing** - No tests for race conditions in hook dispatch
4. **Long-running workflows** - No tests for workflows spanning multiple sessions
5. **Child workflow lifecycle** - Limited coverage of parent-child workflow transitions

When working in these areas, add both automated tests AND manual verification.

### Test-Driven Bug Fixes

When fixing bugs:

1. **Write failing test first** - Reproduce the bug in a test
2. **Verify test fails** - Run test, confirm it captures the bug
3. **Fix the bug** - Make minimal changes
4. **Verify test passes** - Run test, confirm fix works
5. **Consider property test** - If bug was an edge case, add property test to find similar issues

### Coverage vs Confidence

**Coverage metrics lie.** A file can have 100% line coverage while missing critical behavior:

```typescript
// 100% covered but wrong
function advanceStep(state) {
  state.step++;  // Covered!
  return state;  // Covered!
}
// Missing: bounds checking, substep handling, GOTO evaluation
```

**Focus on:**
- Property tests for state management
- Integration tests for critical paths
- Manual tests before releases
- Tests that encode bug reports

## Code Style

- ESLint 9 with typescript-eslint (strictest rules)
- Explicit return types on exported functions
- Type imports use `import type` syntax
- Test files have relaxed rules for mocking flexibility

## Build Order

Packages must be built in dependency order:

1. `packages/shared` (no dependencies)
2. `packages/cli` (depends on shared)
3. `plugin/core` (depends on shared)

The root `npm run build` handles this automatically.

## Docker Integration Test

Test the full installation flow in an isolated Docker environment:

```bash
# Test local packages (pre-publish verification)
npm run verify:claude

# Test npm packages (post-publish smoke test)
npm run verify:claude:npm
```

This builds a Docker container with Node 22 and Claude Code, installs the CLI and plugin, then launches an interactive Claude session. Auth is persisted in `.claude-docker/`.

## Package Dependencies

### Workspace Protocol

Internal package dependencies use `*` instead of `workspace:*`:

```json
"dependencies": {
  "@turboshovel/shared": "*"
}
```

**Rationale:** The `workspace:*` protocol is a pnpm/yarn convention that npm doesn't fully support. When publishing to npm, `workspace:*` references cause installation failures because npm doesn't resolve them. Using `*` works with both local development (npm workspaces resolve to local packages) and published packages (npm resolves to published versions).

This was discovered during npm publish testing where `workspace:*` caused `ERESOLVE` errors for users installing from npm registry.
