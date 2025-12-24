# Code Review - Phase 2: Workflow Parser - 2025-12-20

## Status: BLOCKED

## BLOCKING (Must Fix Before Merge)

**Linter error in unrelated test file:**
- Description: The file `__tests__/workflow/types.test.ts` has an unused import causing lint failure
- Location: `__tests__/workflow/types.test.ts:2`
- Action: Remove unused `Step` import from line 2. Change `import { createStepNumber, type StepNumber, type Action, type Step }` to `import { createStepNumber, type StepNumber, type Action }`

**Missing edge case test - multiple explicit prompts:**
- Description: The parser supports multiple explicit prompts per step (via multiple **Prompt:** markers), but there's no test coverage for this scenario
- Location: `__tests__/workflow/parser/parser.test.ts` (missing test)
- Action: Add test case to verify that multiple explicit prompts are correctly collected into the prompts array:
```typescript
test('parses multiple explicit prompts', () => {
  const markdown = `
## 1. Verify tests

**Prompt:** Do all functions have tests?

**Prompt:** Are edge cases covered?
`;

  const steps = parseWorkflow(markdown);
  expect(steps[0].prompts).toHaveLength(2);
  expect(steps[0].prompts[0].text).toBe('Do all functions have tests?');
  expect(steps[0].prompts[1].text).toBe('Are edge cases covered?');
});
```

**Ambiguous implicit prompt behavior with mixed content:**
- Description: The `finalizeStep` function creates implicit prompts when there's no code block AND no explicit prompts. However, the behavior when there's BOTH implicit text AND an explicit prompt is unclear - the implicit text accumulates but is then discarded because `step.prompts.length > 0`
- Location: `src/workflow/parser/parser.ts:198-201`
- Action: Either (1) support both implicit and explicit prompts together by changing condition to only check for code block, OR (2) document and test the current behavior that explicit prompts suppress implicit text. Recommend option 2 for clarity:
```typescript
// In finalizeStep:
// Create implicit prompt if: no code block AND no explicit prompts AND has text
if (!step.command && step.prompts.length === 0 && implicitText.trim()) {
  step.prompts.push({ text: implicitText.trim() });
}

// Add test case:
test('explicit prompt suppresses implicit text', () => {
  const markdown = `
## 1. Review code

Some implicit text here.

**Prompt:** Explicit prompt
`;

  const steps = parseWorkflow(markdown);
  expect(steps[0].prompts).toHaveLength(1);
  expect(steps[0].prompts[0].text).toBe('Explicit prompt');
  // Implicit text "Some implicit text here." is intentionally discarded
});
```

## NON-BLOCKING (May Be Deferred)

**Type casting in extractText could be more precise:**
- Description: The `extractText` function uses type assertions `(node as Text)` and `(child as PhrasingContent)` which could fail if the AST structure doesn't match expectations
- Location: `src/workflow/parser/parser.ts:14-21`
- Action: Add type guards or document the assumption that mdast types guarantee these relationships. Consider:
```typescript
function extractText(node: PhrasingContent | Heading | Paragraph | ListItem): string {
  if (node.type === 'text') {
    return node.value; // node is narrowed to Text automatically
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children
      .filter((child): child is PhrasingContent => 'type' in child)
      .map(extractText)
      .join('');
  }
  return '';
}
```

**Parser index could export helpers for testing:**
- Description: Helper functions like `stripSeparator`, `extractStepHeader`, etc. are useful for testing custom workflows but are not exported from the parser module index
- Location: `src/workflow/parser/index.ts`
- Action: Consider exporting helper functions if they would be useful for external testing or validation. If they're truly internal-only, document that decision.

**Jest config could use preset simplification:**
- Description: The jest.config.js removes the `preset: 'ts-jest'` and manually configures all transform options. While this works, it's more verbose than necessary
- Location: `jest.config.js:7-34`
- Action: Consider whether the manual transform configuration is truly needed, or if `preset: 'ts-jest'` with selective overrides would be simpler. Current approach is fine if ESM transpilation requires this level of control.

