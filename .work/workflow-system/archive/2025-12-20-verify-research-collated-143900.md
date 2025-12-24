# Collated Research Report - TypeScript Workflow Parser Implementation

## Metadata
- **Review Type:** Research
- **Date:** 2025-12-20 14:39:00
- **Reviewers:** Research Agent #1 (cipherpowers:research-methodology), Research Agent #2 (Opus 4.5)
- **Subject:** TypeScript implementation strategy for markdown workflow parser (preserving Rust reference behavior)
- **Review Files:**
  - Review #1: `/Users/tobyhede/psrc/turboshovel/.work/2025-12-20-verify-research-143215.md`
  - Review #2: `/Users/tobyhede/psrc/turboshovel/.work/2025-12-20-verify-research-143527.md`
- **Cross-check Status:** N/A (research reviews, not code reviews)
- **Cross-check File:** N/A

## Executive Summary
- **Total unique findings identified:** 15
- **Common findings (VERY HIGH confidence):** 11
- **Exclusive findings (one reviewer only):** 4
  - Reviewer #1 only: 2
  - Reviewer #2 only: 2
- **Divergences (researchers disagree):** 0

**Overall Status:** APPROVED
**Revise Ready:** N/A (research report - ready for implementation planning)

---

## Common Findings (High Confidence)

Both reviewers independently found these findings.

**Confidence: VERY HIGH** - Both reviewers found these independently, making them very reliable recommendations.

### Core Architecture Findings

**1. Rust Parser Uses pulldown-cmark with Event-Based Processing**
- **Reviewer #1 finding:** The Rust parser uses `pulldown-cmark` library with an event-based (pull parser) approach. It processes markdown as a stream of events (Start/End tags, Text, Code blocks) and uses a state machine with multiple flags to track context.
- **Reviewer #2 finding:** The Rust implementation uses `pulldown-cmark` (a CommonMark-compliant pull parser) and processes markdown as a stream of events. It delegates markdown tokenization to pulldown-cmark and focuses on semantic interpretation.
- **Confidence:** VERY HIGH (both found independently)
- **Location:** `/Users/tobyhede/psrc/turboshovel/.reference/workflow/src/parser.rs` lines 37-52
- **Implication:** TypeScript implementation should follow same architecture - library for tokenization, custom logic for semantic extraction

**2. Data Model Uses Strongly-Typed Newtypes/Discriminated Unions**
- **Reviewer #1 finding:** Uses `StepNumber(NonZeroUsize)` as a newtype wrapper to enforce 1-indexed step numbers. Actions are represented as an enum with three variants: `Continue`, `Stop(Option<String>)`, and `Goto(StepNumber)`.
- **Reviewer #2 finding:** Rust data model uses enums with variants that map directly to TypeScript discriminated unions. Key types are `Step`, `Action`, `Conditions`, `Conditional`, `Command`, `Prompt`, and `StepNumber`.
- **Confidence:** VERY HIGH (both found independently)
- **Location:** `/Users/tobyhede/psrc/turboshovel/.reference/workflow/src/models.rs` lines 1-55
- **Implication:** TypeScript should use branded types for StepNumber and discriminated unions for Action

**3. micromark/mdast-util-from-markdown is Recommended Library**
- **Reviewer #1 finding:** micromark is the JavaScript equivalent of pulldown-cmark - a small, safe CommonMark parser that emits tokens with positional info. It's the foundation of the unified/remark ecosystem.
- **Reviewer #2 finding:** The `mdast-util-from-markdown` + `micromark` combination provides direct architectural equivalence to pulldown-cmark (tokenizer + AST builder) with full TypeScript support.
- **Confidence:** VERY HIGH (both found independently)
- **Implication:** Use `mdast-util-from-markdown` for markdown parsing, with `unist-util-visit` for AST walking

**4. Hybrid Strategy (Option C) is Recommended Approach**
- **Reviewer #1 finding:** Recommended approach is Hybrid - micromark for tokenization, custom walker for semantics. This preserves Rust state machine logic while avoiding reinventing markdown parsing.
- **Reviewer #2 finding:** Option C (Hybrid) - Use `mdast-util-from-markdown` to parse markdown into standard mdast AST, then walk the AST to extract workflow-specific semantics.
- **Confidence:** VERY HIGH (both found independently)
- **Implication:** Do NOT hand-roll a markdown parser; use library for CommonMark, custom code for workflow semantics

**5. Comprehensive Rust Test Suite Provides Specification**
- **Reviewer #1 finding:** The Rust parser has 50+ inline tests organized into modules: `parsing`, `validation`, `conditionals`, `implicit_prompts`. Tests cover edge cases like H1 rejection, multiple code blocks error, empty markdown.
- **Reviewer #2 finding:** Extensive inline tests (lines 415-1352) covering: basic parsing, header variations, code blocks, conditionals, prompts, implicit prompts, validation, sequential numbering, GOTO validation.
- **Confidence:** VERY HIGH (both found independently)
- **Location:** `/Users/tobyhede/psrc/turboshovel/.reference/workflow/src/parser.rs` lines 415-1352
- **Implication:** Port Rust tests first as the specification for TypeScript implementation

