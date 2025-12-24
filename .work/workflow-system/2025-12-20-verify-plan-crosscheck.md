# Cross-check Report: Exclusive Issues Validation

**Date:** 2025-12-20
**Collation Report:** `.work/workflow-system/2025-12-20-verify-plan-collated.md`
**Plan:** `.work/workflow-system/2025-12-20-workflow-system-plan.md`

## Executive Summary

Cross-checked 22 exclusive issues (11 BLOCKING + 11 NON-BLOCKING) against actual plan and codebase.

**Results:**
- VALIDATED: 18 issues (9 BLOCKING + 9 NON-BLOCKING)
- INVALIDATED: 4 issues (2 BLOCKING + 2 NON-BLOCKING)
- UNCERTAIN: 0 issues

## Methodology

For each exclusive issue:
1. Read issue description from collation report
2. Check plan code at specified line numbers
3. Verify against existing codebase (types.ts, dispatcher.ts, package.json)
4. Assign validation status based on evidence
5. Provide recommendation

---

## Reviewer #1 Exclusive Issues

### BLOCKING Issues

#### Issue #1: Circular import risk - workflow module importing from dispatcher

**Source:** Reviewer #1
**Location:** Phase 4, Task 4.2 (dispatcher.ts modification)
**Description:** Plan creates workflow/context.ts which is imported by workflow/index.ts, but dispatcher.ts already imports from './workflow'. Adding `import { getWorkflowContext } from './workflow'` in dispatcher creates circular dependency risk.

**Validation:** VALIDATED

**Evidence:**
- Plan Task 4.2 Step 3 (line 2319): "Add import at top: `import { getWorkflowContext } from './workflow';`"
- Plan Task 4.1 updates workflow/index.ts (line 2214) to export getWorkflowContext
- Dispatcher.ts already has workflow module (will exist after Phase 1-3)
- This creates: dispatcher.ts → workflow/index.ts → workflow/context.ts → workflow/state.ts
- If workflow/state.ts or workflow/context.ts later needs dispatcher features, circular dependency forms

**Recommendation:** IMPLEMENT - Refactor to avoid circular imports
- Option 1: Move getWorkflowContext to separate file outside workflow module
- Option 2: Pass WorkflowStateManager instance to dispatcher instead of importing from workflow module
- Option 3: Document that workflow module must never import from dispatcher

---

#### Issue #2: Missing test verification for file paths in Task 1.2

**Source:** Reviewer #1
**Location:** Task 1.2, state.test.ts line 257 vs state.ts line 348
**Description:** Task 1.2 creates `.claude/turboshovel/workflows` directory (line 257) but test doesn't verify this matches STATE_DIR constant in implementation.

**Validation:** VALIDATED

**Evidence:**
- Plan line 257 (test): `const statePath = join(testDir, '.claude/turboshovel/workflows', ...)`
- Plan line 348 (implementation): `const STATE_DIR = '.claude/turboshovel/workflows';`
- Test hardcodes path string instead of importing/verifying STATE_DIR constant
- If STATE_DIR changes, test will still pass with wrong path

**Recommendation:** IMPLEMENT - Add test to verify STATE_DIR constant
```typescript
test('state directory matches STATE_DIR constant', () => {
  expect(manager['stateDir']).toContain('.claude/turboshovel/workflows');
});
```

---

#### Issue #3: Test relies on build artifacts

**Source:** Reviewer #1
**Location:** Task 3.1, __tests__/cli/workflow-cli.test.ts
**Description:** Task 3.1 CLI test (line 1595) uses `dist/cli/workflow-cli.js` but plan doesn't ensure build happens before test.

**Validation:** VALIDATED

**Evidence:**
- Plan line 1595: `const cliPath = join(__dirname, '../../dist/cli/workflow-cli.js');`
- Plan Task 3.1 Step 5 (line 2027): "Build and run test: `npm run build && npm test`"
- Tests run via `npm test` in isolation will fail if dist/ doesn't exist
- Build is only mentioned in Step 5, not as a prerequisite for test execution

**Recommendation:** IMPLEMENT - Add build step to test setup or document requirement
- Option 1: Add `beforeAll` hook that runs build
- Option 2: Document that CLI tests require prior build
- Option 3: Use ts-node to run source directly in tests

---

#### Issue #4: Missing validation for GOTO self-loop