**Missing test for edge case - conditionals without actions:**
- Description: While `convertConditionals` handles empty arrays, there's no test for partial conditionals (e.g., only PASS without FAIL gets default FAIL: STOP)
- Location: `__tests__/workflow/parser/helpers.test.ts` (missing test)
- Action: Add test cases to document and verify default behavior:
```typescript
describe('convertConditionals', () => {
  test('PASS only gets default FAIL: STOP', () => {
    const result = convertConditionals([
      { type: 'pass', action: { type: 'CONTINUE' } }
    ]);
    expect(result).toEqual({
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP' }
    });
  });

  test('FAIL only gets default PASS: CONTINUE', () => {
    const result = convertConditionals([
      { type: 'fail', action: { type: 'STOP' } }
    ]);
    expect(result).toEqual({
      pass: { type: 'CONTINUE' },
      fail: { type: 'STOP' }
    });
  });
});
```

**Backward compatibility code lacks deprecation notice:**
- Description: The parser includes backward compatibility for old syntax (`Pass:`, `Fail:`, `Continue`, `Go to Step N`), but there's no deprecation warning or documentation
- Location: `src/workflow/parser/helpers.ts:100-118`, `src/workflow/parser/helpers.ts:150-167`
- Action: Add JSDoc comments documenting the deprecated syntax and consider adding a deprecation warning when old syntax is detected (could log to stderr during parsing)

**Error message could be more helpful for empty descriptions:**
- Description: When a step header has a number but no description (e.g., `## 1.`), extractStepHeader returns null, but the eventual error is generic "must be numbered sequentially"
- Location: `src/workflow/parser/helpers.ts:47-49`
- Action: Consider throwing a more specific error when description is empty: `throw new WorkflowSyntaxError('Step ${number} has no description after separator')`

**Code block language detection could be more robust:**
- Description: The parser splits `lang` on whitespace and takes first token. While this handles ` ```bash {...}` ` syntax, it's not documented what happens with unusual lang strings
- Location: `src/workflow/parser/parser.ts:119`
- Action: Add comment documenting the lang splitting behavior, or add test cases for edge cases like ` ```bash --norc` ` or ` ```BASH` ` (case sensitivity)

## Checklist

**Security & Correctness:**
- [x] No security vulnerabilities (SQL injection, XSS, CSRF, exposed secrets)
- [x] No insecure dependencies or deprecated cryptographic functions
- [x] No critical logic bugs (meets acceptance criteria) - parser correctly implements all plan requirements
- [x] No race conditions, deadlocks, or data races
- [x] No unhandled errors, rejected promises, or panics - uses WorkflowSyntaxError consistently
- [x] No breaking API or schema changes without migration plan

