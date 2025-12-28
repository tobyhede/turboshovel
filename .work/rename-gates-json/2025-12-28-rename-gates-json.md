# Rename gates.json to turboshovel.json Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename configuration file from `gates.json` to `turboshovel.json` for semantic clarity and future expansion.

**Architecture:** Clean break rename (no backward compatibility). All references to `gates.json` become `turboshovel.json`. TypeScript interface `GatesConfig` becomes `TurboshovelConfig`. File discovery priority remains: `.claude/turboshovel.json` → `turboshovel.json` → `${CLAUDE_PLUGIN_ROOT}/turboshovel.json`.

**Tech Stack:** TypeScript, Node.js, Vitest

---

### Task 1: Rename TypeScript Interface

**Files:**
- Modify: `packages/shared/src/types.ts:65-68`

**Step 1: Update interface name**

Change `GatesConfig` to `TurboshovelConfig`:

```typescript
// Before
export interface GatesConfig {
  hooks: Record<string, HookConfig>;
  gates: Record<string, GateConfig>;
}

// After
export interface TurboshovelConfig {
  hooks: Record<string, HookConfig>;
  gates: Record<string, GateConfig>;
}
```

**Step 2: Update package exports**

Check `packages/shared/src/index.ts` and update export if `GatesConfig` is exported.

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "refactor(types): rename GatesConfig to TurboshovelConfig"
```

---

### Task 2: Update Config Loader

**Files:**
- Modify: `packages/shared/src/config.ts`

**Step 1: Update import**

```typescript
// Before
import { GatesConfig, HookConfig, GateConfig } from './types.js';

// After
import { TurboshovelConfig, HookConfig, GateConfig } from './types.js';
```

**Step 2: Update file paths in loadConfig function (~line 196-234)**

```typescript
// Before
const pluginConfigPath = path.join(pluginRoot, 'gates.json');
// ...
const projectPaths = [
  path.join(cwd, '.claude', 'gates.json'),
  path.join(cwd, 'gates.json')
];

// After
const pluginConfigPath = path.join(pluginRoot, 'turboshovel.json');
// ...
const projectPaths = [
  path.join(cwd, '.claude', 'turboshovel.json'),
  path.join(cwd, 'turboshovel.json')
];
```

**Step 3: Update all function signatures and return types**

Replace all `GatesConfig` with `TurboshovelConfig` throughout the file:
- `validateConfig(config: TurboshovelConfig)`
- `loadConfigFile(): Promise<TurboshovelConfig | null>`
- `mergeConfigs(): TurboshovelConfig`
- `loadConfig(): Promise<TurboshovelConfig | null>`
- Variable types: `let mergedConfig: TurboshovelConfig | null`

**Step 4: Commit**

```bash
git add packages/shared/src/config.ts
git commit -m "refactor(config): update loader for turboshovel.json"
```

---

### Task 3: Update Gate Loader

**Files:**
- Modify: `plugin/core/src/gate-loader.ts`

**Step 1: Check for GatesConfig imports and update**

Search for `GatesConfig` and replace with `TurboshovelConfig`.

**Step 2: Update any gates.json path references**

Search for `gates.json` string literals and replace with `turboshovel.json`.

**Step 3: Commit**

```bash
git add plugin/core/src/gate-loader.ts
git commit -m "refactor(gate-loader): use TurboshovelConfig type"
```

---

### Task 4: Update Dispatcher

**Files:**
- Modify: `plugin/core/src/dispatcher.ts`

**Step 1: Check for GatesConfig imports and update**

Search for `GatesConfig` and replace with `TurboshovelConfig`.

**Step 2: Commit**

```bash
git add plugin/core/src/dispatcher.ts
git commit -m "refactor(dispatcher): use TurboshovelConfig type"
```

---

### Task 5: Update Action Handler

**Files:**
- Modify: `plugin/core/src/action-handler.ts`

**Step 1: Update imports**

Replace `GatesConfig` with `TurboshovelConfig` in import statement.

**Step 2: Update type references**

Search for `GatesConfig` usage throughout the file and replace with `TurboshovelConfig`.

**Step 3: Commit**

```bash
git add plugin/core/src/action-handler.ts
git commit -m "refactor(action-handler): use TurboshovelConfig type"
```

---

### Task 6: Rename Plugin Config File

**Files:**
- Rename: `plugin/gates.json` → `plugin/turboshovel.json`

**Step 1: Rename the file**

```bash
git mv plugin/gates.json plugin/turboshovel.json
```

**Step 2: Commit**

```bash
git commit -m "refactor(plugin): rename gates.json to turboshovel.json"
```

---

### Task 7: Update Config Tests

**Files:**
- Modify: `plugin/core/__tests__/config.test.ts`

**Step 1: Update type imports**

```typescript
// Before
import { GatesConfig } from '@turboshovel/shared';