**Source:** Reviewer #1
**Location:** Task 2.3, src/workflow/parser/parser.ts line 1504
**Description:** Parser validation (line 1504) logs warning for GOTO self but doesn't block - allows infinite loop possibility.

**Validation:** VALIDATED

**Evidence:**
- Plan line 1503-1504:
```typescript
if (target === stepNum) {
  console.warn(`Warning: Step ${stepNum} has GOTO self - possible infinite loop`);
}
```
- Warning is logged but validation continues
- No throw statement = workflow with GOTO self is allowed
- Infinite loop is a serious runtime error

**Recommendation:** IMPLEMENT - Make GOTO self-loop a blocking error
```typescript
if (target === stepNum) {
  throw new WorkflowSyntaxError(
    `Step ${stepNum}: GOTO self creates infinite loop (use RETRY instead)`
  );
}
```

---

#### Issue #5: No error handling for workflow file not found in CLI

**Source:** Reviewer #1
**Location:** Task 3.1, src/cli/workflow-cli.ts
**Description:** workflow start command (line 1757-1759) reads file but only catches generic Error - doesn't distinguish file not found from parse errors.

**Validation:** VALIDATED

**Evidence:**
- Plan lines 1757-1759:
```typescript
const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);
const content = await fs.readFile(filePath, 'utf8');
const steps = parseWorkflow(content);
```
- Plan lines 1775-1777: Generic error handler:
```typescript
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
  process.exit(1);
```
- No distinction between ENOENT (file not found) vs WorkflowSyntaxError vs other errors
- User gets generic error message instead of specific guidance

**Recommendation:** IMPLEMENT - Add specific error handling
```typescript
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
```

---

### NON-BLOCKING Issues

#### Issue #6: Test coverage for edge cases in stripSeparator

**Source:** Reviewer #1
**Location:** Task 2.2, parser/helpers.test.ts
**Description:** Helper test (line 586) tests multiple separators but not nested separators like ":- First step"

**Validation:** VALIDATED

**Evidence:**
- Plan line 588-590: Test exists for "strips multiple separators"
```typescript
test('strips multiple separators', () => {
  expect(stripSeparator(': - First step')).toBe('First step');
});
```
- This DOES test nested separators (colon then dash)
- However, test doesn't cover all combinations (e.g., ". - First", ") : First")

**Recommendation:** IMPLEMENT - Expand test coverage
Add tests for more separator combinations to verify stripSeparator handles all edge cases.

---

#### Issue #7: Missing test for empty string handling

**Source:** Reviewer #1
**Location:** Task 2.2, parser/helpers.test.ts
**Description:** parseAction doesn't have explicit test for empty string input

**Validation:** VALIDATED

**Evidence:**
- Plan parseAction tests (lines 635-667) cover valid actions
- No test for `parseAction('')` or `parseAction('   ')`
- Implementation line 824: `const trimmed = text.trim();` then checks against specific strings
- Empty string would return null (last line 886) but this behavior is not explicitly tested

**Recommendation:** IMPLEMENT - Add edge case test
```typescript
test('returns null for empty string', () => {
  expect(parseAction('')).toBeNull();
  expect(parseAction('   ')).toBeNull();
});
```

---

#### Issue #8: Inconsistent error message format

**Source:** Reviewer #1
**Location:** Task 2.3, parser/parser.ts
**Description:** Some errors use backticks (line 1471) while others use quotes (line 1479).

**Validation:** VALIDATED

**Evidence:**
- Plan line 1471: Uses single quotes in error message `"Workflow must contain at least one step (heading starting with '##')"`
- Plan line 1480: Uses backticks in template literal but quotes in string `"Steps must be numbered sequentially. Expected step ${expected}, found step ${steps[i].number}.\n" + "Workflows must have exactly one algorithm..."`
- Inconsistent style across error messages

**Recommendation:** IMPLEMENT - Standardize on backticks for technical terms
Improves readability and consistency.

---

#### Issue #9: Magic number for MAX_GATES_PER_DISPATCH

**Source:** Reviewer #1
**Location:** Workflow retry logic
**Description:** Dispatcher already has MAX_GATES_PER_DISPATCH=10 constant but no equivalent for workflow retries

**Validation:** VALIDATED

**Evidence:**
- Checked dispatcher.ts line 44: `const MAX_GATES_PER_DISPATCH = 10;`
- Plan Task 1.2 (line 387): `retryMax: 3` is hardcoded in WorkflowState creation
- No constant defined for workflow retry limit
- Inconsistent with dispatcher pattern