**Testing:**
- [x] All tests passing (unit, integration, property-based where applicable) - 47 tests pass
- [x] New logic has corresponding tests - comprehensive test coverage
- [ ] Tests cover edge cases and error conditions - BLOCKING: missing tests for multiple prompts, mixed implicit/explicit prompts
- [x] Tests verify behavior (not implementation details)
- [x] Property-based tests for mathematical/algorithmic code with invariants - N/A for parser
- [x] Tests are isolated (independent, don't rely on other tests)
- [x] Test names are clear and use structured arrange-act-assert patterns

**Architecture:**
- [x] Single Responsibility Principle (functions/files have one clear purpose)
- [x] No non-trivial duplication (logic that if changed in one place would need changing elsewhere)
- [x] Clean separation of concerns (business logic separate from data marshalling) - helpers vs parser separation is excellent
- [x] No leaky abstractions (internal details not exposed)
- [x] No over-engineering (YAGNI - implement only current requirements)
- [x] No tight coupling (excessive dependencies between modules)
- [x] Proper encapsulation (internal details not exposed across boundaries)
- [x] Modules can be understood and tested in isolation

**Error Handling:**
- [x] No swallowed exceptions or silent failures
- [x] Error messages provide sufficient context for debugging - excellent error messages with suggestions
- [x] Fail-fast on invariants where appropriate

**Code Quality:**
- [x] Simple, not clever (straightforward solutions over complex ones) - excellent clarity
- [x] Clear, descriptive naming (variables, functions, classes)
- [x] Type safety maintained - excellent use of TypeScript discriminated unions
- [x] Follows language idioms and project patterns consistently
- [x] No magic numbers or hardcoded strings (use named constants)
- [x] Consistent approaches when similar functionality exists elsewhere
- [x] Comments explain "why" not "what" (code should be self-documenting) - excellent comments
- [x] Rationale provided for non-obvious design decisions - good comment explaining AST vs state machine
- [x] Doc comments for public APIs

**Process:**
- [x] No obvious performance issues (N+1 queries, inefficient algorithms on hot paths)
- [ ] ALL linter warnings addressed by fixing root cause - BLOCKING: unused import in types.test.ts
- [x] Requirements met exactly (no scope creep) - all plan requirements implemented
- [x] No unnecessary reinvention (appropriate use of existing libraries/patterns) - excellent use of mdast-util-from-markdown

## Next Steps

1. **Address BLOCKING issues:**
   - Fix linter error in `__tests__/workflow/types.test.ts` (remove unused `Step` import)
   - Add test case for multiple explicit prompts
   - Document and test implicit prompt suppression behavior OR change to support both

2. **Consider NON-BLOCKING suggestions:**
   - Add missing test cases for convertConditionals default behavior
   - Add deprecation notices for backward compatibility code
   - Improve error message specificity for empty descriptions
   - Consider exporting helpers from parser index if useful

3. **After fixes, ready to merge**

---

## Review Context

**Files Reviewed:**
1. `plugin/hooks/hooks-app/src/workflow/parser/types.ts` (20 lines)
2. `plugin/hooks/hooks-app/src/workflow/parser/helpers.ts` (206 lines)
3. `plugin/hooks/hooks-app/src/workflow/parser/parser.ts` (258 lines)
4. `plugin/hooks/hooks-app/src/workflow/parser/index.ts` (5 lines)
5. `plugin/hooks/hooks-app/__tests__/workflow/parser/helpers.test.ts` (140 lines)
6. `plugin/hooks/hooks-app/__tests__/workflow/parser/parser.test.ts` (280 lines)
7. `plugin/hooks/hooks-app/jest.config.js` (40 lines)

**Modified Files (not yet committed):**
- `jest.config.js` - ESM transpilation config for mdast packages
- `src/workflow/index.ts` - Added parser exports
- `tsconfig.json` - Added allowSyntheticDefaultImports

**Test Results:**
- All 47 parser tests passing
- Linter: 1 error (unused import in unrelated file)

**Plan Alignment:**
The implementation correctly implements all Phase 2 requirements:
- ✅ Parse markdown using mdast-util-from-markdown
- ✅ Extract steps from H2 headers with flexible separators
- ✅ Parse bash code blocks as commands
- ✅ Parse PASS/FAIL conditionals with all action types
- ✅ Extract explicit and implicit prompts
- ✅ Validate sequential numbering, GOTO targets, H1 rejection
- ✅ Reject multiple code blocks per step
- ✅ Excellent error messages with suggestions

**Highlights:**
- Excellent error messages with actionable suggestions (e.g., "use RETRY instead", "combine commands using && or ;" )
- Clean separation of helpers vs main parser logic
- Comprehensive test coverage with well-organized describe blocks
- Good use of TypeScript discriminated unions for type safety
- AST walking approach is simpler and more maintainable than event-based parsing
- Backward compatibility support for old syntax shows good migration planning
- Comments explain design decisions (AST vs state machine)
