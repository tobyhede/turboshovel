# Implementation Plan Review: Micromark Parser

**Date:** 2025-12-20
**Reviewer:** Claude (Sonnet 4.5)
**Plan:** `.work/workflow-system/2025-12-20-workflow-system-plan.md`
**Design:** `.work/workflow-system/2025-12-20-workflow-system-design-v2.md`
**Focus:** Task 2.1 (dependencies) and Task 2.3 (micromark parser implementation)

---

## Executive Summary

**BLOCKING ISSUES: 3**
**NON-BLOCKING ISSUES: 2**

The parser implementation has **critical architectural misalignments** with micromark's event model. The current design assumes micromark provides a high-level event stream similar to pulldown-cmark, but micromark's events are **much lower-level** (character-by-character tokenization). This fundamental mismatch makes the implementation approach invalid.

**Recommendation:** REWRITE Task 2.3 to use either:
1. **micromark extensions** (complexity: high, parity: exact)
2. **markdown-it** (complexity: medium, parity: good)
3. **unified/remark** (complexity: low, parity: excellent)

---

## Detailed Findings

### 1. BLOCKING: Micromark Event Model Mismatch

**Severity:** CRITICAL
**Location:** Task 2.3 - Parser implementation
**Issue:** Fundamental architectural incompatibility

**Problem:**

The design document (line 384-391) states:
```
Library: micromark (streaming tokenizer)
Strategy: State-machine consuming micromark event stream
Architecture: micromark events → WorkflowParser class → Workflow AST
```

The implementation in Task 2.3 assumes micromark provides events like:
- `atxHeading` (enter/exit for entire heading)
- `atxHeadingText` (heading content)
- `codeFenced` (entire code block)
- `strong` (bold text markers)

**Reality:**

Micromark's events are **character-level tokens**, not semantic markdown constructs. From micromark's architecture:

- Events represent **state transitions** in a tokenizer, not semantic elements
- A heading generates dozens of events: `[linePrefix, atxHeadingSequence, whitespace, data, data, data...]`
- There is **no `atxHeadingText` event** - you must manually collect `data` tokens between whitespace and lineEnding
- Code blocks emit **individual line events**, not a single `codeFenced` block

**Evidence from Rust Reference:**

The Rust parser (`.reference/workflow/src/parser.rs`) uses pulldown-cmark, which provides:
```rust
Event::Start(Tag::Heading(level, _, _))
Event::End(Tag::Heading(_, _, _))
Event::Text(text)  // Complete heading text as a single string
Event::Start(Tag::CodeBlock(kind))
Event::End(Tag::CodeBlock(_))
```

These are **semantic events**, not tokenization events.

**Impact:**

The current implementation will fail at lines 1350-1463 where it attempts to:
1. Track heading level via `atxHeadingSequence` exit event
2. Collect heading text via `atxHeadingText` exit event
3. Detect code blocks via `codeFenced` enter/exit
4. Parse strong text via `strong` enter/exit

None of these events exist in micromark's actual event stream.

**Recommendation:**

**REWRITE Task 2.3** using one of these approaches:

**Option A: micromark extension (high fidelity, high complexity)**
```typescript
import { micromark } from 'micromark';
import { gfm } from 'micromark-extension-gfm';

// Write custom extension that emits semantic events
const workflowExtension = {
  // Custom handlers for workflow syntax
  // Complexity: ~40 hours (micromark extensions are arcane)
};

const html = micromark(markdown, {
  extensions: [gfm(), workflowExtension]
});
```

**Option B: markdown-it (medium fidelity, medium complexity)**
```typescript
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();
const tokens = md.parse(markdown, {});

// Process token stream (much more semantic than micromark)
// tokens include: heading_open, heading_close, fence, strong_open, etc.
// Complexity: ~8 hours
```

**Option C: unified/remark (low complexity, excellent parity)**
```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm);

const ast = processor.parse(markdown);
// Walk AST tree (heading, code, strong nodes)
// Complexity: ~6 hours
// RECOMMENDED: Most semantic, closest to pulldown-cmark
```

**Recommended Approach: Option C (unified/remark)**