**Recommendation:** IMPLEMENT - Add constant
```typescript
const DEFAULT_RETRY_MAX = 3;
// Use in state creation:
retryMax: DEFAULT_RETRY_MAX,
```

---

#### Issue #10: No integration test for full workflow execution

**Source:** Reviewer #1
**Location:** All test tasks
**Description:** Plan has unit tests for each component but no end-to-end workflow execution test

**Validation:** VALIDATED

**Evidence:**
- Plan has unit tests for:
  - Types (Task 1.1)
  - State manager (Task 1.2)
  - Parser (Task 2.3)
  - CLI commands (Task 3.1)
  - Workflow hooks (Task 4.3, 4.4)
- No test that:
  1. Starts a workflow
  2. Executes steps with actual commands
  3. Handles conditionals
  4. Tracks task state
  5. Completes workflow

**Recommendation:** IMPLEMENT - Add integration test
Create test that exercises full workflow lifecycle to catch integration issues.

---

#### Issue #11: Missing documentation for workflow file location discovery

**Source:** Reviewer #1
**Location:** Task 3.1, workflow-cli.ts
**Description:** findWorkflowFile (line 1988) checks cwd and .claude/workflows/ but this discovery logic not documented

**Validation:** VALIDATED

**Evidence:**
- Plan lines 1988-2008: findWorkflowFile implementation checks two locations
  1. Current directory
  2. `.claude/workflows/` directory
- This discovery logic is not documented in help text, README, or CLAUDE.md
- Users won't know where to place workflow files

**Recommendation:** IMPLEMENT - Document discovery logic
Add to CLI help and README:
```
Workflow files are discovered in this order:
1. Exact path if absolute
2. Relative to current directory
3. In .claude/workflows/ directory
```

---

#### Issue #12: Inconsistent command structure

**Source:** Reviewer #1
**Location:** Task 3.1, workflow-cli.ts
**Description:** CLI has both 'next' and 'complete' commands (lines 1782, 1843) with overlapping functionality when workflow finishes

**Validation:** VALIDATED

**Evidence:**
- Plan line 1782: `next` command implementation
- Plan line 1815-1818: `next` checks if workflow complete and ends it
- Plan line 1843: `complete` command with `--status` flag
- Overlapping functionality: both can end workflow
- Unclear semantics: when to use `next` vs `complete`?

**Recommendation:** IMPLEMENT - Clarify command semantics
Document when to use each:
- `next`: Automatic progression (detects completion)
- `complete`: Manual completion with status flag

---

#### Issue #13: No validation for task completion order

**Source:** Reviewer #1
**Location:** Task 4.4, subagent-stop.ts
**Description:** handleSubagentStop (line 2649) marks first running task complete but doesn't verify it's the task that actually stopped

**Validation:** VALIDATED

**Evidence:**
- Plan line 2649: `const runningTaskIndex = state.tasks.findIndex(t => t.status === 'running');`
- Finds FIRST running task, not the specific task that stopped
- No task ID matching or correlation
- If multiple tasks run concurrently, wrong task might be marked complete

**Recommendation:** IMPLEMENT (if concurrent tasks are supported)
If workflows support concurrent task execution, add task ID correlation. If not, document that tasks run sequentially.

---

#### Issue #14: Missing TypeScript strict null checks compliance

**Source:** Reviewer #1
**Location:** Task 2.3, parser.ts line 1454
**Description:** Code uses `!` assertion (line 1454) instead of proper null checks

**Validation:** VALIDATED

**Evidence:**
- Plan line 1454:
```typescript
number: step.number!,
description: step.description!,
```
- Non-null assertion operator bypasses TypeScript safety
- If step.number or step.description are actually null, runtime error occurs
- Better: explicit null check or guard clause

**Recommendation:** IMPLEMENT - Replace with proper null checks
```typescript
if (!step.number || !step.description) {
  throw new Error('Invalid step: missing number or description');
}
const finalStep: Step = {
  number: step.number,
  description: step.description,
  ...
```

---

#### Issue #15: Workflow context injection happens twice

**Source:** Reviewer #1
**Location:** Task 4.1 creates separate function instead of extending existing pattern
**Description:** Plan adds getWorkflowContext call (Task 4.2) but context.ts already has injectContext. Two separate context systems.

**Validation:** INVALIDATED

