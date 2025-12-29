# Development Guide

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
# Clone and install
git clone <repo-url>
cd turboshovel
npm install
```

## Commands

All commands run from the repository root:

```bash
# Build all packages
npm run build

# Run all tests
npm run test

# Lint all packages
npm run lint

# Auto-fix lint issues
npm run lint:fix
```

### Package-specific commands

```bash
# Build specific package
npm run build -w packages/shared
npm run build -w packages/cli
npm run build -w plugin/core

# Test specific package
npm run test -w packages/shared
npm run test -w plugin/core

# Lint specific package
npm run lint -w plugin/core
```

## Project Structure

```
turboshovel/
├── packages/
│   ├── shared/          # Shared types, schemas, utilities
│   │   ├── src/
│   │   └── __tests__/
│   └── cli/             # CLI tool (@turboshovel/cli)
│       └── src/
├── plugin/
│   └── core/            # Claude Code plugin (@turboshovel/core)
│       ├── src/
│       └── __tests__/
├── eslint.config.js     # ESLint 9 flat config
├── tsconfig.eslint.json # TypeScript config for linting
└── package.json         # Workspace root
```

## Development Workflow

1. **Make changes** in `src/` directories
2. **Build** to check for TypeScript errors: `npm run build`
3. **Test** to verify behavior: `npm run test`
4. **Lint** to check code quality: `npm run lint`

## Testing

Tests use Jest with ESM support:

```bash
# Run all tests
npm run test

# Run tests in watch mode (per-package)
cd packages/shared && npm test -- --watch

# Run specific test file
cd plugin/core && npm test -- __tests__/session.test.ts
```

## Code Style

- ESLint 9 with typescript-eslint (strictest rules)
- Explicit return types on exported functions
- Type imports use `import type` syntax
- Test files have relaxed rules for mocking flexibility

## Build Order

Packages must be built in dependency order:

1. `packages/shared` (no dependencies)
2. `packages/cli` (depends on shared)
3. `plugin/core` (depends on shared)

The root `npm run build` handles this automatically.