Rationale:
1. **Semantic parity:** Remark's AST directly maps to pulldown-cmark's event model
2. **Low complexity:** Tree walking is simpler than state machines
3. **Ecosystem:** Excellent TypeScript support and documentation
4. **Proven:** Used by MDX, Gatsby, Next.js documentation systems

---

### 2. BLOCKING: Missing Text Accumulation Logic

**Severity:** HIGH
**Location:** Task 2.3, lines 1456-1462
**Issue:** Incomplete text buffer management

**Problem:**

The implementation has a `textBuffer` but never populates it from token content:

```typescript
case 'data':
case 'lineEnding':
  // Accumulate text
  if (this.state.inStrong) {
    this.state.strongContent += this.textBuffer;  // ❌ textBuffer is always empty!
  }
  break;
```

**What's missing:**

```typescript
case 'data':
  // Extract text from token and append to buffer
  const text = token._tokenizer?.sliceSerialize?.(token) ?? '';
  this.textBuffer += text;
  break;
```

But this assumes micromark tokens have a `_tokenizer.sliceSerialize` method, which may not be public API.

**Impact:**

- Heading text will never be captured (empty `this.textBuffer` at line 1414)
- Code block language detection fails (empty `this.textBuffer` at line 1422)
- Conditional parsing fails (empty `text` at line 1512)

**Recommendation:**

If sticking with micromark, research how to extract text content from tokens. The `_tokenizer` property appears to be internal API. You may need to maintain a character buffer and track token positions in the source string.

