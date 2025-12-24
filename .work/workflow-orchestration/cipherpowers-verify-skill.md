# Cipherpowers Verify Skill (Reference Copy)

> Copied from `/Users/tobyhede/src/cipherpowers/plugin/skills/dual-verification/SKILL.md`
> Date: 2025-12-22

---
name: dual-verification
description: Use two independent agents for reviews or research, then collate findings to identify common findings, unique insights, and divergences
when_to_use: comprehensive audits, plan reviews, code reviews, research tasks, codebase exploration, verifying content matches implementation, quality assurance for critical content
version: 1.0.0
---

# Dual Verification Review

## Overview

Use two independent agents to systematically review content or research a topic, then use a collation agent to compare findings.

**Core principle:** Independent dual perspective + systematic collation = higher quality, managed context.

**Announce at start:** "I'm using the dual-verification skill for comprehensive [review/research]."

## Quick Reference

| Phase | Action | Output | User Action |
|-------|--------|--------|-------------|
| **Phase 1** | Dispatch 2 agents in parallel | Two independent reports | Wait |
| **Phase 2** | Collate findings, present to user | Collated report | Can `/revise common` |
| **Phase 3** | Cross-check exclusive issues (background) | Validated exclusive issues | Can `/revise exclusive` or `/revise all` |

**Confidence levels:**
- **VERY HIGH:** Both agents found (high confidence - act on this)
- **MODERATE:** One agent found (unique insight - needs cross-check)
- **INVESTIGATE:** Agents disagree (resolved during collation)

**Exclusive issue states (after cross-check):**
- **VALIDATED:** Cross-check confirmed issue exists → implement
- **INVALIDATED:** Cross-check found issue doesn't apply → skip
- **UNCERTAIN:** Cross-check couldn't determine → user decides

## The Three-Phase Process

### Phase 1: Dual Independent Review

**Dispatch 2 agents in parallel with identical prompts.**

**Agent prompt template:**
```
You are [agent type] conducting an independent verification review.

**Context:** You are one of two agents performing parallel independent reviews. Another agent is reviewing the same content independently. A collation agent will later compare both reviews.

**Your task:** Systematically verify [subject] against [ground truth].

**Critical instructions:**
- Current content CANNOT be assumed correct. Verify every claim.
- You MUST follow the review report template structure
- Template location: ${CLAUDE_PLUGIN_ROOT}templates/verify-template.md
- You MUST save your review with timestamp: `.work/{YYYY-MM-DD}-verify-{type}-{HHmmss}.md`
- Time-based naming prevents conflicts when agents run in parallel.
- Work completely independently - the collation agent will find and compare all reviews.

**Process:**

1. Read the review report template to understand the expected structure
2. Read [subject] completely
3. For each [section/component/claim]:
   - Identify what is claimed
   - Verify against [ground truth]
   - Check for [specific criteria]

4. Categorize issues by:
   - Category ([issue type 1], [issue type 2], etc.)
   - Location (file/section/line)
   - Severity ([severity levels])

5. For each issue, provide:
   - Current content (what [subject] says)
   - Actual [ground truth] (what is true)
   - Impact (why this matters)
   - Action (specific recommendation)

6. Save using template structure with all required sections

**The template provides:**
- Complete structure for metadata, issues, summary, assessment
- Examples of well-written reviews
- Guidance on severity levels and categorization
```

### Phase 2: Collate Findings and Present

**Dispatch collation agent to compare the two reviews, then present to user immediately.**

**Dispatch collation agent:**
```
Use Task tool with:
  subagent_type: "cipherpowers:review-collation-agent"
  description: "Collate dual [review type] reviews"
  prompt: "You are collating two independent [review type] reviews.

**Critical instructions:**
- You MUST follow the collation report template structure
- Template location: ${CLAUDE_PLUGIN_ROOT}templates/verify-collation-template.md
- Read the template BEFORE starting collation
- Save to: `.work/{YYYY-MM-DD}-verify-{type}-collated-{HHmmss}.md`

**Inputs:**
- Review #1: [path to first review file]
- Review #2: [path to second review file]

**Your task:**

1. **Read the collation template** to understand the required structure

2. **Parse both reviews completely:**
   - Extract all issues from Review #1
   - Extract all issues from Review #2
   - Create internal comparison matrix

3. **Identify common issues** (both found):
   - Same issue found by both reviewers
   - Confidence: VERY HIGH

4. **Identify exclusive issues** (only one found):
   - Issues found only by Agent #1
   - Issues found only by Agent #2
   - Confidence: MODERATE (pending cross-check)

5. **Identify divergences** (agents disagree):
   - Same location, different conclusions
   - Contradictory findings

6. **IF divergences exist → Verify with appropriate agent:**
   - Dispatch verification agent for each divergence
   - Provide both perspectives and specific divergence point
   - Incorporate verification analysis into report

7. **Follow template structure for output:**
   - Metadata section (complete all fields)
   - Executive summary (totals and breakdown)
   - Common issues (VERY HIGH confidence)
   - Exclusive issues (MODERATE confidence - pending cross-check)
   - Divergences (with verification analysis)
   - Recommendations (categorized by action type)
   - Overall assessment

**The template provides:**
- Complete structure with all required sections
- Examples of well-written collation reports
- Guidance on confidence levels and categorization
- Usage notes for proper assessment
```

