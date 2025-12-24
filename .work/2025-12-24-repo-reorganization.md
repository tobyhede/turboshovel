# Repository Reorganization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Flatten turboshovel repository structure to match official Claude plugin conventions.

**Architecture:** Remove middle `hooks/` layer. Move docs to root. Rename `hooks-app` → `core`. All plugin assets directly under `plugin/`.

**Tech Stack:** Git, Bash (file operations), Node.js (verify build/test)

---

## Current vs Target Structure

```
CURRENT:                              TARGET:
turboshovel/                          turboshovel/
├── README.md (minimal)               ├── README.md (expanded)
├── CLAUDE.md                         ├── CLAUDE.md (paths updated)
├── plugin/                           ├── ARCHITECTURE.md (moved)
│   ├── .claude-plugin/               ├── SETUP.md (moved)
│   ├── commands/test.md              ├── CONVENTIONS.md (moved)
│   ├── context/                      ├── TYPESCRIPT.md (moved)
│   └── hooks/                        ├── INTEGRATION_TESTS.md (moved)
│       ├── README.md                 ├── plugin/
│       ├── ARCHITECTURE.md           │   ├── .claude-plugin/
│       ├── SETUP.md                  │   ├── hooks.json (moved up)
│       ├── CONVENTIONS.md            │   ├── gates.json (moved up)
│       ├── TYPESCRIPT.md             │   ├── commands/ (merged)
│       ├── INTEGRATION_TESTS.md      │   ├── context/
│       ├── hooks.json                │   ├── templates/ (moved up)
│       ├── gates.json                │   ├── workflows/ (moved up)
│       ├── commands/verify.md        │   ├── skills/ (moved up)
│       ├── templates/                │   ├── examples/ (moved up)
│       ├── workflows/                │   └── core/ (renamed)
│       ├── skills/                   │       ├── package.json
│       ├── examples/                 │       ├── src/
│       └── hooks-app/                │       ├── dist/
│           ├── package.json          │       └── __tests__/
│           ├── src/                  └── .github/
│           ├── dist/                     └── workflows/ci.yml (paths updated)
│           └── __tests__/
└── .github/
    └── workflows/ci.yml
```

---

### Task 1: Move Documentation to Root

**Files:**
- Move: `plugin/hooks/ARCHITECTURE.md` → `ARCHITECTURE.md`
- Move: `plugin/hooks/SETUP.md` → `SETUP.md`
- Move: `plugin/hooks/CONVENTIONS.md` → `CONVENTIONS.md`
- Move: `plugin/hooks/TYPESCRIPT.md` → `TYPESCRIPT.md`
- Move: `plugin/hooks/INTEGRATION_TESTS.md` → `INTEGRATION_TESTS.md`

**Step 1: Move documentation files to root**

```bash
cd /Users/tobyhede/psrc/turboshovel && \
git mv plugin/hooks/ARCHITECTURE.md ARCHITECTURE.md && \
git mv plugin/hooks/SETUP.md SETUP.md && \
git mv plugin/hooks/CONVENTIONS.md CONVENTIONS.md && \
git mv plugin/hooks/TYPESCRIPT.md TYPESCRIPT.md && \
git mv plugin/hooks/INTEGRATION_TESTS.md INTEGRATION_TESTS.md
```

**Step 2: Verify files moved**

Run: `ls -la /Users/tobyhede/psrc/turboshovel/*.md`
Expected: ARCHITECTURE.md, CLAUDE.md, CONVENTIONS.md, INTEGRATION_TESTS.md, README.md, SETUP.md, TYPESCRIPT.md

**Step 3: Commit documentation move**

```bash
git add -A && git commit -m "docs: move documentation to repository root"
```

---

### Task 2: Expand Root README

**Files:**
- Modify: `README.md`
- Reference: `plugin/hooks/README.md` (source content)

**Step 1: Replace root README with expanded content**

