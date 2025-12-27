# Shared Package Design

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract ~1500 lines of duplicated code from plugin/core and packages/cli into a shared package.

**Architecture:** Create `@turboshovel/shared` as a new package. Both CLIs import from shared. Neither CLI depends on the other.

**Tech Stack:** TypeScript, ESM, npm workspaces

---

## Context

**Two CLIs exist with different purposes:**

| CLI | Location | Purpose | Invocation |
|-----|----------|---------|------------|
| Hook CLI | `plugin/core` | Claude Code plugin machinery | stdin JSON |
| Workflow CLI | `packages/cli` | User-facing orchestration | Command args |

**Problem:** ~1500 lines duplicated between them (workflow/*, config.ts, types.ts, utils.ts, logger.ts).

**Solution:** Extract shared code, keep CLIs separate.

---

## Package Structure

```
packages/
├── shared/                    # New package
│   ├── package.json          # @turboshovel/shared, type: module
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # Re-exports everything
│       ├── config.ts
│       ├── types.ts
│       ├── utils.ts
│       ├── logger.ts
│       └── workflow/
│           ├── index.ts
│           ├── types.ts
│           ├── state.ts
│           ├── task-id.ts
│           └── parser/
│               ├── index.ts
│               ├── markdown.ts
│               └── conditions.ts
│
├── cli/                       # Existing - becomes thin wrapper
│   └── src/
│       ├── cli.ts            # Commander setup, imports from @turboshovel/shared
│       └── commands/         # Command handlers only
│
plugin/
└── core/                      # Existing - becomes thin wrapper
    └── src/
        ├── cli.ts            # Stdin JSON handler, imports from @turboshovel/shared
        ├── dispatcher.ts     # Hook dispatch logic (stays here - hook-specific)
        ├── context.ts        # Context injection (stays here - hook-specific)
        ├── gates/            # Gate execution (stays here - hook-specific)
        └── session.ts        # Session tracking (stays here - hook-specific)
```

---

## Module System

**All packages use ESM** (`"type": "module"`).

`plugin/core` currently uses CommonJS - convert to ESM:
- Add `.js` extensions to all imports
- Update tsconfig: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
- Replace `__dirname` with `import.meta.url` pattern

**Dependency graph:**
```
@turboshovel/shared          (no dependencies on other turboshovel packages)
       ↑
       ├── @turboshovel/cli  (imports shared)
       │
       └── plugin/core       (imports shared, not published to npm)
```

**Workspace setup** (root package.json):
```json
{
  "workspaces": ["packages/*", "plugin/core"]
}
```

---

## Publish Strategy

| Package | Published | Name |
|---------|-----------|------|
| `packages/shared` | Yes | `@turboshovel/shared` |
| `packages/cli` | Yes | `@turboshovel/cli` |
| `plugin/core` | No | Internal to plugin |

**Build order:**
```bash
npm run build -w packages/shared
npm run build -w packages/cli
npm run build -w plugin/core
```

**Version sync:** All packages share same version, publish together.

---

## Migration Tasks

### Task 1: Create shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@turboshovel/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "mdast-util-from-markdown": "^2.0.0",
    "minimatch": "^10.0.1",
    "unist-util-visit": "^5.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Copy and adapt files**

Copy from `packages/cli/src/` (already ESM):
- `workflow/` directory
- `config.ts`
- `types.ts`
- `utils.ts`
- `logger.ts`

**Step 4: Create src/index.ts**

```typescript
export * from './config.js';
export * from './types.js';
export * from './utils.js';
export * from './logger.js';
export * from './workflow/index.js';
```

**Step 5: Build and verify**

Run: `cd packages/shared && npm install && npm run build`
Expected: PASS, dist/ created with .js and .d.ts files

---

### Task 2: Convert plugin/core to ESM

**Files:**
- Modify: `plugin/core/package.json`
- Modify: `plugin/core/tsconfig.json`
- Modify: All `.ts` files in `plugin/core/src/`

**Step 1: Update package.json**

Add `"type": "module"` field.

**Step 2: Update tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

**Step 3: Add .js extensions to all imports**

Find all relative imports and add `.js`:
```typescript
// Before
import { foo } from './bar';
// After
import { foo } from './bar.js';
```

**Step 4: Replace __dirname usage**

```typescript
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

**Step 5: Run tests**

Run: `cd plugin/core && npm run build && npm test`
Expected: PASS

---

### Task 3: Update plugin/core to use shared

**Files:**
- Modify: `plugin/core/package.json`
- Delete: `plugin/core/src/workflow/`
- Delete: `plugin/core/src/config.ts`
- Delete: `plugin/core/src/types.ts`
- Delete: `plugin/core/src/utils.ts`
- Delete: `plugin/core/src/logger.ts`
- Modify: All files that imported deleted modules

**Step 1: Add workspace dependency**

```json
{
  "dependencies": {
    "@turboshovel/shared": "workspace:*"
  }
}
```

**Step 2: Delete duplicated files**

```bash
rm -rf plugin/core/src/workflow
rm plugin/core/src/config.ts
rm plugin/core/src/types.ts
rm plugin/core/src/utils.ts
rm plugin/core/src/logger.ts
```

**Step 3: Update imports**

```typescript
// Before
import { loadConfig } from './config.js';
import { WorkflowState } from './workflow/types.js';

// After
import { loadConfig, WorkflowState } from '@turboshovel/shared';
```

**Step 4: Run tests**

Run: `cd plugin/core && npm install && npm run build && npm test`
Expected: PASS

---

### Task 4: Update packages/cli to use shared

**Files:**
- Modify: `packages/cli/package.json`
- Delete: `packages/cli/src/workflow/`
- Delete: `packages/cli/src/config.ts`
- Delete: `packages/cli/src/types.ts`
- Delete: `packages/cli/src/utils.ts`
- Delete: `packages/cli/src/logger.ts`
- Modify: All files that imported deleted modules

**Step 1: Add workspace dependency**

```json
{
  "dependencies": {
    "@turboshovel/shared": "workspace:*"
  }
}
```

**Step 2: Delete duplicated files**

```bash
rm -rf packages/cli/src/workflow
rm packages/cli/src/config.ts
rm packages/cli/src/types.ts
rm packages/cli/src/utils.ts
rm packages/cli/src/logger.ts
```

**Step 3: Update imports**

```typescript
// Before
import { loadConfig } from './config.js';

// After
import { loadConfig } from '@turboshovel/shared';
```

**Step 4: Run tests**

Run: `cd packages/cli && npm install && npm run build && npm test`
Expected: PASS

---

### Task 5: Update root workspace

**Files:**
- Modify: `package.json` (root)

**Step 1: Add workspaces field**

```json
{
  "workspaces": ["packages/*", "plugin/core"]
}
```

**Step 2: Install all dependencies**

Run: `npm install` (from root)
Expected: Workspace dependencies linked

---

### Task 6: Publish

**Step 1: Bump versions**

All packages to same version (e.g., 0.2.0).

**Step 2: Build all**

```bash
npm run build -w packages/shared
npm run build -w packages/cli
npm run build -w plugin/core
```

**Step 3: Publish shared first**

```bash
cd packages/shared && npm publish --access public
```

**Step 4: Publish CLI**

```bash
cd packages/cli && npm publish --access public
```

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ESM conversion breaks hooks.json invocation | Low | Test with actual Claude Code after conversion |
| Circular dependencies in shared | Low | Lint with eslint-plugin-import |
| Version mismatch CLI ↔ shared | Medium | Publish together, same version |
| Build order mistakes in CI | Medium | Document build order |

---

## Decisions Made

1. **Keep CLIs separate** - Different invocation models, different purposes
2. **ESM everywhere** - Modern, tree-shakeable, ecosystem direction
3. **Publish shared** - npm resolves dependencies cleanly
4. **No turborepo yet** - 3 packages, manual build order is fine