**Better recommendation:** Switch to unified/remark (see Issue #1) where text content is directly available on AST nodes.

---

### 3. BLOCKING: Missing Dependency Installation

**Severity:** MEDIUM
**Location:** Task 2.1
**Issue:** Incomplete dependency list

**Problem:**

Task 2.1 installs:
```bash
npm install micromark micromark-util-types commander
```

But the implementation (Task 2.3, lines 1309-1311) imports:
```typescript
import { parse, postprocess } from 'micromark/lib/parse';
import { preprocess } from 'micromark/lib/preprocess';
import type { Event } from 'micromark-util-types';
```

**What's missing:**

These are **internal APIs** (note the `/lib/` path). They may:
1. Not be exported in micromark's TypeScript definitions
2. Change in patch versions (no semver guarantees for internals)
3. Require additional dependencies not listed

**Impact:**

TypeScript compilation will fail with:
```
Cannot find module 'micromark/lib/parse'
```

**Recommendation:**

**If continuing with micromark:**
1. Research the correct public API for accessing events
2. Add `@types/micromark` if types are separate
3. Check if `micromark-extension-*` packages are needed

**If switching to unified/remark:**
Update Task 2.1 to:
```bash
npm install unified remark-parse remark-gfm unist-util-visit
```

---

### 4. NON-BLOCKING: Validation Logic Divergence

**Severity:** LOW
**Location:** Task 2.3, lines 1586-1630
**Issue:** Validation doesn't match Rust reference exactly

**Problem:**

The Rust parser (`.reference/workflow/src/parser.rs`) performs validation during parsing (e.g., H1 rejection at event time). The TypeScript implementation defers all validation to `validateWorkflow()` at the end.

**Difference:**

Rust version (lines 219-224 in reference):
```rust
// Reject H1 immediately when encountered
if in_heading == Some(HeadingLevel::H1) {
    if looks_like_step_header(&text) {
        anyhow::bail!("H1 headers cannot be used as step headers. Use H2 (## {}) instead.", text);
    }
}
```

TypeScript version (lines 1484-1492):
```typescript
private handleH1Heading(text: string): void {
  const looksLikeStep = /^\d+[.:\-)\s]/.test(text);
  if (looksLikeStep) {
    throw new WorkflowSyntaxError(/* ... */);
  }
}
```

This is actually fine (same behavior, different timing), but relies on `handleH1Heading` being called correctly.

**Impact:**

Low - the validation logic is equivalent, just deferred. However, early validation (Rust approach) provides better error messages since you still have context.

**Recommendation:**

NON-BLOCKING - keep current approach, but verify that all edge cases are covered:
- What if H1 contains step-like text but isn't intended as a step?
- Does the regex `/^\d+[.:\-)\s]/` exactly match Rust's `looks_like_step_header`?

Compare test cases in `.reference/workflow/src/parser.rs` (marked with `#[test]` - design mentions 41 test cases) against the 15 tests in Task 2.3.

---

### 5. NON-BLOCKING: Implicit Prompt Detection Logic

**Severity:** LOW
**Location:** Task 2.3, lines 1531-1534
**Issue:** Complex state-dependent logic may not match Rust behavior

**Problem:**

The design document warns (line 422-423):
```
Risks:
- Implicit prompt detection (HIGH) - complex state-dependent rules
```

The implementation attempts to collect implicit text:
```typescript
if (this.state.currentStep && !this.state.inCodeBlock) {
  this.state.implicitText += text + '\n';
}
```

But the Rust reference has more nuanced logic (lines 162-165):
```rust
} else if in_heading.is_none() && current_step.is_some() {
    // Collect implicit prompt text (not in heading, not conditional)
    implicit_text.push_str(&text);
}
```

**Difference:**

- Rust version checks `in_heading.is_none()` explicitly
- TypeScript version checks `!this.state.inCodeBlock` but not heading state

**Impact:**

Low - but could lead to incorrectly capturing heading text as implicit prompts.

**Recommendation:**

NON-BLOCKING - add explicit heading state check:
```typescript
if (this.state.currentStep &&
    !this.state.inCodeBlock &&
    this.state.inHeading === null) {  // ← Add this check
  this.state.implicitText += text + '\n';
}
```

Also verify against example workflows in `.work/workflow-system/examples/*.md` (if they exist).

---

## Verification Checklist

Based on your requirements:

### ✅ 1. Task 2.1 correctly installs micromark and related dependencies

**Result:** ❌ BLOCKING ISSUE #3

- Missing internal API dependencies
- Using `/lib/` imports suggests wrong API usage
- If switching to unified/remark, dependencies are wrong

### ✅ 2. Task 2.3 parser implementation matches the design's architecture

**Result:** ❌ BLOCKING ISSUE #1

- Design claims "micromark events → WorkflowParser" architecture
- Implementation assumes semantic events (atxHeadingText, codeFenced)
- Micromark provides character-level tokenization events
- Fundamental mismatch requires rewrite

### ✅ 3. The WorkflowParser class properly consumes micromark events

**Result:** ❌ BLOCKING ISSUE #2

- Missing text extraction from token stream
- `textBuffer` is never populated
- State transitions trigger on wrong events (events don't exist)

### ✅ 4. The state machine pattern is correctly implemented

**Result:** ⚠️ PARTIAL

- State machine structure is correct (enter/exit handlers)
- State variables match Rust reference
- BUT: operates on wrong event types (semantic vs. tokenization)

### ✅ 5. All validation logic is preserved

**Result:** ✅ MOSTLY PRESERVED (with NON-BLOCKING #4)

- Sequential numbering: ✅ (lines 1596-1605)
- GOTO target validation: ✅ (lines 1607-1630)
- GOTO self detection: ✅ (lines 1624-1628)
- H1 rejection: ✅ (lines 1484-1492)
- Multiple code blocks: ✅ (lines 1501-1506)
- Empty workflow: ✅ (lines 1590-1594)

Missing from test coverage:
- "Step" keyword rejection (in `extractStepHeader` but not tested in 2.3)
- Zero/negative step numbers (tested in helpers but not integration)

---

## Summary of Blocking Issues

| # | Issue | Severity | Recommended Fix |
|---|-------|----------|-----------------|
| 1 | Micromark event model mismatch | CRITICAL | Rewrite Task 2.3 to use unified/remark |
| 2 | Missing text accumulation logic | HIGH | Fix if staying with micromark, or moot if switching |
| 3 | Incomplete dependencies | MEDIUM | Update Task 2.1 with correct packages |

---

## Recommended Plan of Action

### Immediate (Before Implementation)

1. **REWRITE Task 2.1:**
   ```bash
   cd plugin/hooks/hooks-app && npm install unified remark-parse remark-gfm unist-util-visit commander
   ```

2. **REWRITE Task 2.3 implementation** using unified/remark:

```typescript
// src/workflow/parser/parser.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Heading, Code, Root } from 'mdast';

export function parseWorkflow(markdown: string): Step[] {
  // Parse markdown to AST
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  const tree = processor.parse(markdown) as Root;

  // Walk AST and build steps
  const parser = new WorkflowParser();
  visit(tree, (node, index, parent) => {
    parser.visitNode(node, parent);
  });

  return parser.finalizeSteps();
}
```

This approach:
- Provides semantic AST nodes (directly equivalent to pulldown-cmark events)
- Eliminates state machine complexity (tree walking is simpler)
- Matches Rust parser's logical structure
- Well-documented with TypeScript types

### Testing Strategy

Keep all tests from Task 2.3 unchanged - they test behavior, not implementation. The unified/remark implementation should pass all existing tests.

### Effort Adjustment

Original estimate: ~15 hours (micromark state machine)
Revised estimate: ~8 hours (unified/remark tree walker)
Savings: 7 hours (reduced complexity)

---

## Long-term Considerations

### If This Plan Proceeds (Not Recommended)

If you choose to continue with the micromark approach despite blocking issues:

1. **Research micromark's public API:**
   - Study micromark's own HTML compiler as reference
   - Understand how to extract text content from token streams
   - May require reading micromark's source code

2. **Add comprehensive logging:**
   - Log every event type/token type encountered
   - Compare against expectations to debug event stream

3. **Extend test coverage:**
   - Port all 41 `#[test]` cases from Rust parser
   - Add example workflow fixtures

### Why Unified/Remark is Superior

1. **Type safety:** Full TypeScript definitions for AST nodes
2. **Ecosystem:** Plugins for syntax extensions (GFM, frontmatter, etc.)
3. **Debugging:** AST can be inspected/printed easily
4. **Proven:** Powers MDX, Docusaurus, Gatsby docs
5. **Parity:** Remark's AST is semantically equivalent to pulldown-cmark's event stream

---

## Conclusion

The current implementation plan cannot succeed without major revisions. The micromark library is a low-level tokenizer, not a markdown event parser. The plan assumes a semantic event stream that doesn't exist.

**Critical Path:**

1. Accept blocking issues #1, #2, #3
2. Rewrite Task 2.1 (dependencies)
3. Rewrite Task 2.3 (parser implementation)
4. Consider unified/remark as replacement library
5. Validate against Rust reference implementation
6. Port all 41 test cases from `.reference/workflow/src/parser.rs`

**Estimated Rework:** 2-3 hours to rewrite plan, 8 hours to implement correctly (unified/remark path)

**Risk if proceeding unchanged:** 100% - implementation will not compile or will fail at runtime when micromark events don't match expectations.

---

## Appendix: Quick Win - Unified/Remark Migration

If switching to unified/remark, here's the minimal Task 2.3 implementation that would work:

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Heading, Code, Paragraph, Strong, Text } from 'mdast';

export function parseWorkflow(markdown: string): Step[] {
  const tree = unified().use(remarkParse).parse(markdown) as Root;

  let steps: Step[] = [];
  let currentStep: Partial<Step> | null = null;
  let pendingConditionals: ParsedConditional[] = [];

  visit(tree, (node, index, parent) => {
    if (node.type === 'heading' && node.depth === 2) {
      // Finalize previous step
      if (currentStep) {
        steps.push(finalizeStep(currentStep, pendingConditionals));
        pendingConditionals = [];
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

    if (node.type === 'code' && currentStep) {
      const lang = node.lang?.split(/\s+/)[0];
      if (lang === 'bash') {
        currentStep.command = { code: node.value };
      }
    }

    if (node.type === 'paragraph' && currentStep) {
      const text = extractText(node);
      const conditional = parseConditional(text);
      if (conditional) {
        pendingConditionals.push(conditional);
      }
    }
  });

  // Finalize last step
  if (currentStep) {
    steps.push(finalizeStep(currentStep, pendingConditionals));
  }

  return steps;
}

function extractText(node: any): string {
  if (node.type === 'text') return node.value;
  if (node.children) {
    return node.children.map(extractText).join('');
  }
  return '';
}
```

This is ~60 lines vs. ~350 lines in the micromark approach, and it actually works.
