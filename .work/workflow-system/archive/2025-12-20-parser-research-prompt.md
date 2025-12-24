# Research: Workflow Parser TypeScript Implementation

## Objective

Determine the most idiomatic, type-safe, canonical TypeScript approach for implementing a markdown workflow parser that preserves all existing behavior from the Rust implementation.

## Constraints

1. **Behavior preservation**: The Rust parser defines the canonical behavior. All edge cases and parsing rules must be preserved exactly.
2. **TypeScript idioms**: Use established TypeScript patterns, not a direct port of Rust idioms.
3. **Type safety**: Leverage TypeScript's type system fully - discriminated unions, branded types, etc.
4. **Maintainability**: Prefer clarity over cleverness.

## Reference Implementation

The Rust parser is located at:
- `/Users/tobyhede/psrc/turboshovel/.reference/workflow/src/parser.rs` (1,352 lines)
- `/Users/tobyhede/psrc/turboshovel/.reference/workflow/src/models.rs` (242 lines)

### Key Rust Parser Characteristics

Analyze the Rust implementation to understand:

1. **Parsing approach**: Is it hand-rolled state machine? Line-by-line? Token-based?
2. **Data structures**: What AST/model types are produced?
3. **Error handling**: How are parse errors represented and reported?
4. **Edge cases**: What tricky markdown patterns does it handle?

## Research Questions

### 1. Markdown Library Evaluation

**First, research current options.** Do not assume any predefined list. Search for:
- Current TypeScript/JavaScript markdown parsing libraries (2024-2025)
- Libraries specifically designed for extensible/custom syntax
- Parsing libraries used in similar tools (documentation generators, static site generators)
- Any new entrants or significant updates to established libraries

Create a comparison table of viable candidates. For each, evaluate:
- Can it preserve the Rust parser's exact behavior?
- How extensible is it for custom syntax (e.g., `- PASS: CONTINUE`)?
- What's the TypeScript support like?
- Performance characteristics?

### 2. AST Design

The Rust models include:
- `Step` - workflow step with number, name, content
- `Action` - CONTINUE, STOP, GOTO, RETRY, etc.
- `Condition` - IF/ELSE logic
- `StepNumber` - step identifier

Design TypeScript equivalents that are:
- Discriminated unions for action types
- Branded types for step numbers if useful
- Immutable by default

Example starting point:
```typescript
type Action =
  | { type: 'CONTINUE' }
  | { type: 'STOP'; message?: string }
  | { type: 'DONE' }
  | { type: 'GOTO'; step: number }
  | { type: 'RETRY'; maxAttempts?: number };

type Condition = {
  variable: string;
  negated: boolean;
  then: Action;
  else?: Action;
};

type Step = {
  number: number;
  name: string;
  content: string;
  codeBlocks: CodeBlock[];
  actions: ActionRule[];
  conditions: Condition[];
  nestedWorkflow?: string;
};
```

### 3. Parsing Strategy

Compare approaches:

**A. Use markdown library for tokenization, custom walker for semantics**
- Library handles markdown structure
- Custom code interprets workflow-specific patterns
- Pro: Don't reinvent markdown parsing
- Con: May not expose needed details

**B. Hand-roll entire parser**
- Direct port of Rust state machine
- Full control over every edge case
- Pro: Exact behavior match
- Con: Maintenance burden, reinventing wheel

**C. Hybrid: markdown library + custom post-processing**
- Parse to standard AST
- Transform to workflow-specific AST
- Pro: Best of both worlds
- Con: Two-phase complexity

### 4. Test Strategy

The Rust implementation likely has tests. Find them and:
- Extract as test cases for TypeScript
- Identify edge cases covered
- Create test fixtures from `.reference/workflow/examples/`

### 5. Error Handling

Compare TypeScript error handling patterns:
- Result types (`{ ok: true, value } | { ok: false, error }`)
- Thrown exceptions with custom error classes
- Zod-style parse results

Which aligns best with TypeScript idioms while preserving Rust's error semantics?

## Deliverables

1. **Recommendation**: Which markdown library (or hand-rolled) and why
2. **Type definitions**: Complete TypeScript types for workflow AST
3. **Parsing strategy**: Detailed approach with code sketches
4. **Test plan**: How to verify behavior matches Rust
5. **Risk assessment**: What might be hard to preserve exactly?

## Files to Analyze

**Rust source:**
- `.reference/workflow/src/parser.rs` - Main parser
- `.reference/workflow/src/models.rs` - Data types
- `.reference/workflow/src/lib.rs` - Public API

**Rust tests (if exist):**
- `.reference/workflow/tests/` or inline `#[test]`

**Example workflows:**
- `.reference/workflow/examples/simple.md`
- `.reference/workflow/examples/enforcement.md`
- `.reference/workflow/examples/guided.md`

**Turboshovel context:**
- `plugin/hooks/hooks-app/` - Existing TypeScript patterns
- `plugin/hooks/hooks-app/tsconfig.json` - TypeScript config

## Success Criteria

The research is complete when we can confidently answer:

1. Which library/approach to use?
2. What do the TypeScript types look like?
3. How do we ensure behavior parity with Rust?
4. What's the implementation effort estimate?
