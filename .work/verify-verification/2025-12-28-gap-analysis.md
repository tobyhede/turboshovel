# Verification System Gap Analysis

## Comparison: Turboshovel vs Cipherpowers `/verify` Command

**Purpose:** Systematic analysis of gaps and divergences between the two implementations.

---

## Executive Summary

| Category | Cipherpowers | Turboshovel | Gap |
|----------|-------------|-------------|-----|
| Commands | verify, revise | verify only | Missing revise |
| Skills | dual-verification + 4 supporting | verifying-by-consensus only | Missing 5 skills |
| Agents | 6 specialized agents | None | Missing all agents |
| Templates | 4 detailed templates | 2 minimal templates | Less detailed |
| Verification Types | 5 types (code, plan, execute, research, docs) | Generic (type-agnostic) | No type system |
| Workflow Orchestration | Manual 3-phase process | CLI-driven workflow system | Different approach |
| Cross-check Support | Full cross-check with validation states | Cross-check defined in workflow | Equivalent |

---

## 1. COMMANDS

### Cipherpowers

**verify command** (`plugin/commands/verify.md`):
```
/cipherpowers:verify <type> [scope] [model]
```
- Types: `code`, `plan`, `execute`, `research`, `docs`
- Model override: `haiku`, `sonnet`, `opus`
- Agent dispatch table per type
- `argument-hint` metadata

**revise command** (`plugin/commands/revise.md`):
```
/cipherpowers:revise [scope] [collation-file]
```
- Scopes: `common`, `exclusive`, `all`
- Works with collation reports from /verify
- Uses `revising-findings` skill

### Turboshovel

**verify command** (`plugin/commands/verify.md`):
```
/turboshovel:verify $ARGUMENTS
```
- No typed verification
- No argument hints
- Uses `verifying-by-consensus` skill

**revise command**: Does not exist

---

## 2. SKILLS

### Cipherpowers Skills (`plugin/skills/`)

| Skill | Purpose | Lines |
|-------|---------|-------|
| `dual-verification` | Two independent agents, collate findings | ~400 |
| `conducting-code-review` | Thorough code review workflow | ~100 |
| `verifying-plans` | 35-point plan quality checklist | ~80 |
| `verifying-plan-execution` | Plan adherence verification | ~80 |
| `research-methodology` | Multi-angle research with evidence | ~80 |
| `revising-findings` | Implement findings from /verify | ~50 |

### Turboshovel Skills (`plugin/skills/`)

| Skill | Purpose | Lines |
|-------|---------|-------|
| `verifying-by-consensus` | N-agent consensus verification | ~105 |
| `workflow` | Workflow control | ~50 |

**Missing:** 5 specialized skills from cipherpowers

---

## 3. AGENTS

### Cipherpowers Agents (`plugin/agents/`)

| Agent | Role | Skills Used |
|-------|------|-------------|
| `code-review-agent` | Code quality review | conducting-code-review |
| `plan-review-agent` | Plan evaluation (35 points) | verifying-plans |
| `execute-review-agent` | Plan adherence check | verifying-plan-execution |
| `research-agent` | Multi-angle research | research-methodology |
| `technical-writer` | Documentation verification | maintaining-docs |
| `review-collation-agent` | Finding synthesis | dual-verification |

Each agent has:
- Color designation
- Mandatory skill reference
- Output file naming pattern
- Specific role description

### Turboshovel Agents

**No agents directory exists.**

Skill relies on fallback:
1. Explicit `--agents` arg
2. Available plugins (cipherpowers agents if installed)
3. Claude's built-in Explore/Plan agents
4. N instances of same agent with different prompts

---

## 4. TEMPLATES

### Cipherpowers Templates (`plugin/templates/`)

| Template | Lines | Key Features |
|----------|-------|--------------|
| `verify-template.md` | ~90 | Review/Research modes, metadata, BLOCKING/SUGGESTIONS, confidence levels |
| `verify-collation-template.md` | ~230 | Executive summary, cross-check status, parallel workflow guide, confidence levels |
| `verify-plan-template.md` | ~100 | 35-point checklist, task granularity checks |
| `verification-checklist-template.md` | ~60 | Pre-requisites, automated checks, escalation procedures |

### Turboshovel Templates (`plugin/templates/`)

| Template | Lines | Key Features |
|----------|-------|--------------|
| `verify-review.md` | ~40 | Basic BLOCKING/SUGGESTIONS structure |
| `verify-collation.md` | ~60 | Basic consensus ratio grouping (N/N, N-1/N, 1/N) |

**Notable Differences:**
- Turboshovel templates lack Review/Research mode differentiation
- No confidence level guidance in templates
- No cross-check status tracking embedded in template
- No parallel workflow recommendations
- No 35-point plan quality checklist
- No verification checklist template

---

## 5. VERIFICATION TYPE SYSTEM

### Cipherpowers Type Mappings

| Type | Agent Pair | Ground Truth |
|------|-----------|--------------|
| code | code-review-agent + code-agent | Coding standards, tests |
| plan | plan-review-agent + code-agent | 35 quality criteria |
| execute | execute-review-agent ×2 | Plan specification |
| research | research-agent ×2 | Source material/docs |
| docs | technical-writer + code-agent | Implementation codebase |

### Turboshovel Type Mappings

No predefined type system. Uses heuristics:

| Scope | Default N | Agent Selection |
|-------|-----------|-----------------|
| Single file | 2 | Fallback chain |
| Multi-file | 2-3 | Fallback chain |
| Architecture | 3 | Fallback chain |
| Security | 3+ | Fallback chain |

Agent selection fallback:
1. `--agents` arg
2. Available plugins
3. Built-in Claude agents
4. Same agent with different prompts

---

## 6. WORKFLOW ORCHESTRATION

### Cipherpowers Approach (Skill-Centric)

Three-phase process defined in `dual-verification` skill:

**Phase 1:** Dispatch 2 agents in parallel
- Identical prompts
- Independent work
- Timestamp-based file naming

**Phase 2:** Collate findings
- Dispatch `review-collation-agent`
- Categorize: Common (VERY HIGH), Exclusive (MODERATE), Divergences
- Present to user immediately
- User can `/revise common` now

**Phase 3:** Cross-check (background)
- Validate exclusive findings against ground truth
- Mark: VALIDATED, INVALIDATED, UNCERTAIN
- User notified when complete
- Can `/revise exclusive` or `/revise all`

**State:** Stateless. No persistence between steps.

### Turboshovel Approach (Workflow-Centric)

Four-step workflow defined in `verify.workflow.md`:

**Step 1:** Dispatch review agents
- Dynamic subtask syntax (`1.{n}`)
- Agent binding protocol
- PASS/FAIL conditions

**Step 2:** Collate findings
- Read all review files
- Categorize by consensus ratio
- Present Common findings

**Step 3:** Cross-check exclusive findings
- Validate against ground truth
- VALIDATED/INVALIDATED/UNCERTAIN
- FAIL doesn't block (continues anyway)

**Step 4:** Present summary
- Final verification summary
- DONE condition

**State:** Full persistence in `.claude/turboshovel/workflows/` and `session.json`
- Survives context clears
- Supports stashing/popping
- Tracks agent bindings

---

## 7. CONFIDENCE FRAMEWORK

### Cipherpowers

Three-level system:

| Level | Source | Meaning | Action |
|-------|--------|---------|--------|
| VERY HIGH | Both agents | Both found independently | Fix immediately |
| MODERATE | One agent | Unique insight | Cross-check validates |
| INVESTIGATE | Divergence | Agents disagree | Resolve during collation |

Cross-check outcomes:
- VALIDATED: Evidence confirms issue
- INVALIDATED: Evidence shows issue doesn't apply
- UNCERTAIN: Can't determine from evidence

### Turboshovel

Same conceptual framework, simpler presentation:
- Common (N/N): All agents found
- Exclusive: Subcategorize by ratio (N-1/N, N-2/N, 1/N)
- Cross-check: VALIDATED, INVALIDATED, UNCERTAIN

---

## 8. FILE STRUCTURE COMPARISON

### Cipherpowers
```
plugin/
├── agents/
│   ├── code-review-agent.md
│   ├── plan-review-agent.md
│   ├── execute-review-agent.md
│   ├── research-agent.md
│   ├── technical-writer.md
│   └── review-collation-agent.md
├── commands/
│   ├── verify.md
│   └── revise.md
├── skills/
│   ├── dual-verification/SKILL.md
│   ├── conducting-code-review/SKILL.md
│   ├── verifying-plans/SKILL.md
│   ├── verifying-plan-execution/SKILL.md
│   ├── research-methodology/SKILL.md
│   └── revising-findings/SKILL.md
└── templates/
    ├── verify-template.md
    ├── verify-collation-template.md
    ├── verify-plan-template.md
    └── verification-checklist-template.md
```

### Turboshovel
```
plugin/
├── (no agents directory)
├── commands/
│   └── verify.md
├── skills/
│   ├── verifying-by-consensus/SKILL.md
│   └── workflow/SKILL.md
├── templates/
│   ├── verify-review.md
│   └── verify-collation.md
└── workflows/
    └── verify.workflow.md
```

---

## 9. INTEGRATION POINTS

### Cipherpowers Integration
- Requires turboshovel plugin for hooks runtime (`plugin/hooks/gates.json` references turboshovel)
- No internal state management
- Skills dispatch agents via Task tool
- Templates referenced via `${CLAUDE_PLUGIN_ROOT}`

### Turboshovel Integration
- Self-contained hooks runtime (`plugin/core/`)
- Full state management (WorkflowStateManager)
- CLI commands drive workflow transitions
- Agent binding protocol (pending tasks → agent start → agent stop)

---

## 10. KEY DIVERGENCES

| Aspect | Cipherpowers | Turboshovel |
|--------|-------------|-------------|
| State | Stateless | Stateful (persists) |
| Agent dispatch | Skill instructs directly | Workflow + CLI commands |
| Type system | Explicit (5 types) | Implicit (via args) |
| Specialized agents | 6 defined | None |
| Supporting skills | 5 specialized | 1 generic |
| Templates | 4 detailed | 2 minimal |
| Revise capability | Yes | No |
| Workflow files | None | verify.workflow.md |
| Phase progression | Manual in skill | CLI-driven |

---

## Summary of Gaps

### Missing Components
1. `plugin/agents/` directory with 6 agent definitions
2. `/revise` command
3. 5 supporting skills
4. 2 additional templates (verify-plan, verification-checklist)

### Underdeveloped Components
1. Templates lack detail compared to cipherpowers versions
2. Verify command lacks type system and argument hints

### Different Approaches
1. Stateless vs stateful orchestration
2. Skill-centric vs workflow-centric architecture
3. Manual vs CLI-driven phase progression
