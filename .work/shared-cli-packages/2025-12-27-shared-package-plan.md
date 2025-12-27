# Shared Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract ~1500 lines of duplicated code from plugin/core and packages/cli into @turboshovel/shared.

**Architecture:** Create new packages/shared with workflow/*, config.ts, types.ts, utils.ts, logger.ts, schemas.ts, errors.ts. Both CLIs import from shared. Convert plugin/core from CommonJS to ESM.

**Tech Stack:** TypeScript, ESM, npm workspaces

---

## Task 1: Clean up existing node_modules before workspace setup

**Files:**
- Delete: `packages/cli/node_modules/`
- Delete: `packages/cli/package-lock.json`
- Delete: `plugin/core/node_modules/`
- Delete: `plugin/core/package-lock.json`

**Step 1: Remove nested node_modules**

```bash
rm -rf packages/cli/node_modules packages/cli/package-lock.json
rm -rf plugin/core/node_modules plugin/core/package-lock.json
```

**Step 2: Verify cleanup**

Run: `ls packages/cli/node_modules 2>/dev/null || echo "Clean"`
Expected: "Clean"

Run: `ls plugin/core/node_modules 2>/dev/null || echo "Clean"`
Expected: "Clean"

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove nested node_modules before workspace setup"
```

---

## Task 2: Set up root workspace configuration

**Files:**
- Modify: `package.json`

**Step 1: Update root package.json**

```json
{
  "name": "turboshovel-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "plugin/core"
  ],
  "scripts": {
    "verify:install": "./scripts/verify-install.sh",
    "verify:install:npm": "./scripts/verify-install.sh npm",
    "build": "npm run build -w packages/shared && npm run build -w packages/cli && npm run build -w plugin/core",
    "test": "npm run test -w packages/shared && npm run test -w packages/cli && npm run test -w plugin/core"
  }
}
```

**Step 2: Verify workspace config**

Run: `cat package.json | grep -A 5 workspaces`
Expected: Shows workspaces array

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: configure npm workspaces"
```

---

## Task 3: Create packages/shared package structure

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

**Step 1: Create directory**

```bash
mkdir -p packages/shared/src
```

**Step 2: Create package.json**

Create `packages/shared/package.json`:
```json
{
  "name": "@turboshovel/shared",
  "version": "1.0.0",
  "description": "Shared workflow and configuration library for Turboshovel",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "test": "echo 'No tests yet' && exit 0",
    "clean": "rm -rf dist"
  },
  "keywords": ["turboshovel", "workflow", "shared"],
  "author": "Toby Hede",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/tobyhede/turboshovel"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "js-yaml": "^4.1.1",
    "mdast-util-from-markdown": "^2.0.2",
    "minimatch": "^10.1.1",
    "unist-util-visit": "^5.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

Note: Test script is a placeholder. Tests remain in consuming packages for now.

**Step 3: Create tsconfig.json**

Create `packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create placeholder index.ts**

Create `packages/shared/src/index.ts`:
```typescript
// @turboshovel/shared - Shared workflow and configuration library
// Exports will be added as files are copied

export {};
```

**Step 5: Verify structure**

Run: `ls -la packages/shared/`
Expected: package.json, tsconfig.json, src/

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "chore: create packages/shared skeleton"
```

---

## Task 4: Copy workflow files to shared

**Files:**
- Copy: `packages/cli/src/workflow/` → `packages/shared/src/workflow/`

**Step 1: Copy workflow directory**

```bash
cp -r packages/cli/src/workflow packages/shared/src/
```

**Step 2: Verify files copied**

Run: `ls -la packages/shared/src/workflow/`
Expected: types.ts, state.ts, task-id.ts, condition-handler.ts, parser/

**Step 3: Create workflow/index.ts re-export**

Create `packages/shared/src/workflow/index.ts`:
```typescript
// Workflow module exports
export * from './types.js';
export * from './task-id.js';
export * from './state.js';
export * from './condition-handler.js';
export * from './parser/index.js';
```

**Step 4: Commit**

```bash
git add packages/shared/src/workflow/
git commit -m "feat(shared): add workflow module"
```

---

## Task 5: Copy utility files to shared

**Files:**
- Copy: `packages/cli/src/types.ts` → `packages/shared/src/types.ts`
- Copy: `packages/cli/src/utils.ts` → `packages/shared/src/utils.ts`
- Copy: `packages/cli/src/logger.ts` → `packages/shared/src/logger.ts`
- Copy: `packages/cli/src/config.ts` → `packages/shared/src/config.ts`
- Copy: `packages/cli/src/schemas.ts` → `packages/shared/src/schemas.ts`
- Copy: `packages/cli/src/errors.ts` → `packages/shared/src/errors.ts`

**Step 1: Copy files**

```bash
cp packages/cli/src/types.ts packages/shared/src/
cp packages/cli/src/utils.ts packages/shared/src/
cp packages/cli/src/logger.ts packages/shared/src/
cp packages/cli/src/config.ts packages/shared/src/
cp packages/cli/src/schemas.ts packages/shared/src/
cp packages/cli/src/errors.ts packages/shared/src/
```

**Step 2: Verify files copied**

Run: `ls packages/shared/src/*.ts`
Expected: config.ts, errors.ts, index.ts, logger.ts, schemas.ts, types.ts, utils.ts

**Step 3: Commit**

```bash
git add packages/shared/src/
git commit -m "feat(shared): add config, types, utils, logger, schemas, errors"
```

---

## Task 6: Update shared index.ts with all exports

**Files:**
- Modify: `packages/shared/src/index.ts`

**Step 1: Update index.ts with all exports**

Replace `packages/shared/src/index.ts`:
```typescript
// @turboshovel/shared - Shared workflow and configuration library

// Core types and schemas
export * from './types.js';
export * from './schemas.js';
export * from './errors.js';

// Configuration loading
export * from './config.js';

// Utilities
export * from './utils.js';
export * from './logger.js';

// Workflow system
export * from './workflow/index.js';
```

**Step 2: Build to verify exports**

Run: `cd packages/shared && npm install && npm run build`
Expected: PASS, dist/ created

**Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): export all modules from index"
```

---

## Task 7: Convert plugin/core to ESM - package.json

**Files:**
- Modify: `plugin/core/package.json`

**Step 1: Add type: module**

Add `"type": "module"` to plugin/core/package.json after "description" line.

**Step 2: Add @turboshovel/shared dependency**

Add to dependencies:
```json
"@turboshovel/shared": "workspace:*"
```

**Step 3: Verify package.json**

Run: `cat plugin/core/package.json | grep -E '"type"|shared'`
Expected: Shows "type": "module" and shared dependency

**Step 4: Commit**

```bash
git add plugin/core/package.json
git commit -m "chore(core): convert to ESM module type"
```

---

## Task 8: Convert plugin/core to ESM - tsconfig.json

**Files:**
- Modify: `plugin/core/tsconfig.json`

**Step 1: Read current tsconfig**

Run: `cat plugin/core/tsconfig.json`

**Step 2: Update module settings**

Update compilerOptions to include:
```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

**Step 3: Commit**

```bash
git add plugin/core/tsconfig.json
git commit -m "chore(core): update tsconfig for ESM"
```

---

## Task 9: Convert plugin/core Jest config for ESM

**Files:**
- Rename: `plugin/core/jest.config.js` → `plugin/core/jest.config.cjs`

**Step 1: Rename to .cjs**

```bash
mv plugin/core/jest.config.js plugin/core/jest.config.cjs
```

Note: Renaming to .cjs allows Jest config to use CommonJS syntax (`module.exports`) while the rest of the package uses ESM. Jest auto-detects .cjs config files.

**Step 2: Verify file renamed**

Run: `ls plugin/core/jest.config.*`
Expected: jest.config.cjs (no .js file)

Note: Jest verification deferred until Task 16 when dependencies are reinstalled.

**Step 3: Commit**

```bash
git add plugin/core/jest.config.cjs
git add -A plugin/core/jest.config.js
git commit -m "chore(core): rename jest.config.js to .cjs for ESM compatibility"
```

---

## Task 10: Add .js extensions to plugin/core imports

**Files:**
- Modify: All `.ts` files in `plugin/core/src/`
- Modify: All `.ts` files in `plugin/core/__tests__/`

**Step 1: Find files with relative imports (no .js)**

Run: `grep -rE "from '\\./[^']+'" plugin/core/src/ | grep -v ".js'" | head -20`

**Step 2: Update imports in each source file**

For each file, add `.js` extension to relative imports:
```typescript
// Before
import { foo } from './bar';
import { baz } from '../qux';

// After
import { foo } from './bar.js';
import { baz } from '../qux.js';
```

Use find/replace or manual edit for each file in `plugin/core/src/`.

**Step 3: Update imports in test files**

Also update all files in `plugin/core/__tests__/` with .js extensions.

**Step 4: Verify no extensionless relative imports remain**

Run: `grep -rE "from '(\\.\\./|\\./)([^']+[^s])'" plugin/core/src/ plugin/core/__tests__/ | grep -v ".js'" | wc -l`
Expected: 0

**Step 5: Commit**

```bash
git add plugin/core/src/ plugin/core/__tests__/
git commit -m "chore(core): add .js extensions to all imports"
```

---

## Task 11: Replace __dirname in plugin/core

**Files:**
- Modify: `plugin/core/src/config.ts`
- Modify: Any other files using `__dirname`

**Step 1: Find __dirname usage**

Run: `grep -r "__dirname" plugin/core/src/`

**Step 2: Add ESM dirname helper to files that need it**

Add at top of file (after other imports):
```typescript
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

**Step 3: Verify no bare __dirname remains**

Run: `grep -r "__dirname" plugin/core/src/ | grep -v "const __dirname"`
Expected: No output

**Step 4: Commit**

```bash
git add plugin/core/src/
git commit -m "chore(core): replace __dirname with import.meta.url"
```

---

## Task 12: Update plugin/core imports and delete duplicated files (ATOMIC)

**IMPORTANT:** This task updates imports FIRST, then deletes files, then commits as ONE atomic change to avoid broken intermediate state.

**Files to modify:**
- Modify: `plugin/core/src/index.ts` (re-exports from deleted modules)
- Modify: `plugin/core/src/cli.ts`
- Modify: `plugin/core/src/cli/workflow-cli.ts`
- Modify: `plugin/core/src/cli/condition-handler.ts`
- Modify: `plugin/core/src/context.ts`
- Modify: `plugin/core/src/dispatcher.ts`
- Modify: `plugin/core/src/session.ts`
- Modify: `plugin/core/src/gates/index.ts`
- Modify: `plugin/core/src/gates/plugin-path.ts`
- Modify: `plugin/core/src/action-handler.ts`
- Modify: `plugin/core/src/workflow/context.ts`
- Modify: `plugin/core/src/workflow/evaluation.ts`
- Modify: `plugin/core/src/workflow/hooks/*.ts`

**Files to delete:**
- Delete: `plugin/core/src/workflow/types.ts`
- Delete: `plugin/core/src/workflow/state.ts`
- Delete: `plugin/core/src/workflow/task-id.ts`
- Delete: `plugin/core/src/workflow/condition-handler.ts`
- Delete: `plugin/core/src/workflow/parser/` (entire directory)
- Delete: `plugin/core/src/workflow/index.ts`
- Delete: `plugin/core/src/config.ts`
- Delete: `plugin/core/src/types.ts`
- Delete: `plugin/core/src/utils.ts`
- Delete: `plugin/core/src/logger.ts`
- Delete: `plugin/core/src/schemas.ts`
- Delete: `plugin/core/src/errors.ts`

**Keep these hook-specific files:**
- `plugin/core/src/workflow/context.ts`
- `plugin/core/src/workflow/evaluation.ts`
- `plugin/core/src/workflow/hooks/` directory

---

**Step 1: Find all files importing modules to be deleted**

Run: `grep -rE "from '(\\.\\./)*\\./(config|types|logger|utils|schemas|errors|workflow/(types|state|task-id|parser|index))" plugin/core/src/`

---

**Step 2: Update plugin/core/src/index.ts**

This file re-exports from deleted modules. Update to re-export from shared:
```typescript
// Before (example)
export * from './types.js';
export * from './schemas.js';

// After
export * from '@turboshovel/shared';
// Keep any hook-specific exports that remain local
```

---

**Step 3: Update plugin/core/src/cli.ts**

```typescript
// Before
import type { HookInput } from './schemas.js';
import { parseHookInput } from './schemas.js';

// After
import type { HookInput } from '@turboshovel/shared';
import { parseHookInput } from '@turboshovel/shared';
```

---

**Step 4: Update plugin/core/src/cli/workflow-cli.ts**

```typescript
// Before
import { WorkflowStateManager } from '../workflow/state.js';
import { parseWorkflow, WorkflowSyntaxError } from '../workflow/parser/index.js';
import { taskIdToString, parseTaskIdFromString } from '../workflow/task-id.js';
import { ... } from '../workflow/types.js';

// After
import {
  WorkflowStateManager,
  parseWorkflow,
  WorkflowSyntaxError,
  taskIdToString,
  parseTaskIdFromString,
  // ... all workflow types
} from '@turboshovel/shared';
```

---

**Step 5: Update plugin/core/src/cli/condition-handler.ts**

```typescript
// Before
import type { Task, TaskNumber } from '../workflow/types.js';

// After
import type { Task, TaskNumber } from '@turboshovel/shared';
```

---

**Step 6: Update plugin/core/src/session.ts**

```typescript
// Before
import { SessionStateSchema } from './schemas.js';

// After
import { SessionStateSchema } from '@turboshovel/shared';
```

---

**Step 7: Update plugin/core/src/dispatcher.ts**

```typescript
// Before
import { ... } from './types.js';
import { logger } from './logger.js';

// After
import { ..., logger } from '@turboshovel/shared';
```

---

**Step 8: Update plugin/core/src/context.ts**

```typescript
// Before
import { ... } from './types.js';

// After
import { ... } from '@turboshovel/shared';
```

---

**Step 9: Update plugin/core/src/gates/index.ts and gates/plugin-path.ts**

```typescript
// Before
import { ... } from '../config.js';
import { ... } from '../types.js';

// After
import { ... } from '@turboshovel/shared';
```

---

**Step 10: Update plugin/core/src/action-handler.ts**

```typescript
// Before
import { ... } from './types.js';

// After
import { ... } from '@turboshovel/shared';
```

---

**Step 11: Update workflow/context.ts and workflow/evaluation.ts**

These hook-specific files import from workflow/types.ts:
```typescript
// Before
import { WorkflowState, TaskState } from './types.js';

// After
import { WorkflowState, TaskState } from '@turboshovel/shared';
```

---

**Step 12: Update workflow/hooks/*.ts files**

```typescript
// Before
import { WorkflowState } from '../types.js';

// After
import { WorkflowState } from '@turboshovel/shared';
```

---

**Step 13: NOW delete duplicated files**

```bash
# Delete workflow files (keep context.ts, evaluation.ts, hooks/)
rm plugin/core/src/workflow/types.ts
rm plugin/core/src/workflow/state.ts
rm plugin/core/src/workflow/task-id.ts
rm plugin/core/src/workflow/condition-handler.ts
rm -rf plugin/core/src/workflow/parser/
rm plugin/core/src/workflow/index.ts

# Delete other duplicated files
rm plugin/core/src/config.ts
rm plugin/core/src/types.ts
rm plugin/core/src/utils.ts
rm plugin/core/src/logger.ts
rm plugin/core/src/schemas.ts
rm plugin/core/src/errors.ts
```

---

**Step 14: Verify remaining workflow files**

Run: `ls plugin/core/src/workflow/`
Expected: context.ts, evaluation.ts, hooks/

---

**Step 15: Verify remaining src files**

Run: `ls plugin/core/src/`
Expected: action-handler.ts, cli.ts, cli/, context.ts, dispatcher.ts, gates/, index.ts, session.ts, workflow/

---

**Step 16: Commit (ATOMIC - imports + deletions together)**

```bash
git add -A plugin/core/src/
git commit -m "refactor(core): migrate to @turboshovel/shared

- Update all imports to use @turboshovel/shared
- Delete duplicated files (workflow/*, config, types, utils, logger, schemas, errors)
- Keep hook-specific code (workflow/context, workflow/evaluation, workflow/hooks/)"
```

---

## Task 14: Update plugin/core test imports to use @turboshovel/shared

**Files:**
- Modify: All test files in `plugin/core/__tests__/` that import workflow modules

**Step 1: Find test files importing workflow modules**

Run: `grep -r "from '../../src/workflow" plugin/core/__tests__/`

**Step 2: Update each test file**

Example transformations:

```typescript
// plugin/core/__tests__/workflow/state.test.ts
// Before
import { WorkflowStateManager } from '../../src/workflow/state';
import { createTaskNumber } from '../../src/workflow/types';
import type { TaskId } from '../../src/workflow/task-id';

// After
import { WorkflowStateManager, createTaskNumber, type TaskId } from '@turboshovel/shared';
```

```typescript
// plugin/core/__tests__/cli/workflow-cli.test.ts
// Before
import { WorkflowStateManager } from '../../src/workflow/state';
import { createTaskNumber } from '../../src/workflow/types';

// After
import { WorkflowStateManager, createTaskNumber } from '@turboshovel/shared';
```

Note: Tests for workflow/context.ts and workflow/evaluation.ts still import from local src:
```typescript
// These stay as relative imports (hook-specific code)
import { getWorkflowContext } from '../../src/workflow/context.js';
import { evaluateConditions } from '../../src/workflow/evaluation.js';
```

**Step 3: Run tests**

Run: `cd plugin/core && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add plugin/core/__tests__/
git commit -m "test(core): update test imports to use @turboshovel/shared"
```

---

## Task 15: Update packages/cli to use @turboshovel/shared

**Files:**
- Modify: `packages/cli/package.json`
- Delete: `packages/cli/src/workflow/`
- Delete: `packages/cli/src/config.ts`
- Delete: `packages/cli/src/types.ts`
- Delete: `packages/cli/src/utils.ts`
- Delete: `packages/cli/src/logger.ts`
- Delete: `packages/cli/src/schemas.ts`
- Delete: `packages/cli/src/errors.ts`
- Modify: `packages/cli/src/cli.ts`

**Step 1: Add @turboshovel/shared dependency**

Add to packages/cli/package.json dependencies:
```json
"@turboshovel/shared": "workspace:*"
```

**Step 2: Delete duplicated files**

```bash
rm -rf packages/cli/src/workflow
rm packages/cli/src/config.ts
rm packages/cli/src/types.ts
rm packages/cli/src/utils.ts
rm packages/cli/src/logger.ts
rm packages/cli/src/schemas.ts
rm packages/cli/src/errors.ts
```

**Step 3: Update cli.ts static imports**

```typescript
// Before
import { loadConfig } from './config.js';
import { WorkflowState } from './workflow/types.js';

// After
import { loadConfig, WorkflowState } from '@turboshovel/shared';
```

**Step 4: Update cli.ts dynamic import**

IMPORTANT: packages/cli/src/cli.ts has a dynamic import around line 545:
```typescript
// Before
const { loadConfig } = await import('./config.js');

// After
const { loadConfig } = await import('@turboshovel/shared');
```

**Step 5: Build to verify**

Run: `cd packages/cli && npm install && npm run build`
Expected: PASS

**Step 6: Run tests**

Run: `cd packages/cli && npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/cli/
git commit -m "refactor(cli): import from @turboshovel/shared"
```

---

## Task 16: Install all workspace dependencies

**Files:**
- None (npm operation)

**Step 1: Install from root**

Run: `npm install`
Expected: All workspace dependencies linked

**Step 2: Verify workspace links**

Run: `ls -la node_modules/@turboshovel/`
Expected: Shows cli -> ../packages/cli, shared -> ../packages/shared

**Step 3: Build all packages in order**

Run: `npm run build -w packages/shared && npm run build -w packages/cli && npm run build -w plugin/core`
Expected: All PASS

**Step 4: Run all tests**

Run: `npm run test -w packages/cli && npm run test -w plugin/core`
Expected: All PASS

**Step 5: Commit any generated files**

```bash
git add package-lock.json
git commit -m "chore: install workspace dependencies"
```

---

## Task 17: Test with Claude Code

**Files:**
- None (manual testing)

**Step 1: Rebuild plugin**

```bash
cd plugin/core && npm run build
```

**Step 2: Start Claude Code session**

Start a new Claude Code session in the turboshovel directory.

**Step 3: Trigger a hook**

Make an edit to any file to trigger PostToolUse hook.

**Step 4: Verify hook works**

Expected: Hook processes without errors, gates run if configured.

**Step 5: Test workflow CLI**

```bash
tsv status
```

Expected: Shows current workflow status or "No active workflow"

---

## Task 18: Final cleanup and documentation

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

**Step 1: Update README.md**

Add section about package structure:
```markdown
## Package Structure

- `@turboshovel/shared` - Shared workflow and configuration library
- `@turboshovel/cli` - User-facing workflow CLI
- `plugin/core` - Claude Code plugin (hook handler)
```

**Step 2: Update ARCHITECTURE.md**

Update directory structure diagram to reflect new packages/shared.

**Step 3: Commit**

```bash
git add README.md ARCHITECTURE.md
git commit -m "docs: document shared package structure"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `npm run build` from root builds all packages in correct order
- [ ] `npm run test` from root runs all tests
- [ ] `tsv --help` shows CLI commands
- [ ] Claude Code hook triggers work (test with actual edit)
- [ ] No duplicate code between packages/cli and plugin/core
- [ ] @turboshovel/shared exports all needed modules
- [ ] All Jest tests pass in plugin/core (with .cjs config)
- [ ] No extensionless relative imports in plugin/core
