# Rename n-verification to verifying-by-consensus Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename the `n-verification` skill to `verifying-by-consensus` following gerund-form naming conventions for better discoverability.

**Architecture:** Rename skill directory, update all internal references (name, heading, announcement), update command definition to point to new location, update documentation.

**Tech Stack:** Git (for atomic rename), Markdown files

---

## Task 1: Rename Skill Directory

**Files:**
- Rename: `plugin/skills/n-verification/` → `plugin/skills/verifying-by-consensus/`

**Step 1: Rename directory with git**

```bash
git mv plugin/skills/n-verification plugin/skills/verifying-by-consensus
```

**Step 2: Verify rename succeeded**

Run: `ls plugin/skills/`
Expected: `verifying-by-consensus/` directory exists, `n-verification/` does not

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(skills): rename n-verification directory to verifying-by-consensus"
```

---

## Task 2: Update Skill Definition Content

**Files:**
- Modify: `plugin/skills/verifying-by-consensus/SKILL.md`

**Step 1: Update YAML frontmatter name**

Change line 2:
```yaml
name: n-verification
```
To:
```yaml
name: verifying-by-consensus
```

**Step 2: Update heading**

Change line 6:
```markdown
# N-Verification Skill
```
To:
```markdown
# Verifying by Consensus
```

**Step 3: Update announcement text**

Change line 34:
```markdown
**Announce:** "I'm using the n-verification skill to verify [subject]."
```
To:
```markdown
**Announce:** "I'm using the verifying-by-consensus skill to verify [subject]."
```

**Step 4: Verify changes**

Run: `head -40 plugin/skills/verifying-by-consensus/SKILL.md`
Expected: See updated name, heading, and announcement

**Step 5: Commit**

```bash
git add plugin/skills/verifying-by-consensus/SKILL.md
git commit -m "refactor(skills): update skill name and heading to verifying-by-consensus"
```

---

## Task 3: Update Command Definition

**Files:**
- Modify: `plugin/commands/verify.md`

**Step 1: Update description**

Change line 2:
```yaml
description: N-Verification with independent agents and consensus-based collation
```
To:
```yaml
description: Verify with independent agents and consensus-based collation
```

**Step 2: Update skill reference text**

Change line 14:
```markdown
Use and follow the n-verification skill exactly as written.
```
To:
```markdown
Use and follow the verifying-by-consensus skill exactly as written.
```

**Step 3: Update skill path**

Change line 16:
```markdown
Path: `${CLAUDE_PLUGIN_ROOT}skills/n-verification/SKILL.md`
```
To:
```markdown
Path: `${CLAUDE_PLUGIN_ROOT}skills/verifying-by-consensus/SKILL.md`
```

**Step 4: Update tool invocation**

Change line 17:
```markdown
Tool: `Skill(skill: "turboshovel:n-verification")`
```
To:
```markdown
Tool: `Skill(skill: "turboshovel:verifying-by-consensus")`
```

**Step 5: Verify changes**

Run: `cat plugin/commands/verify.md`
Expected: All references updated to verifying-by-consensus

**Step 6: Commit**

```bash
git add plugin/commands/verify.md
git commit -m "refactor(commands): update verify command to use verifying-by-consensus skill"
```

---

## Task 4: Update Project Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update command description**

Change line 126:
```markdown
- `/turboshovel:verify` - N-Verification with consensus-based collation
```
To:
```markdown
- `/turboshovel:verify` - Verify with consensus-based collation
```

**Step 2: Verify changes**

Run: `grep -n "verify" CLAUDE.md`
Expected: Line 126 shows updated description

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update verify command description in CLAUDE.md"
```

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | `plugin/skills/` directory | Rename directory |
| 2 | `plugin/skills/verifying-by-consensus/SKILL.md` | Update internal name, heading, announcement |
| 3 | `plugin/commands/verify.md` | Update all skill references |
| 4 | `CLAUDE.md` | Update documentation |

**Total commits:** 4 atomic commits
**Files modified:** 3 (after directory rename)
**Historical files in `.work/` unchanged** - preserve implementation history
