# ESLint Flat Config Migration

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from legacy `.eslintrc.cjs` to modern ESM-native flat config with maximum strictness across the monorepo.

**Architecture:** Single root `eslint.config.js` using ESLint 9.x + typescript-eslint 8.x. Covers all packages (plugin/core, packages/shared, packages/cli) with type-checked rules and relaxed test overrides.

**Tech Stack:** ESLint 9.17+, typescript-eslint 8.19+, globals package for Node.js globals

---

## Task 1: Add ESLint Dependencies to Root

**Files:**
- Modify: `package.json`

**Step 1: Add type:module and devDependencies to root package.json**

Add `"type": "module"` and the three ESLint dependencies:

```json
{
  "name": "turboshovel-monorepo",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*",
    "plugin/core"
  ],
  "scripts": {
    "verify:claude": "./scripts/verify-install.sh",
    "verify:claude:npm": "./scripts/verify-install.sh npm",
    "build": "npm run build -w packages/shared && npm run build -w packages/cli && npm run build -w plugin/core",
    "test": "npm run test -w packages/shared && npm run test -w packages/cli && npm run test -w plugin/core",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "devDependencies": {
    "eslint": "^9.17.0",
    "globals": "^16.0.0",
    "typescript-eslint": "^8.19.1"
  }
}
```

**Step 2: Install dependencies**

Run: `npm install`
Expected: Dependencies install successfully, package-lock.json updated

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ESLint 9 dependencies to root for flat config"
```

---

## Task 2: Create Root TypeScript Config for ESLint

**Files:**
- Create: `tsconfig.eslint.json`

**Step 1: Create tsconfig.eslint.json at repo root**

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "skipLibCheck": true,
    "esModuleInterop": true,
    "noEmit": true
  },
  "include": [
    "plugin/core/src/**/*.ts",
    "plugin/core/__tests__/**/*.ts",
    "packages/shared/src/**/*.ts",
    "packages/shared/__tests__/**/*.ts",
    "packages/cli/src/**/*.ts",
    "eslint.config.js"
  ],
  "exclude": ["node_modules", "**/dist/**"]
}
```

**Step 2: Commit**

```bash
git add tsconfig.eslint.json
git commit -m "chore: add tsconfig.eslint.json for type-checked linting"
```

---

## Task 3: Create ESLint Flat Config

**Files:**
- Create: `eslint.config.js`

**Step 1: Create eslint.config.js at repo root**

```javascript
// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.js',
      '!eslint.config.js',
    ],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript strictest presets
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Global settings for all TypeScript files
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Explicit return types for public API clarity
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // Type-safe imports
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/consistent-type-exports': ['error', {
        fixMixedExportsWithInlineTypeSpecifier: true,
      }],

      // Unused vars with underscore exception
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },

  // Test files: relaxed rules for mocking flexibility
  {
    files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
```

**Step 2: Verify config loads without errors**

Run: `npx eslint --print-config plugin/core/src/index.ts | head -20`
Expected: Prints JSON config without errors

**Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "feat: add ESLint flat config with strictest TypeScript rules"
```

---

## Task 4: Remove Legacy ESLint from plugin/core

**Files:**
- Modify: `plugin/core/package.json`
- Delete: `plugin/core/.eslintrc.cjs`

**Step 1: Remove ESLint devDependencies from plugin/core/package.json**

Remove these three lines from devDependencies:
- `"@typescript-eslint/eslint-plugin": "^6.0.0",`
- `"@typescript-eslint/parser": "^6.0.0",`
- `"eslint": "^8.0.0",`

The lint scripts can stay (they'll use root ESLint now).

**Step 2: Delete legacy config file**

Run: `rm plugin/core/.eslintrc.cjs`

**Step 3: Reinstall to update lockfile**

Run: `npm install`
Expected: Lockfile updated, old deps removed

**Step 4: Commit**

```bash
git add plugin/core/package.json plugin/core/.eslintrc.cjs package-lock.json
git commit -m "refactor: remove legacy ESLint config from plugin/core"
```

---

## Task 5: Run Lint and Assess Errors

**Files:**
- None (assessment only)

**Step 1: Run lint from root**

Run: `npm run lint 2>&1 | head -100`
Expected: Lint runs, likely shows errors from strict rules

**Step 2: Count total errors**

Run: `npm run lint 2>&1 | grep -c "error" || true`
Expected: Number indicating how many errors to fix

**Step 3: Document findings**

If errors exist, create a follow-up task to fix them. Common issues with strict config:
- Missing explicit return types
- Type imports not using `type` keyword
- Unsafe `any` usage in non-test code

---

## Task 6: Fix Lint Errors (if any)

**Files:**
- Various source files as needed

**Step 1: Run auto-fix**

Run: `npm run lint:fix`
Expected: Auto-fixable issues resolved (type imports, etc.)

**Step 2: Run lint again to see remaining errors**

Run: `npm run lint 2>&1 | head -50`
Expected: Fewer errors, only manual fixes remaining

**Step 3: Fix remaining errors manually**

Address each remaining error. Common patterns:
- Add explicit return types to exported functions
- Replace `any` with proper types or use type assertions
- Add missing type annotations

**Step 4: Verify all errors fixed**

Run: `npm run lint`
Expected: No errors, clean exit

**Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve ESLint errors from strict config migration"
```

---

## Task 7: Verify Full Build Pipeline

**Files:**
- None (verification only)

**Step 1: Run build**

Run: `npm run build`
Expected: All packages build successfully

**Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass

**Step 3: Run lint one final time**

Run: `npm run lint`
Expected: Clean, no errors

**Step 4: Final commit if any cleanup needed**

```bash
git status
# If any changes:
git add -A
git commit -m "chore: final cleanup after ESLint migration"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Add ESLint deps to root | 2 min |
| 2 | Create tsconfig.eslint.json | 2 min |
| 3 | Create eslint.config.js | 3 min |
| 4 | Remove legacy config | 2 min |
| 5 | Run lint and assess | 2 min |
| 6 | Fix lint errors | 5-30 min* |
| 7 | Verify build pipeline | 3 min |

*Task 6 time varies based on number of errors found.

## Files Changed

| Action | Path |
|--------|------|
| MODIFY | `package.json` |
| CREATE | `tsconfig.eslint.json` |
| CREATE | `eslint.config.js` |
| MODIFY | `plugin/core/package.json` |
| DELETE | `plugin/core/.eslintrc.cjs` |