**6. Parser Handles Multiple Syntax Variations**
- **Reviewer #1 finding:** Handles flexible separator syntax for step headers (`.`, `:`, `-`, `)`, space) and both ALLCAPS (`PASS:`, `FAIL:`) and legacy syntax (`Pass:`, `Fail:`).
- **Reviewer #2 finding:** Parser is permissive with separators for step headers and conditionals. Supports both ALLCAPS (PASS/FAIL/CONTINUE/STOP/GOTO) and legacy syntax.
- **Confidence:** VERY HIGH (both found independently)
- **Implication:** TypeScript must exactly match `strip_separator` behavior to avoid subtle parsing differences

**7. Implicit Prompt Detection is Complex**
- **Reviewer #1 finding:** Steps without code blocks and without explicit `**Prompt:**` markers treat paragraph text as implicit prompts. This only applies when there's no command and no explicit prompts.
- **Reviewer #2 finding:** Implicit prompts (text that becomes a prompt when no code block exists) have complex rules about when to capture text vs. ignore it.
- **Confidence:** VERY HIGH (both found independently as HIGH risk)
- **Implication:** Requires careful state tracking and extensive test coverage

**8. neverthrow or ParseResult Pattern for Error Handling**
- **Reviewer #1 finding:** TypeScript idiomatic error handling can use `neverthrow` for Result<T, E> types or Zod's `.safeParse()` pattern which returns a discriminated union.
- **Reviewer #2 finding:** `neverthrow` library provides type-safe Result types with `Ok` and `Err` variants. Alternative: custom ParseResult type matching Zod's safeParse pattern.
- **Confidence:** VERY HIGH (both found independently)
- **Implication:** Use Result pattern to avoid try/catch for expected errors

**9. Branded Types for StepNumber**
- **Reviewer #1 finding:** TypeScript should use branded types to preserve 1-indexed constraint: `type StepNumber = number & { readonly __brand: 'StepNumber' };`
- **Reviewer #2 finding:** TypeScript branded types can replicate Rust's `StepNumber(NonZeroUsize)` newtype pattern.
- **Confidence:** VERY HIGH (both found independently)
- **Implication:** Provides compile-time safety for step number handling

**10. Existing Project Uses ES2020/CommonJS/Strict TypeScript**
- **Reviewer #1 finding:** The turboshovel hooks-app uses CommonJS modules, ES2020 target, and strict TypeScript.
- **Reviewer #2 finding:** Existing hooks-app uses TypeScript 5.x with ES2020 target, strict mode, CommonJS modules, Jest for testing.
- **Confidence:** VERY HIGH (both found independently)
- **Implication:** New parser should follow existing patterns for consistency

**11. Example Workflows Serve as Test Fixtures**
- **Reviewer #1 finding:** Golden file tests should use example workflows in `.reference/workflow/examples/`: `simple.md`, `enforcement.md`, `guided.md`, `test.md`.
- **Reviewer #2 finding:** Example workflows in `.reference/workflow/examples/` demonstrate all syntax patterns; these serve as integration test fixtures.
- **Confidence:** VERY HIGH (both found independently)
- **Implication:** Use these as integration test fixtures

---

## Exclusive Findings (One Reviewer Only)

**Confidence: MODERATE** - Only one reviewer found these. They should be considered but may be less essential.

### Found by Reviewer #1 Only

**1. pulldown-cmark-wasm as Alternative Option**
- **Found by:** Reviewer #1
- **Description:** There is a WebAssembly wrapper for pulldown-cmark (`pulldown-cmark-wasm`) that could provide exact behavior preservation by using the actual Rust parser compiled to WASM.
- **Severity:** NON-BLOCKING (alternative approach)
- **Confidence:** MODERATE
- **Assessment:** Valid alternative if exact parity is needed, but adds WASM dependency. The mdast approach should suffice for semantic extraction.

**2. Comprehensive Validation with Helpful Error Messages**
- **Found by:** Reviewer #1
- **Description:** The parser performs multiple validation passes: empty workflow check, sequential step numbering validation, GOTO target validation, and infinite loop detection. Error messages include suggestions for fixing issues.
- **Severity:** NON-BLOCKING (implementation detail)
- **Confidence:** MODERATE
- **Assessment:** This is implicitly covered in Reviewer #2's test coverage discussion but not called out explicitly. Important for user experience.

### Found by Reviewer #2 Only