// After
import { TurboshovelConfig } from '@turboshovel/shared';
```

**Step 2: Update file path references in tests**

Search and replace:
- `'gates.json'` → `'turboshovel.json'`
- `'.claude/gates.json'` → `'.claude/turboshovel.json'`

**Step 3: Update type annotations in test code**

Replace `GatesConfig` with `TurboshovelConfig` in variable declarations.

**Step 4: Run tests to verify**

```bash
cd plugin/core && npm test -- config.test.ts
```

**Step 5: Commit**

```bash
git add plugin/core/__tests__/config.test.ts
git commit -m "test(config): update for turboshovel.json rename"
```

---

### Task 8: Update Gate Loader Tests

**Files:**
- Modify: `plugin/core/__tests__/gate-loader.test.ts`

**Step 1: Update file path references**

Search and replace `gates.json` → `turboshovel.json`.

**Step 2: Update type references if present**

Replace `GatesConfig` with `TurboshovelConfig`.

**Step 3: Run tests**

```bash
cd plugin/core && npm test -- gate-loader.test.ts
```

**Step 4: Commit**

```bash
git add plugin/core/__tests__/gate-loader.test.ts
git commit -m "test(gate-loader): update for turboshovel.json rename"
```

---

### Task 9: Update Dispatcher Tests

**Files:**
- Modify: `plugin/core/__tests__/dispatcher.test.ts`

**Step 1: Update file path references**

Search and replace `gates.json` → `turboshovel.json`.

**Step 2: Update type references if present**

Replace `GatesConfig` with `TurboshovelConfig`.

**Step 3: Run tests**

```bash
cd plugin/core && npm test -- dispatcher.test.ts
```

**Step 4: Commit**

```bash
git add plugin/core/__tests__/dispatcher.test.ts
git commit -m "test(dispatcher): update for turboshovel.json rename"
```

---

### Task 10: Update Action Handler Tests

**Files:**
- Modify: `plugin/core/__tests__/action-handler.test.ts`

**Step 1: Check for gates.json references**

Search for `gates.json` and replace with `turboshovel.json` if found.

**Step 2: Run tests**

```bash
cd plugin/core && npm test -- action-handler.test.ts
```

**Step 3: Commit (if changes made)**

```bash
git add plugin/core/__tests__/action-handler.test.ts
git commit -m "test(action-handler): update for turboshovel.json rename"
```

---

### Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update configuration section**

Replace all `gates.json` references with `turboshovel.json`:
- "Create `.claude/gates.json`" → "Create `.claude/turboshovel.json`"
- Example file references

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE): update for turboshovel.json rename"
```

---

### Task 12: Update README.md

**Files:**
- Modify: `README.md`

**Step 1: Update all gates.json references**

Search and replace `gates.json` → `turboshovel.json`.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs(README): update for turboshovel.json rename"
```

---

### Task 13: Update SETUP.md

**Files:**
- Modify: `SETUP.md`

**Step 1: Update all gates.json references**

Search and replace `gates.json` → `turboshovel.json`.

**Step 2: Commit**

```bash
git add SETUP.md
git commit -m "docs(SETUP): update for turboshovel.json rename"
```

---

### Task 14: Update ARCHITECTURE.md

**Files:**
- Modify: `ARCHITECTURE.md`

**Step 1: Update all gates.json references**

Search and replace `gates.json` → `turboshovel.json`.

**Step 2: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs(ARCHITECTURE): update for turboshovel.json rename"
```

---

### Task 15: Update CONVENTIONS.md

**Files:**
- Modify: `CONVENTIONS.md`

**Step 1: Check for and update gates.json references**

Search and replace if found.

**Step 2: Commit (if changes made)**

```bash
git add CONVENTIONS.md
git commit -m "docs(CONVENTIONS): update for turboshovel.json rename"
```

---

### Task 16: Update TYPESCRIPT.md

**Files:**
- Modify: `TYPESCRIPT.md`

**Step 1: Check for and update gates.json references**

Search and replace if found.

**Step 2: Commit (if changes made)**

```bash
git add TYPESCRIPT.md
git commit -m "docs(TYPESCRIPT): update for turboshovel.json rename"
```

---

### Task 17: Verify Build and Tests

**Step 1: Build shared package**

```bash
cd packages/shared && npm run build
```

Expected: Clean build with no errors.

**Step 2: Build core plugin**

```bash
cd plugin/core && npm run build
```

Expected: Clean build with no errors.

**Step 3: Run all tests**

```bash
cd plugin/core && npm test
```

Expected: All tests pass.

**Step 4: Run lint**

```bash
cd plugin/core && npm run lint
```

Expected: No lint errors.

---

### Task 18: Search for Remaining References

**Step 1: Global search for gates.json**

```bash
grep -r "gates\.json" --include="*.ts" --include="*.md" --include="*.json" .
```

Expected: No results (all references updated).

**Step 2: Global search for GatesConfig**

```bash
grep -r "GatesConfig" --include="*.ts" .
```

Expected: No results (all references updated).

**Step 3: Fix any remaining references found**

If any references found, update them and commit.