**Present collated report to user immediately:**

```
Collation complete. Report saved to: [path]

**Summary:**
- Common issues: X (VERY HIGH confidence) → Can `/revise common` now
- Exclusive issues: X (MODERATE - cross-check starting)
- Divergences: X (resolved/unresolved)

**Status:** Cross-check running in background...
```

**User can now `/revise common` while cross-check runs.**

### Phase 3: Cross-check Exclusive Issues

**Dispatch cross-check agent to validate exclusive issues against the codebase/implementation.**

This phase runs in the background after presenting collation to user.

**Purpose:** Exclusive issues have MODERATE confidence because only one reviewer found them. Cross-check validates whether the issue actually exists by checking against ground truth.

**Dispatch cross-check agent:**
```
Use Task tool with:
  subagent_type: "[appropriate agent for review type]"
  description: "Cross-check exclusive issues"
  prompt: "You are cross-checking exclusive issues from a dual-verification review.

**Context:**
Two independent reviewers performed a [review type] review. The collation identified
issues found by only one reviewer (exclusive issues). Your task is to validate
whether each exclusive issue actually exists.

**Collation report:** [path to collation file]

**Your task:**

For EACH exclusive issue in the collation report:

1. **Read the issue description** from the collation report
2. **Verify against ground truth:**
   - For doc reviews: Check if the claim is accurate against codebase
   - For code reviews: Check if the issue exists in the implementation
   - For plan reviews: Check if the concern is valid against requirements
3. **Assign validation status:**
   - VALIDATED: Issue confirmed to exist → should be addressed
   - INVALIDATED: Issue does not apply → can be skipped
   - UNCERTAIN: Cannot determine → escalate to user

**Output format:**
For each exclusive issue, provide:
- Issue: [from collation]
- Source: Reviewer #[1/2]
- Validation: [VALIDATED/INVALIDATED/UNCERTAIN]
- Evidence: [what you found that supports your conclusion]
- Recommendation: [action to take]

**Save to:** `.work/{YYYY-MM-DD}-verify-{type}-crosscheck-{HHmmss}.md`
```

**Agent selection for cross-check:**
| Review Type | Cross-check Agent |
|-------------|-------------------|
| docs | cipherpowers:code-agent (verify against implementation) |
| code | cipherpowers:code-agent (verify against codebase) |
| plan | cipherpowers:plan-review-agent (verify against requirements) |
| execute | cipherpowers:execute-review-agent (verify against plan) |

**When cross-check completes:**

```
Cross-check complete. Report saved to: [path]

**Exclusive Issues Status:**
- VALIDATED: X issues (confirmed, should address)
- INVALIDATED: X issues (can skip)
- UNCERTAIN: X issues (user decides)

**Ready for:** `/cipherpowers:revise exclusive` or `/cipherpowers:revise all`
```

## Dispatch Defaults (from verify.md command)

| Type     | Agents                         | Model  |
|----------|--------------------------------|--------|
| code     | code-review-agent + code-agent | opus   |
| plan     | plan-review-agent + code-agent | opus   |
| execute  | execute-review-agent ×2        | opus   |
| research | research-agent ×2              | opus   |
| docs     | technical-writer + code-agent  | opus   |

## Remember

- Dispatch 2 agents in parallel for Phase 1 (efficiency)
- Use identical prompts for both agents (fairness)
- Dispatch collation agent for Phase 2 (context management)
- Present collation to user immediately after Phase 2 (user can `/revise common`)
- Dispatch cross-check agent for Phase 3 in background (parallel workflow)
- Common issues = VERY HIGH confidence (both found) → implement immediately
- Exclusive issues = MODERATE confidence → cross-check validates → VALIDATED/INVALIDATED/UNCERTAIN
- Divergences = resolved during collation (verification agent determines correct perspective)
- Cross-check enables parallel workflow: user starts `/revise common` while cross-check runs
- Cost-benefit: Use for high-stakes, skip for trivial changes