Replace `README.md` content with the full documentation from `plugin/hooks/README.md`, updating internal links:
- `./SETUP.md` → `SETUP.md`
- `./ARCHITECTURE.md` → `ARCHITECTURE.md`
- `./CONVENTIONS.md` → `CONVENTIONS.md`
- `./TYPESCRIPT.md` → `TYPESCRIPT.md`
- `./INTEGRATION_TESTS.md` → `INTEGRATION_TESTS.md`
- `plugin/hooks/examples/` → `plugin/examples/`
- `plugin/hooks/hooks-app` → `plugin/core`

**Step 2: Delete old hooks README**

```bash
rm plugin/hooks/README.md
```

**Step 3: Commit README expansion**

```bash
git add -A && git commit -m "docs: expand root README with full documentation"
```

---

### Task 3: Move Plugin Configuration Files

**Files:**
- Move: `plugin/hooks/hooks.json` → `plugin/hooks.json`
- Move: `plugin/hooks/gates.json` → `plugin/gates.json`

**Step 1: Move configuration files**

```bash
cd /Users/tobyhede/psrc/turboshovel && \
git mv plugin/hooks/hooks.json plugin/hooks.json && \
git mv plugin/hooks/gates.json plugin/gates.json
```

**Step 2: Verify files moved**

Run: `ls -la /Users/tobyhede/psrc/turboshovel/plugin/*.json`
Expected: gates.json, hooks.json

**Step 3: Commit configuration move**

```bash
git add -A && git commit -m "refactor: move hooks.json and gates.json to plugin root"
```

---

### Task 4: Move Plugin Asset Directories

**Files:**
- Move: `plugin/hooks/commands/` → merge into `plugin/commands/`
- Move: `plugin/hooks/templates/` → `plugin/templates/`
- Move: `plugin/hooks/workflows/` → `plugin/workflows/`
- Move: `plugin/hooks/skills/` → `plugin/skills/`
- Move: `plugin/hooks/examples/` → `plugin/examples/`

**Step 1: Merge commands directories**

```bash
cd /Users/tobyhede/psrc/turboshovel && \
git mv plugin/hooks/commands/verify.md plugin/commands/verify.md
```

**Step 2: Move remaining directories**

```bash
git mv plugin/hooks/templates plugin/templates && \
git mv plugin/hooks/workflows plugin/workflows && \
git mv plugin/hooks/skills plugin/skills && \
git mv plugin/hooks/examples plugin/examples
```

**Step 3: Verify directories moved**

Run: `ls -la /Users/tobyhede/psrc/turboshovel/plugin/`
Expected: .claude-plugin/, commands/, context/, core/ (not yet), examples/, gates.json, hooks.json, skills/, templates/, workflows/

**Step 4: Commit asset directories move**

```bash
git add -A && git commit -m "refactor: move plugin assets to plugin root"
```

---

### Task 5: Rename hooks-app to core

**Files:**
- Move: `plugin/hooks/hooks-app/` → `plugin/core/`

**Step 1: Rename directory**

```bash
cd /Users/tobyhede/psrc/turboshovel && \
git mv plugin/hooks/hooks-app plugin/core
```

**Step 2: Update package.json name**

In `plugin/core/package.json`, update the name field:

Replace:
```json
"name": "@turboshovel/hooks-app",
```

With:
```json
"name": "@turboshovel/core",
```

**Step 3: Remove empty hooks directory**

```bash
rmdir plugin/hooks 2>/dev/null || rm -rf plugin/hooks
```

**Step 4: Verify structure**

Run: `ls -la /Users/tobyhede/psrc/turboshovel/plugin/`
Expected: .claude-plugin/, commands/, context/, core/, examples/, gates.json, hooks.json, skills/, templates/, workflows/

**Step 5: Commit rename**

```bash
git add -A && git commit -m "refactor: rename hooks-app to core"
```

---

### Task 5B: Fix Source Code Path Computations

**Files:**
- Modify: `plugin/core/src/context.ts`
- Modify: `plugin/core/src/gates/plugin-path.ts`
- Modify: `plugin/core/src/config.ts`
- Modify: `plugin/core/src/gate-loader.ts`

