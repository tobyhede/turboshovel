# Update Installation Documentation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update installation instructions to use proper Claude Code plugin marketplace mechanism and npm-published CLI.

**Architecture:** Replace manual clone+build+register approach with standard `claude plugin` commands. Separate concerns: plugin installation (Claude Code marketplace) vs CLI installation (npm).

**Tech Stack:** Markdown documentation, Claude Code plugin system, npm

---

## Task 1: Update README.md Installation Section

**Files:**
- Modify: `README.md:12-58`

**Step 1: Replace the Installation section**

Replace lines 12-58 (the entire Installation section including Prerequisites, Setup, and Optional: Workflow CLI) with:

```markdown
## Installation

### Plugin (Claude Code)

```bash
# Add turboshovel marketplace
claude plugin marketplace add tobyhede/turboshovel

# Install the plugin
claude plugin install turboshovel@turboshovel
```

### CLI (optional, for workflows)

```bash
npm install -g @turboshovel/cli
```

### Verify

Start a new Claude Code session. The plugin will be active and context injection will work automatically.
```

**Step 2: Run lint to verify markdown is valid**

Run: `cd plugin/core && npm run lint`
Expected: PASS (no markdown errors)

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update installation to use claude plugin commands"
```

---

## Task 2: Add Development Section to README.md

**Files:**
- Modify: `README.md` (append before final ## Examples section)

**Step 1: Find the Examples section location**

The Examples section is near the end of README.md. Insert the Development section before it.

**Step 2: Add Development section**

Insert before the `## Examples` section:

```markdown
## Development

For contributors working on turboshovel itself:

```bash
# Clone the repository
git clone https://github.com/tobyhede/turboshovel.git
cd turboshovel

# Build the plugin core
cd plugin/core
npm install
npm run build

# Run tests
npm test

# Link CLI for local development
cd ../../packages/cli
npm install
npm run build
npm link
```

After linking, the `tsv` and `turboshovel` commands are available globally.

```

**Step 3: Run lint to verify**

Run: `cd plugin/core && npm run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add development section for contributors"
```

---

## Task 3: Update CLAUDE.md Workflow System Section

**Files:**
- Modify: `CLAUDE.md:90-101`

**Step 1: Simplify the Workflow System Installation section**

The current section (lines 90-101) has correct CLI install but also mentions old `npm link` approach. Replace:

Current:
```markdown
## Workflow System

Execute multi-step processes with state tracking.

### Installation

Install the CLI globally:

```bash
npm install -g @turboshovel/cli
```
```

This is already correct. Keep as-is.

**Step 2: Verify no other outdated installation references**

Search CLAUDE.md for any references to `npm link`, `plugin/core`, or manual build steps.

**Step 3: Commit (if changes made)**

```bash
git add CLAUDE.md
git commit -m "docs: verify CLAUDE.md installation instructions"
```

---

## Task 4: Update README.md Workflow CLI Setup Section

**Files:**
- Modify: `README.md:540-569`

**Step 1: Replace the Workflow CLI Setup section**

The current section (lines 540-569) shows `npm link` as primary method. Replace with npm install as primary:

```markdown
### Workflow CLI Setup

The workflow CLI is available via npm:

```bash
# Install globally (recommended)
npm install -g @turboshovel/cli

# Verify installation
tsv --help
# Should show available commands

# After installing, use the simple command:
tsv start my-workflow.md
tsv status
tsv next
```

**For development (without npm install):**

```bash
# Clone and build
cd turboshovel/packages/cli
npm install
npm run build
npm link

# Or direct invocation
node packages/cli/dist/cli.js <command>
```

**Troubleshooting:** If `tsv` command not found after install:
1. Ensure npm's global bin directory is in your PATH: `npm config get prefix`
2. On macOS/Linux, add `$(npm config get prefix)/bin` to your PATH
```

**Step 2: Run lint to verify**

Run: `cd plugin/core && npm run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update workflow CLI setup to use npm install"
```

---

## Task 5: Remove Outdated References in SETUP.md

**Files:**
- Modify: `SETUP.md`

**Step 1: Search for outdated build references**

Search SETUP.md for any references to building the plugin manually.

Current SETUP.md focuses on `gates.json` configuration, not installation. Verify no outdated install steps.

**Step 2: Review and update if needed**

If any references to `npm install && npm run build` for plugin setup exist, remove or update them.

**Step 3: Commit (if changes made)**

```bash
git add SETUP.md
git commit -m "docs: remove outdated build references from SETUP.md"
```

---

## Task 6: Final Verification

**Files:**
- Verify: `README.md`, `CLAUDE.md`, `SETUP.md`, `packages/cli/README.md`

**Step 1: Grep for outdated patterns**

```bash
grep -r "git clone" README.md CLAUDE.md SETUP.md
grep -r "npm install && npm run build" README.md CLAUDE.md SETUP.md
grep -r "cd plugin/core" README.md CLAUDE.md SETUP.md
```

Only the Development section should reference clone/build.

**Step 2: Verify installation instructions are consistent**

All docs should point to:
- Plugin: `claude plugin marketplace add` + `claude plugin install`
- CLI: `npm install -g @turboshovel/cli`

**Step 3: Run full lint**

```bash
cd plugin/core && npm run lint
```

**Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "docs: finalize installation documentation updates"
```