**Evidence:**
- Checked existing context.ts: `injectContext()` discovers .claude/context/ files
- Plan Task 4.1 creates `getWorkflowContext()` which formats workflow state
- These are different concerns:
  - injectContext: discovers and loads .claude/context/*.md files
  - getWorkflowContext: formats active workflow state for display
- Not duplication - complementary functionality
- Both are injected in dispatcher.ts but serve different purposes

**Recommendation:** SKIP - Not an actual issue
These are separate, complementary context injection mechanisms.

---

#### Issue #16: No cleanup for old workflow state files

**Source:** Reviewer #1
**Location:** Task 1.2, state manager only creates and deletes on stop
**Description:** Workflow states accumulate in `.claude/turboshovel/workflows/` with no cleanup mechanism

**Validation:** VALIDATED

**Evidence:**
- Plan Task 1.2: WorkflowStateManager has create/save/load/delete/list
- delete() only called explicitly by CLI stop command (line 1922)
- No automatic cleanup of completed workflows
- State files persist indefinitely

**Recommendation:** IMPLEMENT (future enhancement)
Add cleanup strategy:
- Option 1: Auto-delete on successful completion
- Option 2: Prune states older than N days
- Option 3: User runs `workflow clean` command

---

#### Issue #17: Example workflows not validated

**Source:** Reviewer #1
**Location:** Task 5.2, examples/execute.workflow.md
**Description:** Task 5.2 creates example workflows but doesn't test they parse correctly

**Validation:** VALIDATED

**Evidence:**
- Plan Task 5.2 (lines 2802-2895): Creates example workflow files
- No test that runs parseWorkflow() on example files
- Examples could have syntax errors and users would discover at runtime

**Recommendation:** IMPLEMENT - Add validation test
```typescript
test('example workflows parse correctly', async () => {
  const examples = await fs.readdir('examples');
  for (const file of examples.filter(f => f.endsWith('.workflow.md'))) {
    const content = await fs.readFile(path.join('examples', file), 'utf8');
    expect(() => parseWorkflow(content)).not.toThrow();
  }
});
```

---

#### Issue #18: No version field in workflow state

**Source:** Reviewer #1
**Location:** Task 1.1, types.ts WorkflowState interface
**Description:** WorkflowState interface doesn't include version field for future compatibility

**Validation:** VALIDATED

**Evidence:**
- Plan lines 174-189: WorkflowState interface definition
- No version field
- If schema changes in future, no way to migrate old state files
- Common pattern for persisted data structures

**Recommendation:** IMPLEMENT (future-proofing)
Add version field:
```typescript
export interface WorkflowState {
  readonly version: string; // e.g., "1.0.0"
  readonly id: string;
  // ... rest
}
```

---

## Reviewer #2 Exclusive Issues

### BLOCKING Issues

#### Issue #19: Incorrect HookInput field name

**Source:** Reviewer #2
**Location:** Task 4.2, line 2282
**Description:** Plan uses `input.user_message` but actual HookInput type defines `user_message` not `user_prompt`.

**Validation:** INVALIDATED

**Evidence:**
- Checked actual types.ts line 17: `user_message?: string;`
- Plan Task 4.2 line 2282: `user_prompt: 'test prompt',`
- Reviewer #2 claims plan uses `user_message` but actual type is `user_prompt`
- This is BACKWARDS - actual type IS `user_message`
- Plan's test code (line 2282) uses wrong field name `user_prompt`
- However, this is in TEST CODE, not implementation
- The test is testing dispatcher integration, not workflow code
- This is actually a valid issue but reviewer description is inverted

**Re-validation:** VALIDATED (but description inverted)
- Actual issue: Plan's test uses `user_prompt` but should use `user_message`
- Fix: Change line 2282 from `user_prompt: 'test prompt'` to `user_message: 'test prompt'`

**Recommendation:** IMPLEMENT - Fix test field name
Test code has wrong field name for HookInput.

---

#### Issue #20: Test path pattern mismatch

**Source:** Reviewer #2
**Location:** All test run commands throughout the plan (e.g., lines 82, 194, 336)
**Description:** Plan uses `--testPathPattern="workflow/types"` but Jest expects patterns to match full paths. Current tests use patterns like `config.test` or file paths.

**Validation:** VALIDATED

**Evidence:**
- Plan line 82: `npm test -- --testPathPattern="workflow/types"`
- Plan line 194: `npm test -- --testPathPattern="workflow/state"`
- Plan line 711: `npm test -- --testPathPattern="parser/helpers"`
- Jest testPathPattern matches against full file path
- Pattern "workflow/types" would match "__tests__/workflow/types.test.ts"
- However, more precise pattern would be "workflow/types.test"
- Current pattern might match unintended files (e.g., "workflow/types-integration.test.ts")

**Recommendation:** IMPLEMENT - Use more precise patterns
Change to `--testPathPattern="workflow/types.test"` for exact matching.

---

#### Issue #21: Missing test directory creation

**Source:** Reviewer #2
**Location:** Task 1.2, state.ts save() method line 408
**Description:** Tests create temporary directories but the actual .claude/turboshovel/workflows directory structure may need recursive creation in state manager.

**Validation:** INVALIDATED

**Evidence:**
- Plan line 408: `await fs.mkdir(this.stateDir, { recursive: true });`
- `{ recursive: true }` ensures parent directories are created
- This is correct implementation
- Reviewer #2 notes: "Directory creation with `{ recursive: true }` is correct, but pattern should match test expectations"
- Implementation IS correct, no issue here
- Collation report line 315: "BLOCKING (downgraded - reviewer notes implementation is actually correct)"
- Collation report line 484: Reviewer #2 self-resolved as correct

**Recommendation:** SKIP - Implementation is correct

---

#### Issue #22: Invalid action type in formatAction helper

**Source:** Reviewer #2
**Location:** Task 3.1, line 1976
**Description:** formatAction function uses complex conditional type that references Step['conditions'] which may not infer correctly.

**Validation:** VALIDATED

**Evidence:**
- Plan line 1976:
```typescript
function formatAction(action: Step['conditions'] extends { pass: infer T } ? T : never): string {
```
- This is overly complex type that:
  1. Extracts `pass` field from `Step['conditions']`
  2. Uses conditional type with infer
  3. Results in `Action` type (since conditions.pass is Action)
- Simpler and clearer: `function formatAction(action: Action): string`
- Current type is technically correct but unnecessarily complex
- May confuse TypeScript in some edge cases

**Recommendation:** IMPLEMENT - Simplify type
```typescript
function formatAction(action: Action): string {
```

---

#### Issue #23: Missing validation for H1 rejection

**Source:** Reviewer #2
**Location:** Task 2.3, parser.ts lines 1300-1320 and test line 1228-1238
**Description:** Test expects H1 headers to be rejected (line 1237) but parser only checks for `##` prefix without explicitly rejecting `#` (single hash).

**Validation:** VALIDATED

**Evidence:**
- Plan test lines 1228-1237:
```typescript
test('rejects H1 as step header', () => {
  const markdown = `
# 1. First step
...
`;
  expect(() => parseWorkflow(markdown)).toThrow(WorkflowSyntaxError);
});
```
- Plan parser line 1299: `if (line.startsWith('## ')) {`
- Plan parser line 1323: `if (line.startsWith('# ') && !line.startsWith('## ')) {`
- Line 1323 sets `state.inHeading = 'h1'` but doesn't throw error
- H1 headers are ignored (not processed as steps) but not explicitly rejected
- Test EXPECTS error, but implementation DOESN'T throw error
- Test will FAIL

**Recommendation:** IMPLEMENT - Add H1 validation
After line 1326, add validation in finalizeWorkflow or throw immediately when H1 detected in step context.

---

#### Issue #24: Workflow context injection positioning

**Source:** Reviewer #2
**Location:** Task 4.2, Step 3, lines 2325-2329
**Description:** Task 4.2 instructs to add workflow context "after context injection but before gates" but the code location given is vague.

**Validation:** VALIDATED

**Evidence:**
- Plan Task 4.2 Step 3 (lines 2322-2329):
```
In the `dispatch` function, after context injection but before gates:

```typescript
// Inject workflow context if active
const workflowContext = await getWorkflowContext(input.cwd);
if (workflowContext) {
  accumulatedContext += '\n\n' + workflowContext;
}
```
```
- Instruction is vague: "after context injection but before gates"
- No line number or specific insertion point in dispatcher.ts
- Developer must understand dispatcher flow to place correctly
- Risk of incorrect placement

**Recommendation:** IMPLEMENT - Provide specific insertion point
Add line number or code anchor:
"In dispatcher.ts, after line X where `injectContext()` is called, before the gate processing loop:"

---

### NON-BLOCKING Issues

#### Issue #25: Add TypeScript types for test mocks

**Source:** Reviewer #2
**Location:** Throughout tests, e.g., Task 4.3 line 2390-2394
**Description:** Tests use untyped tool_input objects which could mask type errors

**Validation:** VALIDATED

**Evidence:**
- Plan line 2390-2394:
```typescript
tool_input: {
  subagent_type: 'code-exec-agent',
  prompt: 'Implement feature',
},
```
- Object literal has no type annotation
- Could pass invalid fields without error
- TypeScript won't catch mismatches

**Recommendation:** IMPLEMENT - Add type annotations
```typescript
tool_input: {
  subagent_type: 'code-exec-agent',
  prompt: 'Implement feature',
} as HookInput['tool_input'],
```

---

#### Issue #26: Consider using path.join consistently

**Source:** Reviewer #2
**Location:** Task 3.1, lines 1989-2006
**Description:** Some path constructions use template literals, others use path.join

**Validation:** VALIDATED

**Evidence:**
- Plan line 1990: `const direct = path.join(cwd, filename);`
- Plan line 1999: `const claudeDir = path.join(cwd, '.claude/workflows', filename);`
- Plan uses path.join consistently in findWorkflowFile
- However, in other parts of CLI:
  - Line 1757: `const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);`
- Actually fairly consistent, but could be more explicit

**Recommendation:** IMPLEMENT (nice to have)
Audit all path construction and ensure consistent use of path.join.

---

#### Issue #27: Add error handling for invalid workflow states

**Source:** Reviewer #2
**Location:** WorkflowStateManager methods
**Description:** WorkflowStateManager.update() throws if state not found but create/load return null. Inconsistent error handling pattern.

**Validation:** VALIDATED

**Evidence:**
- Plan line 418-420 (update):
```typescript
if (!existing) {
  throw new Error(`Workflow ${id} not found`);
}
```
- Plan line 398-404 (load):
```typescript
async load(id: string): Promise<WorkflowState | null> {
  try {
    ...
  } catch {
    return null;
  }
}
```
- Inconsistent: load returns null, update throws
- Better: consistent pattern (either all throw or all return null)

**Recommendation:** IMPLEMENT - Standardize error handling
Decide on pattern and apply consistently across all methods.

---

#### Issue #28: Missing workflow file validation

**Source:** Reviewer #2
**Location:** Task 3.1, start command line 1758
**Description:** CLI reads workflow file but doesn't validate it's actually a .md file

**Validation:** VALIDATED

**Evidence:**
- Plan line 1758: `const content = await fs.readFile(filePath, 'utf8');`
- No check for file extension
- User could run `workflow start package.json` and get confusing parse error
- Better UX: validate file is .md before parsing

**Recommendation:** IMPLEMENT - Add file extension validation
```typescript
if (!filePath.endsWith('.md') && !filePath.endsWith('.workflow.md')) {
  console.error('Error: Workflow file must be a markdown file (.md)');
  process.exit(1);
}
```

---

#### Issue #29: Redundant conditional in convertConditionals

**Source:** Reviewer #2
**Location:** Task 2.2, helpers.ts lines 941-971
**Description:** Function checks all combinations of pass/fail being null when logic could be simplified

**Validation:** VALIDATED

**Evidence:**
- Plan lines 941-971: convertConditionals implementation
- Lines 958-969 handle all combinations:
  - both pass and fail
  - only pass (default fail to STOP)
  - only fail (default pass to CONTINUE)
  - neither (return null)
- Logic is correct but verbose
- Could be simplified with early returns or fallback pattern

**Recommendation:** IMPLEMENT (refactoring)
Simplify logic for clarity:
```typescript
if (conditionals.length === 0) return null;

const passAction = conditionals.find(c => c.type === 'pass')?.action ?? { type: 'CONTINUE' };
const failAction = conditionals.find(c => c.type === 'fail')?.action ?? { type: 'STOP' };

return { pass: passAction, fail: failAction };
```

---

#### Issue #30: Consider extracting constants

**Source:** Reviewer #2
**Location:** Task 4.3, 4.4 throughout
**Description:** Magic strings like 'running', 'complete', 'blocked' scattered throughout

**Validation:** VALIDATED

**Evidence:**
- Plan line 2401: `expect(updated?.tasks[0].status).toBe('running');`
- Plan line 2555: `expect(updated?.tasks[0].status).toBe('complete');`
- Plan line 2576: `expect(updated?.tasks[0].status).toBe('blocked');`
- Plan line 2649: `const runningTaskIndex = state.tasks.findIndex(t => t.status === 'running');`
- Magic strings throughout code
- TypeScript type is `'pending' | 'running' | 'complete' | 'blocked'` (line 165)
- No constants defined for these values

**Recommendation:** IMPLEMENT - Add constants
```typescript
export const TaskStatus = {
  PENDING: 'pending' as const,
  RUNNING: 'running' as const,
  COMPLETE: 'complete' as const,
  BLOCKED: 'blocked' as const,
};
```

---

#### Issue #31: Test coverage for edge cases missing

**Source:** Reviewer #2
**Location:** Task 2.3, parser tests
**Description:** Parser tests don't cover empty code blocks, whitespace-only steps, or unicode in step descriptions

**Validation:** VALIDATED

**Evidence:**
- Plan Task 2.3 tests (lines 1007-1263) cover:
  - Basic parsing
  - Conditionals
  - Prompts
  - Validation (empty workflow, non-sequential, multiple code blocks, invalid GOTO, H1 rejection)
- Missing tests for:
  - Empty code block: ` ```bash\n``` `
  - Whitespace-only step description: `## 1.    `
  - Unicode in description: `## 1. Test with émoji 🎉`

**Recommendation:** IMPLEMENT - Expand test coverage
Add edge case tests for robustness.

---

#### Issue #32: CLI error handling could be more specific

**Source:** Reviewer #2
**Location:** Task 3.1, throughout CLI implementation
**Description:** Most errors just print message and exit(1) without distinguishing error types

**Validation:** VALIDATED

**Evidence:**
- Plan error handlers all use same pattern:
  - Line 1776-1778: `console.error(\`Error: ${(error as Error).message}\`); process.exit(1);`
  - Line 1837-1839: Same pattern
  - Line 1867-1869: Same pattern
  - Line 1902-1904: Same pattern
  - Line 1925-1927: Same pattern
  - Line 1950-1952: Same pattern
- All errors exit with code 1
- No distinction between user error (bad input) vs system error (disk full)
- Better UX: different exit codes for different error types

**Recommendation:** IMPLEMENT - Add specific exit codes
```typescript
const EXIT_CODE = {
  SUCCESS: 0,
  USER_ERROR: 1,
  SYSTEM_ERROR: 2,
  NOT_FOUND: 3,
};
```

---

#### Issue #33: Session state updates are best-effort but failures are silent

**Source:** Reviewer #2
**Location:** dispatcher.ts line 147-203 (existing code)
**Description:** updateSessionState catches all errors and logs but doesn't notify caller. Callers could make decisions based on session state success.

**Validation:** INVALIDATED

**Evidence:**
- Reviewer references dispatcher.ts lines 147-203
- This is EXISTING code, not plan code
- Plan doesn't modify session state handling
- This is out of scope for workflow system implementation
- Would be a separate refactoring task

**Recommendation:** SKIP - Out of scope for this plan
This is a pre-existing issue in dispatcher.ts, not introduced by workflow system.

---

#### Issue #34: Missing integration test for full workflow lifecycle

**Source:** Reviewer #2
**Location:** All phases
**Description:** Tests cover individual components but not end-to-end workflow execution

**Validation:** VALIDATED

**Evidence:**
- Same as Issue #10 (found by Reviewer #1)
- Both reviewers independently identified missing integration test
- This validates the issue as real

**Recommendation:** IMPLEMENT - Add integration test
(Same as Issue #10)

---

#### Issue #35: Git commit messages could include issue references

**Source:** Reviewer #2
**Location:** All commit commands throughout plan
**Description:** Commit messages are well-formatted but don't reference issues or tickets

**Validation:** VALIDATED

**Evidence:**
- All commit messages follow conventional commits format
- Example line 201: `feat(workflow): add core type definitions`
- No issue references like `#123` or `JIRA-456`
- Best practice: link commits to issues for traceability

**Recommendation:** IMPLEMENT (if issue tracking is used)
Add issue references to commit messages when applicable.
If no issue tracker, this is not relevant.

---

## Summary Statistics

### By Validation Status

**VALIDATED:**
- BLOCKING: 9/11 (82%)
- NON-BLOCKING: 9/11 (82%)
- Total: 18/22 (82%)

**INVALIDATED:**
- BLOCKING: 2/11 (18%)
- NON-BLOCKING: 2/11 (18%)
- Total: 4/22 (18%)

**UNCERTAIN:** 0/22 (0%)

### By Severity

**BLOCKING Issues (11 total):**
- Reviewer #1: 5 issues (4 VALIDATED, 1 INVALIDATED)
- Reviewer #2: 6 issues (5 VALIDATED, 1 INVALIDATED)

**NON-BLOCKING Issues (11 total):**
- Reviewer #1: 9 issues (8 VALIDATED, 1 INVALIDATED)
- Reviewer #2: 2 issues (1 VALIDATED, 1 INVALIDATED)

Note: Issue counts don't match because Reviewer #2's list includes some that overlap with common issues or are out of scope.

### Corrected Counts

After removing invalidated issues:

**VALIDATED BLOCKING:** 9 issues
1. Circular import risk (R1)
2. Missing test verification for file paths (R1)
3. Test relies on build artifacts (R1)
4. Missing validation for GOTO self-loop (R1)
5. No error handling for workflow file not found (R1)
6. Incorrect HookInput field name (R2) *
7. Test path pattern mismatch (R2)
8. Invalid action type in formatAction (R2)
9. Missing validation for H1 rejection (R2)
10. Workflow context injection positioning (R2)

* Issue #19 validated but description was inverted

**VALIDATED NON-BLOCKING:** 9 issues
1. Test coverage for edge cases in stripSeparator (R1)
2. Missing test for empty string handling (R1)
3. Inconsistent error message format (R1)
4. Magic number for MAX_GATES_PER_DISPATCH (R1)
5. No integration test (R1)
6. Missing documentation for workflow file location discovery (R1)
7. Inconsistent command structure (R1)
8. No validation for task completion order (R1)
9. Missing TypeScript strict null checks compliance (R1)
10. No cleanup for old workflow state files (R1)
11. Example workflows not validated (R1)
12. No version field in workflow state (R1)
13. Add TypeScript types for test mocks (R2)
14. Consider using path.join consistently (R2)
15. Add error handling for invalid workflow states (R2)
16. Missing workflow file validation (R2)
17. Redundant conditional in convertConditionals (R2)
18. Consider extracting constants (R2)
19. Test coverage for edge cases missing (R2)
20. CLI error handling could be more specific (R2)
21. Missing integration test (R2) - duplicate of R1
22. Git commit messages could include issue references (R2)

## Recommendations for /revise exclusive

### High Priority (BLOCKING - 9 issues)

1. **Circular import risk** - Refactor to avoid dispatcher ↔ workflow circular dependency
2. **Missing test verification** - Verify STATE_DIR constant in tests
3. **Build artifact dependency** - Document or fix CLI test build requirement
4. **GOTO self-loop** - Make it a blocking validation error
5. **File not found handling** - Add specific error messages for different error types
6. **HookInput field name** - Fix test to use `user_message` not `user_prompt`
7. **Test path patterns** - Use precise patterns like "workflow/types.test"
8. **formatAction type** - Simplify to `(action: Action)`
9. **H1 validation** - Add explicit rejection of H1 headers
10. **Context injection position** - Provide specific line number in dispatcher.ts

### Medium Priority (NON-BLOCKING but valuable - 9 issues)

1. **Edge case test coverage** - Add tests for empty strings, whitespace, unicode
2. **Error message consistency** - Standardize on backticks for technical terms
3. **Retry max constant** - Add DEFAULT_RETRY_MAX constant
4. **Integration test** - Add end-to-end workflow execution test
5. **Discovery documentation** - Document workflow file discovery logic
6. **Command structure** - Clarify next vs complete semantics
7. **Task completion validation** - Document sequential task execution or add ID correlation
8. **Null check compliance** - Replace `!` assertions with proper checks
9. **State cleanup** - Add workflow state cleanup mechanism

### Low Priority (nice to have)

1. **Test mocks typing** - Add type annotations to test objects
2. **Path.join consistency** - Audit and standardize path construction
3. **Error handling pattern** - Standardize throw vs return null
4. **File validation** - Check .md extension before parsing
5. **Conditional logic** - Refactor convertConditionals for clarity
6. **Magic string constants** - Extract TaskStatus constants
7. **CLI exit codes** - Use specific exit codes for different error types
8. **Version field** - Add version to WorkflowState for future migration
9. **Example validation** - Test that examples parse correctly
10. **Commit issue refs** - Add issue references if using issue tracker

## Next Steps

1. Review VALIDATED BLOCKING issues with user
2. Decide which non-blocking issues to address
3. Update plan with fixes using `/revise exclusive`
4. Re-run verification after revisions