**Step 1: Fix context.ts path traversal**

In `plugin/core/src/context.ts`, around lines 21-26, update the path traversal depth:

Replace:
```typescript
  // This file is at: plugin/hooks/hooks-app/src/context.ts (dev)
  // Or at: plugin/hooks/hooks-app/dist/context.js (built)
  // Plugin root is: plugin/
  try {
    // Go up from src/ or dist/ -> hooks-app/ -> hooks/ -> plugin/
    return path.resolve(__dirname, '..', '..', '..');
```

With:
```typescript
  // This file is at: plugin/core/src/context.ts (dev)
  // Or at: plugin/core/dist/context.js (built)
  // Plugin root is: plugin/
  try {
    // Go up from src/ or dist/ -> core/ -> plugin/
    return path.resolve(__dirname, '..', '..');
```

**Step 2: Fix plugin-path.ts path traversal**

In `plugin/core/src/gates/plugin-path.ts`, around lines 35-52, update:

Replace:
```typescript
/**
 * Compute plugin root from this file's location
 * This file is at: plugin/hooks/hooks-app/src/gates/plugin-path.ts
 * Plugin root is: plugin/
 *
 * We go up 4 levels: gates/ -> src/ -> hooks-app/ -> hooks/ -> plugin/
 */
function computePluginRoot(): string {
  // In CommonJS, use __dirname
  // __dirname is at: plugin/hooks/hooks-app/dist/gates/
  // (after compilation from src/ to dist/)

  // Go up 4 directories from dist/gates/
  let pluginRoot = path.dirname(__dirname); // dist/
  pluginRoot = path.dirname(pluginRoot); // hooks-app/
  pluginRoot = path.dirname(pluginRoot); // hooks/
  pluginRoot = path.dirname(pluginRoot); // plugin/
```

With:
```typescript
/**
 * Compute plugin root from this file's location
 * This file is at: plugin/core/src/gates/plugin-path.ts
 * Plugin root is: plugin/
 *
 * We go up 3 levels: gates/ -> src/ -> core/ -> plugin/
 */
function computePluginRoot(): string {
  // In CommonJS, use __dirname
  // __dirname is at: plugin/core/dist/gates/
  // (after compilation from src/ to dist/)

  // Go up 3 directories from dist/gates/
  let pluginRoot = path.dirname(__dirname); // dist/
  pluginRoot = path.dirname(pluginRoot); // core/
  pluginRoot = path.dirname(pluginRoot); // plugin/
```

**Step 3: Fix config.ts loader path**

In `plugin/core/src/config.ts`, around line 216, update:

Replace:
```typescript
    const pluginConfigPath = path.join(pluginRoot, 'hooks', 'gates.json');
```

With:
```typescript
    const pluginConfigPath = path.join(pluginRoot, 'gates.json');
```

Also update the comment around line 205:
Replace:
```typescript
 * 3. Plugin: ${CLAUDE_PLUGIN_ROOT}/hooks/gates.json (fallback/defaults)
```

With:
```typescript
 * 3. Plugin: ${CLAUDE_PLUGIN_ROOT}/gates.json (fallback/defaults)
```

**Step 4: Fix gate-loader.ts loader path**

In `plugin/core/src/gate-loader.ts`, around line 188, update:

Replace:
```typescript
  const gatesPath = path.join(pluginRoot, 'hooks', 'gates.json');
```

With:
```typescript
  const gatesPath = path.join(pluginRoot, 'gates.json');
```

**Step 5: Run build to verify no TypeScript errors**

```bash
cd plugin/core && npm run build
```

Expected: Build succeeds

**Step 6: Run tests to verify path changes work**

```bash
cd plugin/core && npm test
```

Expected: All tests pass

**Step 7: Commit source code fixes**

```bash
git add plugin/core/src && git commit -m "fix: update path computations for new structure"
```

---

### Task 6: Update hooks.json Paths

**Files:**
- Modify: `plugin/hooks.json`

**Step 1: Update all command paths**