**1. markdown-it as Simpler Alternative**
- **Found by:** Reviewer #2
- **Description:** markdown-it provides a token stream approach (similar to pulldown-cmark's event stream) and is simpler than the remark ecosystem. TypeScript types available via @types/markdown-it.
- **Severity:** NON-BLOCKING (alternative approach)
- **Confidence:** MEDIUM
- **Assessment:** Valid alternative if remark/mdast complexity is undesirable. Both reviewers prefer mdast, so this is a backup option.

**2. Implementation Effort Estimate**
- **Found by:** Reviewer #2
- **Description:** Type definitions: 1-2 hours; Core parser with mdast walker: 4-6 hours; Test porting: 2-3 hours; Edge case handling: 2-4 hours. Total: 10-15 hours for feature parity.
- **Severity:** NON-BLOCKING (project planning)
- **Confidence:** MEDIUM
- **Assessment:** Useful for planning. Reviewer #1 did not provide estimates.

---

## Divergences (Requires Investigation)

**Confidence: INVESTIGATE** - Reviewers have different conclusions.

**None**

Both reviewers reached substantially the same conclusions on all key decisions:
- Library choice: micromark/mdast-util-from-markdown
- Strategy: Hybrid (Option C)
- Types: Discriminated unions with branded StepNumber
- Error handling: Result pattern
- Testing: Port Rust tests first

---

## Consolidated Recommendations

### Library Stack (VERY HIGH Confidence)
Both reviewers agree:
1. **Primary:** `mdast-util-from-markdown` - Parse markdown to AST
2. **Walker:** `unist-util-visit` - Walk AST nodes
3. **Types:** `@types/mdast` - TypeScript types for AST nodes
4. **Error handling:** Custom ParseResult type (or `neverthrow` if preferred)

### TypeScript Type Definitions (VERY HIGH Confidence)
Both reviewers provided nearly identical type definitions:

```typescript
// Branded type for step numbers (1-indexed, never zero)
type StepNumber = number & { readonly __brand: 'StepNumber' };

function createStepNumber(n: number): StepNumber | null {
  return n > 0 && Number.isInteger(n) ? (n as StepNumber) : null;
}

// Discriminated union for actions
type Action =
  | { readonly type: 'CONTINUE' }
  | { readonly type: 'STOP'; readonly message?: string }
  | { readonly type: 'GOTO'; readonly step: StepNumber };

// Conditions - always both branches present
interface Conditions {
  readonly pass: Action;
  readonly fail: Action;
}

// Core step type
interface Step {
  readonly number: StepNumber;
  readonly description: string;
  readonly command?: Command;
  readonly prompts: readonly Prompt[];
  readonly conditions?: Conditions;
}

interface Command {
  readonly code: string;
}

interface Prompt {
  readonly text: string;
}

// Parse result using discriminated union
type ParseResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: ParseError };

interface ParseError {
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly suggestion?: string;
}
```

### Risk Assessment (VERY HIGH Confidence)
Both reviewers identified the same risks:

| Risk | Level | Mitigation |
|------|-------|------------|
| Implicit prompt detection | HIGH | Extensive test coverage, explicit state tracking |
| Separator permissiveness | HIGH | Port Rust tests first, exact match of strip_separator |
| Error message parity | MEDIUM | Focus on semantic equivalence, accept formatting differences |
| Unicode/whitespace edge cases | MEDIUM | Use micromark (CommonMark compliant), add specific tests |
| Legacy syntax support | LOW | Port legacy syntax tests explicitly |

### Test Strategy (VERY HIGH Confidence)
Both reviewers agree on approach:

1. **Port Rust Unit Tests First** - Extract all 50+ test cases from `parser.rs` tests module
2. **Golden File Tests** - Use example workflows as fixtures
3. **Edge Case Coverage** - All separator variations, implicit prompts, validation errors
4. **Cross-Validation (optional)** - Run both parsers on same input, compare outputs

---

## Overall Assessment

**Ready to proceed?** YES

**Reasoning:**
Both independent research reviews reached substantially identical conclusions on all key decisions. There are no divergences requiring resolution. The recommendations have VERY HIGH confidence due to dual verification.

**Key decisions confirmed:**
1. Use `mdast-util-from-markdown` for markdown parsing (not hand-rolled)
2. Hybrid strategy: library for tokenization, custom walker for semantics
3. Discriminated unions with branded StepNumber for type safety
4. ParseResult pattern for error handling
5. Port Rust tests first as specification

**Implementation effort:** 10-15 hours (per Reviewer #2)

**Confidence level:**
- **High confidence (common):** 11 findings - all core architecture and approach decisions
- **Moderate confidence (exclusive):** 4 findings - alternative options and estimates
- **Investigation required (divergences):** 0 - no disagreements

---

## Next Steps

1. **Create implementation plan** based on these consolidated recommendations
2. **Port Rust type definitions** to TypeScript (1-2 hours)
3. **Port Rust tests first** as specification (2-3 hours)
4. **Implement parser** using mdast-util-from-markdown (4-6 hours)
5. **Refine edge cases** based on test failures (2-4 hours)

### Questions for Stakeholder Decision

Both reviewers noted these questions require stakeholder input:
- Should the TypeScript parser be a separate npm package or bundled with hooks-app?
- Is there a preference for `neverthrow` vs custom ParseResult type for error handling?
- Should we support streaming parsing for very large workflows? (likely no - workflows are small)

---

**STATUS: COMPLETE**

Report saved to: `/Users/tobyhede/psrc/turboshovel/.work/2025-12-20-verify-research-collated-143900.md`
