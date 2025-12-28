# Fix builtin-gates.test.ts Failures

## Problem

3 tests in `plugin/core/__tests__/builtin-gates.test.ts` are failing due to `import.meta.url` incompatibility with Jest's CommonJS mode.

## Root Cause

1. `src/gates/plugin-path.ts` uses ESM's `import.meta.url` for __dirname:
   ```typescript
   const __filename = fileURLToPath(import.meta.url);
   const __dirname = dirname(__filename);
   ```

2. Jest is configured with `module: 'commonjs'` in `jest.config.cjs`:
   ```javascript
   transform: {
     '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }]
   }
   ```

3. When `executeBuiltinGate()` dynamically imports `plugin-path.ts`, ts-jest transpiles it with CommonJS settings, causing:
   ```
   TS1343: The 'import.meta' meta-property is only allowed when the '--module' option is 'es2020', 'esnext', 'node16', or 'nodenext'.
   ```

## Files Involved

- `plugin/core/__tests__/builtin-gates.test.ts` - The failing test file
- `plugin/core/src/gate-loader.ts:90` - Where `executeBuiltinGate()` dynamically loads gates
- `plugin/core/src/gates/plugin-path.ts:7` - Uses `import.meta.url`
- `plugin/core/jest.config.cjs` - Jest configuration

## Recommended Fix

**Option A: Mock the gate loader in tests (Recommended)**

In `builtin-gates.test.ts`, mock the dynamic import to avoid actually loading the ESM file:

```typescript
jest.mock('../src/gates/plugin-path.js', () => ({
  execute: jest.fn().mockResolvedValue({
    status: 'PASS',
    message: 'Mocked plugin-path gate'
  })
}));
```

**Option B: Use process.cwd() instead of import.meta.url**

In `plugin-path.ts`, if the gate doesn't need its own file path, use an alternative:

```typescript
// Instead of import.meta.url
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
```

**Option C: Configure Jest for ESM (More complex)**

Update `jest.config.cjs` to handle ESM files differently, but this adds complexity.

## Verification

After fixing, run:
```bash
cd plugin/core && npm test -- --testPathPattern=builtin-gates
```

Expected: All 3 tests pass

## Context

This is part of the ESM migration for turboshovel. The source code is now ESM (`type: "module"` in package.json), but Jest runs tests in CommonJS mode for compatibility with ts-jest.