In `plugin/hooks.json`, replace all occurrences of:
```
${CLAUDE_PLUGIN_ROOT}/hooks/hooks-app/dist/cli.js
```
with:
```
${CLAUDE_PLUGIN_ROOT}/core/dist/cli.js
```

There are 11 hook entries that need updating.

**Step 2: Verify hooks.json content**

Run: `grep -c "core/dist/cli.js" /Users/tobyhede/psrc/turboshovel/plugin/hooks.json`
Expected: 11

**Step 3: Commit hooks.json update**

```bash
git add plugin/hooks.json && git commit -m "refactor: update hooks.json paths to use core/"
```

---

### Task 6B: Update mise.toml CLI Paths

**Files:**
- Modify: `mise.toml`

**Step 1: Update all CLI path references**

In `mise.toml`, replace all occurrences of:
```
plugin/hooks/hooks-app/dist/cli.js
```

With:
```
plugin/core/dist/cli.js
```

There are 7 references to update (in tasks: logs, logs:errors, logs:all, logs:pretty, logs:path, logs:clear).

**Step 2: Verify mise.toml content**

Run: `grep -c "plugin/core/dist/cli.js" /Users/tobyhede/psrc/turboshovel/mise.toml`
Expected: 7

**Step 3: Commit mise.toml update**

```bash
git add mise.toml && git commit -m "chore: update mise.toml CLI paths for new structure"
```

---

### Task 7: Update CLAUDE.md Paths

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update development commands**

Replace:
```markdown
- Build: `cd plugin/hooks/hooks-app && npm run build`
- Test: `cd plugin/hooks/hooks-app && npm test`
- Lint: `cd plugin/hooks/hooks-app && npm run lint`
```

With:
```markdown
- Build: `cd plugin/core && npm run build`
- Test: `cd plugin/core && npm test`
- Lint: `cd plugin/core && npm run lint`
```

**Step 2: Update architecture reference**

Replace:
```markdown
See plugin/hooks/ARCHITECTURE.md for system design.
```

With:
```markdown
See ARCHITECTURE.md for system design.
```

**Step 3: Update documentation links**

Replace:
```markdown
- [README.md](plugin/hooks/README.md) - Quick start and examples
- [SETUP.md](plugin/hooks/SETUP.md) - Configuration guide
- [CONVENTIONS.md](plugin/hooks/CONVENTIONS.md) - Context file patterns
- [TYPESCRIPT.md](plugin/hooks/TYPESCRIPT.md) - Custom TypeScript gates
```

With:
```markdown
- [README.md](README.md) - Quick start and examples
- [SETUP.md](SETUP.md) - Configuration guide
- [CONVENTIONS.md](CONVENTIONS.md) - Context file patterns
- [TYPESCRIPT.md](TYPESCRIPT.md) - Custom TypeScript gates
```

**Step 4: Commit CLAUDE.md update**

```bash
git add CLAUDE.md && git commit -m "docs: update CLAUDE.md paths for new structure"
```

---

### Task 8: Update GitHub Actions

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Update working directory**

Replace:
```yaml
defaults:
  run:
    working-directory: plugin/hooks/hooks-app
```

With:
```yaml
defaults:
  run:
    working-directory: plugin/core
```

**Step 2: Update cache dependency path**

Replace:
```yaml
cache-dependency-path: plugin/hooks/hooks-app/package-lock.json
```

With:
```yaml
cache-dependency-path: plugin/core/package-lock.json
```

**Step 3: Commit CI update**

```bash
git add .github/workflows/ci.yml && git commit -m "ci: update paths for new structure"
```

---

### Task 9: Verify Build and Tests

**Files:**
- Test: `plugin/core/`

**Step 1: Install dependencies**

```bash
cd /Users/tobyhede/psrc/turboshovel/plugin/core && npm ci
```

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds, `dist/` directory populated

**Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Run lint**

Run: `npm run lint`
Expected: No linting errors

---

### Task 10: Update Internal Documentation Links

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `SETUP.md`
- Modify: `CONVENTIONS.md`
- Modify: `TYPESCRIPT.md`
- Modify: `INTEGRATION_TESTS.md`
- Modify: `plugin/context/session-start.md`
- Modify: `plugin/examples/context/session-start.md`

**Step 1: Update cross-references in ARCHITECTURE.md**

Replace all `./` relative links to sibling docs (they're now at root level).
Replace `plugin/hooks/hooks-app` references with `plugin/core`.

**Step 2: Update cross-references in SETUP.md**

Replace all `./` relative links to sibling docs.
Replace `plugin/hooks/hooks-app` references with `plugin/core`.

**Step 3: Update cross-references in remaining docs**

Apply same pattern to CONVENTIONS.md, TYPESCRIPT.md, INTEGRATION_TESTS.md.

**Step 4: Update context documentation paths**

In `plugin/context/session-start.md`, update:

Replace:
```markdown
@${CLAUDE_PLUGIN_ROOT}/hooks/examples/context/session-start.md
@${CLAUDE_PLUGIN_ROOT}/hooks/README.md
```

With:
```markdown
@${CLAUDE_PLUGIN_ROOT}/examples/context/session-start.md
@${CLAUDE_PLUGIN_ROOT}/README.md
```

Also update the link at line 41:
Replace:
```markdown
See [plugin/hooks/README.md](${CLAUDE_PLUGIN_ROOT}/hooks/README.md)
```

With:
```markdown
See [README.md](${CLAUDE_PLUGIN_ROOT}/README.md)
```

**Step 5: Update example context documentation**

In `plugin/examples/context/session-start.md`, update:

Replace:
```bash
cp ${CLAUDE_PLUGIN_ROOT}hooks/examples/context/session-start.md \
```

With:
```bash
cp ${CLAUDE_PLUGIN_ROOT}/examples/context/session-start.md \
```

**Step 6: Commit documentation link fixes**

```bash
git add *.md plugin/context/ plugin/examples/ && git commit -m "docs: fix internal documentation links"
```

---

### Task 11: Final Verification

**Step 1: Verify directory structure**

```bash
ls -la /Users/tobyhede/psrc/turboshovel/
ls -la /Users/tobyhede/psrc/turboshovel/plugin/
```

Expected root: ARCHITECTURE.md, CLAUDE.md, CONVENTIONS.md, INTEGRATION_TESTS.md, README.md, SETUP.md, TYPESCRIPT.md, plugin/, .github/
Expected plugin: .claude-plugin/, commands/, context/, core/, examples/, gates.json, hooks.json, skills/, templates/, workflows/

**Step 2: Verify no hooks/ directory remains**

```bash
ls plugin/hooks 2>&1
```

Expected: "No such file or directory"

**Step 3: Verify no broken links to old paths**

```bash
# Check for any remaining references to old paths
grep -r "plugin/hooks" --include="*.md" --include="*.json" --include="*.yml" . 2>/dev/null | grep -v ".work/" || echo "No broken links found"
grep -r "hooks-app" --include="*.md" --include="*.json" --include="*.yml" . 2>/dev/null | grep -v ".work/" || echo "No broken links found"
```

Expected: "No broken links found" for both checks (no matches outside .work/)

**Step 4: Run full test suite**

```bash
cd plugin/core && npm test
```

Expected: All tests pass

**Step 5: Verify workflow CLI works**

```bash
cd plugin/core && npx workflow --help
```

Expected: Shows workflow CLI help

---

## Summary of Commits

1. `docs: move documentation to repository root`
2. `docs: expand root README with full documentation`
3. `refactor: move hooks.json and gates.json to plugin root`
4. `refactor: move plugin assets to plugin root`
5. `refactor: rename hooks-app to core`
5B. `fix: update path computations for new structure`
6. `refactor: update hooks.json paths to use core/`
6B. `chore: update mise.toml CLI paths for new structure`
7. `docs: update CLAUDE.md paths for new structure`
8. `ci: update paths for new structure`
9. `docs: fix internal documentation links`
