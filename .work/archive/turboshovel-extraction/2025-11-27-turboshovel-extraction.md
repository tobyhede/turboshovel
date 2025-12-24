# Turboshovel Plugin Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract cipherpowers hook system into a standalone, generic Claude Code plugin called turboshovel.

**Architecture:** Copy the TypeScript hooks application with minimal modifications. Remove cipherpowers-specific gates (plan-compliance) and agent references. Rebrand environment variables and logging.

**Tech Stack:** TypeScript, Node.js, Jest, Claude Code Plugin System

---

## Task 1: Create Directory Structure

**Files:**
- Create: `/Users/tobyhede/psrc/turboshovel/.claude-plugin/`
- Create: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/gates/`
- Create: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/`
- Create: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/context/`
- Create: `/Users/tobyhede/psrc/turboshovel/plugin/context/`

**Step 1: Create all directories**

```bash
mkdir -p /Users/tobyhede/psrc/turboshovel/.claude-plugin
mkdir -p /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/gates
mkdir -p /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__
mkdir -p /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/context
mkdir -p /Users/tobyhede/psrc/turboshovel/plugin/context
```

**Step 2: Verify structure**

Run: `find /Users/tobyhede/psrc/turboshovel -type d | head -20`
Expected: All directories listed

---

## Task 2: Create Plugin Manifest

**Files:**
- Create: `/Users/tobyhede/psrc/turboshovel/.claude-plugin/marketplace.json`

**Step 1: Create marketplace.json**

```json
{
  "name": "turboshovel",
  "owner": {
    "name": "Toby Hede",
    "email": "toby@tobyhede.com"
  },
  "metadata": {
    "description": "Turboshovel plugin marketplace",
    "version": "0.1.0"
  },
  "plugins": [
    {
      "name": "turboshovel",
      "source": "./plugin",
      "description": "Generic hook framework for Claude Code with context injection and quality gates",
      "version": "0.1.0"
    }
  ]
}
```

**Step 2: Verify file exists**

Run: `cat /Users/tobyhede/psrc/turboshovel/.claude-plugin/marketplace.json`
Expected: JSON content displayed

---

## Task 3: Copy TypeScript Source Files (Core)

**Files:**
- Copy from: `/Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/`
- Copy to: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/`

**Step 1: Copy main source files (excluding gates/)**

```bash
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/cli.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/dispatcher.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/config.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/context.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/gate-loader.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/action-handler.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/session.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/logger.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/types.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/utils.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/index.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/
```

**Step 2: Verify files copied**

Run: `ls /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/`
Expected: 11 .ts files listed (including index.ts - the package entrypoint)

---

## Task 3.5: Identify Tests Referencing plan-compliance (Before Removal)

**Purpose:** Before removing the plan-compliance gate, identify all tests that reference it so the engineer knows exactly what needs updating in Task 17.

**Files:**
- Analyze: `/Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/__tests__/` (source, not destination)

**Step 1: Identify plan-compliance test references in source repository**

```bash
grep -rn "plan-compliance\|planCompliance" /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/__tests__/
```

Expected: List of files and line numbers. Document these for Task 17.

**Step 2: Check if dedicated plan-compliance test file exists**

```bash
ls /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/__tests__/gates/plan-compliance* 2>/dev/null || echo "No dedicated test file"
```

Expected: Either a file path (to be deleted in Task 17) or "No dedicated test file"

**Step 3: Record findings for Task 17**

Create a temporary note of affected tests:

| File | Line(s) | Type of Reference |
|------|---------|-------------------|
| (from grep output) | (line numbers) | import / expectation / mock / test case |

This table informs the decision tree in Task 17.

---

## Task 4: Copy Gates (Excluding plan-compliance)

**Files:**
- Copy: `plugin-path.ts` only (NOT plan-compliance.ts)
- Create: Modified `index.ts`

**Step 1: Copy plugin-path gate**

```bash
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/src/gates/plugin-path.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/gates/
```

**Step 2: Create modified gates/index.ts**

Create file `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/gates/index.ts`:

```typescript
// plugin/hooks/hooks-app/src/gates/index.ts
/**
 * Built-in gates registry
 *
 * All TypeScript gates are exported here for easy discovery and import.
 */

export * as pluginPath from './plugin-path';
```

**Step 3: Verify gates directory**

Run: `ls /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/gates/`
Expected: `index.ts plugin-path.ts`

**Step 4: Verify no lingering plan-compliance imports in source**

```bash
grep -r "plan-compliance\|planCompliance" /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/ --include="*.ts"
```

Expected: No matches (confirms no dangling imports)

---

## Task 5: Modify logger.ts for Turboshovel Branding

**Files:**
- Modify: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/logger.ts`

**Step 1: Update log directory (line 28)**

Change: `return path.join(tmpdir(), 'cipherpowers');`
To: `return path.join(tmpdir(), 'turboshovel');`

**Step 2: Update CIPHERPOWERS_LOG env var (line 45)**

Change: `return process.env.CIPHERPOWERS_LOG === '1';`
To: `return process.env.TURBOSHOVEL_LOG === '1';`

**Step 3: Update CIPHERPOWERS_LOG_LEVEL env var (line 53)**

Change: `const level = process.env.CIPHERPOWERS_LOG_LEVEL as LogLevel;`
To: `const level = process.env.TURBOSHOVEL_LOG_LEVEL as LogLevel;`

**Step 4: Update all comments referencing CIPHERPOWERS_***

- Line 25: `Uses ${TMPDIR}/turboshovel/ for isolation.`
- Line 42: `TURBOSHOVEL_LOG=1 enables logging.`
- Line 50: `TURBOSHOVEL_LOG_LEVEL=debug|info|warn|error`
- Line 125-128: Update docstring to reference `TURBOSHOVEL_LOG` and `TURBOSHOVEL_LOG_LEVEL`

**Step 5: Verify changes**

Run: `grep -n "TURBOSHOVEL\|turboshovel" /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/logger.ts`
Expected: Multiple matches showing new branding

**Step 6: Verify all environment variable references updated**

```bash
grep -r "CIPHERPOWERS" /Users/tobyhede/psrc/turboshovel/plugin/ --include="*.ts" --include="*.md" --exclude-dir=node_modules
```

Expected: No matches (all env vars rebranded to TURBOSHOVEL)

---

## Task 6: Copy Test Files

**Files:**
- Copy: All files from `__tests__/` directory

**Step 1: Copy all test files**

```bash
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/__tests__/*.ts /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/
```

**Step 2: Verify tests copied**

Run: `ls /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/`
Expected: Multiple .test.ts files

---

## Task 6.5: Clean Remaining Cipherpowers References in Source and Tests

**Files:**
- Modify: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/src/context.ts`
- Modify: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/dispatcher.test.ts`
- Modify: Any other files with cipherpowers references

**Step 1: Find all remaining cipherpowers references (lowercase AND uppercase)**

```bash
grep -rn "cipherpowers\|CIPHERPOWERS" /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/ --include="*.ts"
```

Expected: List of files and line numbers with cipherpowers/CIPHERPOWERS references (context.ts, dispatcher.test.ts, possibly others)

**Step 2: Update context.ts comment (around line 102)**

Change the namespace comment from:
```typescript
// Strip namespace prefix from agent name (cipherpowers:rust-agent → rust-agent)
```
To:
```typescript
// Strip namespace prefix from agent name (namespace:agent-name → agent-name)
```

**Step 3: Update dispatcher.test.ts agent constants (around lines 37-74)**

Replace all test agent references:
- `'cipherpowers:coder'` → `'test-namespace:test-agent'`
- Any other `cipherpowers:*` patterns → generic `test-namespace:*` equivalents

Example changes:
```typescript
// Before
agent_name: 'cipherpowers:coder'
enabled_agents: ['cipherpowers:coder']

// After
agent_name: 'test-namespace:test-agent'
enabled_agents: ['test-namespace:test-agent']
```

**Step 4: Check for any other cipherpowers references**

```bash
grep -rn "cipherpowers\|CIPHERPOWERS" /Users/tobyhede/psrc/turboshovel/plugin/ --include="*.ts" --include="*.json" --exclude-dir=node_modules
```

If any found, update them to generic equivalents or turboshovel branding as appropriate.

**Step 5: Verify all cipherpowers references removed from source (lowercase AND uppercase)**

```bash
grep -rn "cipherpowers\|CIPHERPOWERS" /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/ --include="*.ts"
```

Expected: No matches (both lowercase and uppercase variants must be absent)

---

## Task 7: Copy and Modify package.json

**Files:**
- Create: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/package.json`

**Step 1: Create package.json with updated name**

Note: The `"main": "dist/cli.js"` field is correct. Verify hooks.json references this entry point (not a bin field). If hooks.json uses a bin script path, add `"bin"` field accordingly.

```json
{
  "name": "@turboshovel/hooks-app",
  "version": "1.0.0",
  "description": "TypeScript hooks dispatcher for Turboshovel",
  "main": "dist/cli.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "test": "jest",
    "lint": "eslint src/**/*.ts __tests__/**/*.ts",
    "lint:fix": "eslint src/**/*.ts __tests__/**/*.ts --fix",
    "format": "prettier --write \"src/**/*.ts\" \"__tests__/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\" \"__tests__/**/*.ts\"",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.5.0",
    "prettier": "^3.0.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "js-yaml": "^4.1.1"
  }
}
```

**Step 2: Verify package.json**

Run: `cat /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/package.json | head -5`
Expected: `@turboshovel/hooks-app` name shown

---

## Task 8: Copy TypeScript Config Files

**Files:**
- Copy: `tsconfig.json`, `jest.config.js`, `.eslintrc.js`, `.prettierrc`

**Step 1: Copy config files**

```bash
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/tsconfig.json /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/jest.config.js /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/.eslintrc.js /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks-app/.prettierrc /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/
```

**Step 2: Verify config files**

Run: `ls -la /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/`
Expected: tsconfig.json, jest.config.js, .eslintrc.js, .prettierrc visible

---

## Task 9: Copy hooks.json (Event Routing)

**Files:**
- Copy: `/Users/tobyhede/src/cipherpowers/plugin/hooks/hooks.json`

**Step 1: Copy hooks.json as-is**

```bash
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/hooks.json /Users/tobyhede/psrc/turboshovel/plugin/hooks/
```

**Step 2: Verify hooks.json**

Run: `cat /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks.json`
Expected: JSON with PostToolUse, SubagentStop, UserPromptSubmit, SessionStart hooks

---

## Task 10: Create Cleaned gates.json

**Files:**
- Create: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/gates.json`

**Step 1: Create gates.json without cipherpowers content**

```json
{
  "gates": {
    "plugin-path": {
      "description": "Verify plugin path resolution in subagents",
      "on_pass": "CONTINUE",
      "on_fail": "CONTINUE"
    },
    "check": {
      "description": "Run project quality checks (formatting, linting, types)",
      "keywords": ["lint", "check", "format", "quality", "clippy", "typecheck"],
      "command": "echo '[PLACEHOLDER] Quality checks passed. Configure with actual project check command (e.g., npm run lint, cargo clippy)'",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "test": {
      "description": "Run project test suite",
      "keywords": ["test", "testing", "spec", "verify"],
      "command": "echo '[PLACEHOLDER] Tests passed. Configure with actual project test command (e.g., npm test, cargo test)'",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    },
    "build": {
      "description": "Run project build",
      "keywords": ["build", "compile", "package"],
      "command": "echo '[PLACEHOLDER] Build passed. Configure with actual project build command (e.g., npm run build, cargo build)'",
      "on_pass": "CONTINUE",
      "on_fail": "CONTINUE"
    }
  },
  "hooks": {
    "UserPromptSubmit": {
      "gates": ["check", "test", "build"]
    },
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["check"]
    },
    "SubagentStop": {
      "enabled_agents": [],
      "gates": ["check", "test"]
    }
  }
}
```

**Step 2: Verify gates.json**

Run: `cat /Users/tobyhede/psrc/turboshovel/plugin/hooks/gates.json | grep -c "plan-compliance"`
Expected: 0 (no plan-compliance references)

---

## Task 11: Copy and Clean Example Configs

**Files:**
- Copy and modify: `examples/strict.json`, `examples/permissive.json`, `examples/pipeline.json`

**Step 1: Copy example files**

```bash
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/examples/strict.json /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/examples/permissive.json /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/examples/pipeline.json /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/examples/convention-based.json /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/
```

**Step 2: Copy all context examples**

```bash
mkdir -p /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/context
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/examples/context/code-review-start.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/context/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/examples/context/plan-start.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/context/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/examples/context/test-driven-development-start.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/context/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/examples/context/session-start.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/context/
```

**Step 3: Rebrand context examples**

In each context example file, replace:
- `cipherpowers` → `turboshovel`
- `CIPHERPOWERS` → `TURBOSHOVEL`
- Remove any cipherpowers-specific agent references (rust-agent, plan-review-agent, etc.) or make them generic

Note: Generic code-review and planning guidance is intentionally kept as it works for any project.

**Step 4: Clean enabled_agents in JSON config files**

For each .json file in examples/, change `"enabled_agents": ["rust-agent", ...]` to `"enabled_agents": []`

**Step 5: Remove plan-compliance references**

Remove any `"plan-compliance"` gate references from the example JSON files.

**Step 6: Validate example configs**

Load each example config to verify JSON structure is valid:

```bash
cd /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples
for f in *.json; do echo "Validating $f:"; python3 -m json.tool "$f" > /dev/null && echo "✓ Valid" || echo "✗ Invalid"; done
```

Expected: All configs valid

**Step 7: Verify cleanup**

Run: `grep -r "rust-agent\|plan-compliance\|cipherpowers" /Users/tobyhede/psrc/turboshovel/plugin/hooks/examples/`
Expected: No matches (or only in generic documentation comments explaining example origin)

---

## Task 12: Copy and Rebrand Documentation

**Files:**
- Copy and modify: `README.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `SETUP.md`, `TYPESCRIPT.md`, `INTEGRATION_TESTS.md`, `SESSION.md`

**Step 1: Copy all documentation files**

```bash
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/README.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/ARCHITECTURE.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/CONVENTIONS.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/SETUP.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/TYPESCRIPT.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/INTEGRATION_TESTS.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/
cp /Users/tobyhede/src/cipherpowers/plugin/hooks/SESSION.md /Users/tobyhede/psrc/turboshovel/plugin/hooks/
```

**Step 2: Rebrand all documentation**

In each file, replace:
- `CipherPowers` → `Turboshovel`
- `cipherpowers` → `turboshovel`
- `CIPHERPOWERS_` → `TURBOSHOVEL_`

**Step 3: Remove plan-compliance references**

Remove any references to `plan-compliance` gate from documentation.

**Step 4: Verify rebranding**

Run: `grep -ri "cipherpowers" /Users/tobyhede/psrc/turboshovel/plugin/hooks/*.md`
Expected: No matches

---

## Task 13: Create Root Project Files

**Files:**
- Create: `/Users/tobyhede/psrc/turboshovel/README.md`
- Create: `/Users/tobyhede/psrc/turboshovel/CLAUDE.md`
- Create: `/Users/tobyhede/psrc/turboshovel/.gitignore`

**Step 1: Create README.md**

```markdown
# Turboshovel

Generic hook framework for Claude Code providing:
- Automatic context injection via `.claude/context/` files
- Configurable quality gates (check, test, build)
- Keyword-triggered execution
- TypeScript gate extensibility
- Session state tracking

## Quick Start

1. Install from local path: `claude plugins install /path/to/turboshovel`
2. Create `.claude/gates.json` with your commands
3. Optional: Add context files to `.claude/context/`

Note: For marketplace installation (once published), use: `claude plugins install turboshovel`

## Documentation

See `plugin/hooks/` for detailed documentation:
- [README.md](plugin/hooks/README.md) - Quick start
- [SETUP.md](plugin/hooks/SETUP.md) - Configuration guide
- [ARCHITECTURE.md](plugin/hooks/ARCHITECTURE.md) - System design
- [CONVENTIONS.md](plugin/hooks/CONVENTIONS.md) - Context file patterns
- [TYPESCRIPT.md](plugin/hooks/TYPESCRIPT.md) - Custom TypeScript gates
```

**Step 2: Create CLAUDE.md**

```markdown
# CLAUDE.md

Turboshovel is a Claude Code plugin providing a generic hook framework for quality enforcement and context injection.

## Features

- **Quality Gates**: Automatically enforce project checks (lint, test, build) at hook points (PostToolUse, SubagentStop, UserPromptSubmit)
- **Context Injection**: Convention-based `.claude/context/{name}-{stage}.md` files auto-inject into conversations
- **Keyword Triggers**: Gates automatically fire based on conversation keywords
- **Session Tracking**: Session state persists across hook invocations
- **TypeScript Gates**: Custom gates via TypeScript for complex logic

## Configuration

Create `.claude/gates.json` with your project commands:

```json
{
  "gates": {
    "check": {
      "description": "Run project quality checks",
      "keywords": ["lint", "check", "format"],
      "command": "npm run lint",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "PostToolUse": {
      "enabled_tools": ["Edit", "Write"],
      "gates": ["check"]
    }
  }
}
```

## Development Commands

- Build: `cd plugin/hooks/hooks-app && npm run build`
- Test: `cd plugin/hooks/hooks-app && npm test`
- Lint: `cd plugin/hooks/hooks-app && npm run lint`

## Architecture

See plugin/hooks/ARCHITECTURE.md for system design.

## Environment Variables

- `TURBOSHOVEL_LOG=1` - Enable debug logging to `$TMPDIR/turboshovel/`
- `TURBOSHOVEL_LOG_LEVEL=debug|info|warn|error` - Set log verbosity

## Documentation

- [README.md](plugin/hooks/README.md) - Quick start and examples
- [SETUP.md](plugin/hooks/SETUP.md) - Configuration guide
- [CONVENTIONS.md](plugin/hooks/CONVENTIONS.md) - Context file patterns
- [TYPESCRIPT.md](plugin/hooks/TYPESCRIPT.md) - Custom TypeScript gates
```

**Step 3: Verify files created**

Run: `ls /Users/tobyhede/psrc/turboshovel/`
Expected: README.md, CLAUDE.md visible

---

## Task 14: Create .gitignore (Before npm install)

**Files:**
- Create: `/Users/tobyhede/psrc/turboshovel/.gitignore`

**Step 1: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.log
coverage/
```

**Step 2: Verify .gitignore created**

Run: `cat /Users/tobyhede/psrc/turboshovel/.gitignore`
Expected: Content displayed

---

## Task 15: Create Plugin Context File

**Files:**
- Create: `/Users/tobyhede/psrc/turboshovel/plugin/context/session-start.md`

**Step 1: Create session-start.md**

```markdown
# Turboshovel Hook Framework

Quality gate enforcement and context injection is active.

## Configuration

- Project gates: `.claude/gates.json`
- Context files: `.claude/context/{name}-{stage}.md`
- Logs: `$TMPDIR/turboshovel/hooks-*.log`

Enable debug logging: `TURBOSHOVEL_LOG=1`
```

**Step 2: Verify context file**

Run: `cat /Users/tobyhede/psrc/turboshovel/plugin/context/session-start.md`
Expected: Content displayed

---

## Task 16: Install Dependencies and Build

**Files:**
- Working in: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/`

**Step 1: Install npm dependencies**

```bash
cd /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app && npm install
```

Expected: Dependencies installed successfully

**Step 2: Build TypeScript**

```bash
cd /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app && npm run build
```

Expected: Compiles without errors, `dist/` directory created

If build fails with TypeScript errors:
- Review error messages for missing type definitions
- Verify all imports use correct paths after rebranding
- Check tsconfig.json paths are correct
- Common issues: missing types, incorrect import paths, wrong module references

**Step 3: Verify build output**

Run: `ls /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/dist/`
Expected: cli.js and other compiled files

**Step 4: Verify gates compiled correctly**

```bash
ls /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/dist/gates/
```

Expected: `index.js` and `plugin-path.js` exist (no plan-compliance.js)

---

## Task 17: Run Tests

**Files:**
- Test: `/Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/`

**Step 0: Identify tests referencing plan-compliance (BEFORE running tests)**

```bash
grep -rn "plan-compliance\|planCompliance" /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/
```

Expected: Note which test files and line numbers reference plan-compliance. Common locations:
- `gate-loader.test.ts` - may test loading plan-compliance gate
- `dispatcher.test.ts` - may test plan-compliance gate execution
- `gates/` tests - may have plan-compliance specific tests

**Step 1: Run test suite**

```bash
cd /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app && npm test
```

Expected: All tests pass (some may need adjustment for removed plan-compliance gate)

**Step 2: Fix any failing tests**

Use the findings from Task 3.5 to systematically address each test. Apply this decision tree:

**DECISION TREE: Handling plan-compliance Test References**

```
For each reference identified in Task 3.5:

1. Is this an entire test file dedicated to plan-compliance?
   ├─ YES → DELETE the entire test file
   │        Action: rm __tests__/gates/plan-compliance.test.ts (if exists)
   └─ NO  → Continue to step 2

2. Is this an import statement?
   ├─ YES → REMOVE the import line
   │        Example: Remove `import * as planCompliance from '../src/gates/plan-compliance';`
   └─ NO  → Continue to step 3

3. Is this a test case that ONLY tests plan-compliance?
   ├─ YES → DELETE the entire test case (describe block or it block)
   │        Example: Remove `it('should execute plan-compliance gate', ...)`
   └─ NO  → Continue to step 4

4. Is this an expectation in a list (e.g., gates array)?
   ├─ YES → REMOVE plan-compliance from the expected list
   │        Example: Change `expect(gates).toContain('plan-compliance')`
   │                 to exclude plan-compliance
   └─ NO  → Continue to step 5

5. Is this a mock setup for plan-compliance?
   ├─ YES → REMOVE the mock and any assertions that use it
   └─ NO  → INVESTIGATE - may be documentation/comment (safe to remove)
```

**After applying fixes, run verification:**

```bash
# Verify no plan-compliance references remain in tests
grep -rn "plan-compliance\|planCompliance" /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/__tests__/
```

Expected: No matches

**Verification checklist for each fix:**
- [ ] No plan-compliance imports remain
- [ ] No plan-compliance string literals in expectations
- [ ] gates/index.ts export expectations updated (only plugin-path)
- [ ] All modified test files still run: `npm test -- --testPathPattern="<filename>"`

**Step 3: Verify all tests pass**

Run: `cd /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app && npm test`
Expected: All tests pass

**Step 4: Verify plan-compliance completely removed from compiled output**

```bash
grep -r "plan-compliance\|planCompliance" /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/dist/
```

Expected: No matches

---

## Task 18: Run Linting

**Files:**
- Lint: All TypeScript files

**Step 1: Run ESLint**

```bash
cd /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app && npm run lint
```

Expected: No linting errors

**Step 2: Fix any linting issues**

If lint errors occur, run:
```bash
npm run lint:fix
```

**Step 3: Verify lint passes**

Run: `cd /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app && npm run lint`
Expected: No errors

---

## Task 19: Initialize Git Repository

**Files:**
- Create: Git repository at `/Users/tobyhede/psrc/turboshovel/`

**Step 1: Initialize git**

```bash
cd /Users/tobyhede/psrc/turboshovel && git init
```

**Step 2: Add all files**

```bash
cd /Users/tobyhede/psrc/turboshovel && git add .
```

**Step 3: Create initial commit**

```bash
cd /Users/tobyhede/psrc/turboshovel && git commit -m "feat: initial turboshovel plugin extraction from cipherpowers"
```

**Step 4: Verify commit**

Run: `cd /Users/tobyhede/psrc/turboshovel && git log --oneline -1`
Expected: Commit hash and message displayed

---

## Task 20: Verify Plugin Works

**Files:**
- Test with: CLI invocation

**Step 1: Test CLI with gate execution**

Create a test gates.json that actually runs a command:

```bash
cat > /tmp/test-gates.json << 'EOF'
{
  "gates": {
    "test-gate": {
      "description": "Test gate",
      "command": "echo 'test gate executed'",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "SessionStart": {
      "gates": ["test-gate"]
    }
  }
}
EOF
```

Test gate execution:

```bash
cd /Users/tobyhede/psrc/turboshovel && echo '{"hook_type":"SessionStart","session_id":"test"}' | GATES_CONFIG=/tmp/test-gates.json node plugin/hooks/hooks-app/dist/cli.js
```

Expected: JSON response showing gate executed, `decision: "CONTINUE"`

**Step 2: Test failing gate (verify BLOCK behavior)**

```bash
cat > /tmp/test-gates-fail.json << 'EOF'
{
  "gates": {
    "fail-gate": {
      "description": "Failing gate",
      "command": "exit 1",
      "on_pass": "CONTINUE",
      "on_fail": "BLOCK"
    }
  },
  "hooks": {
    "SessionStart": {
      "gates": ["fail-gate"]
    }
  }
}
EOF

echo '{"hook_type":"SessionStart","session_id":"test"}' | GATES_CONFIG=/tmp/test-gates-fail.json node /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/dist/cli.js
```

Expected: JSON response with `decision: "BLOCK"`

**Step 3: Verify logging directory**

```bash
TURBOSHOVEL_LOG=1 echo '{"hook_type":"SessionStart","session_id":"test"}' | node /Users/tobyhede/psrc/turboshovel/plugin/hooks/hooks-app/dist/cli.js && ls $TMPDIR/turboshovel/
```

Expected: Log file created in `$TMPDIR/turboshovel/`

**Step 4: Verify log file content**

```bash
cat $(ls -t $TMPDIR/turboshovel/hooks-*.log | head -1)
```

Expected: Log entries showing hook execution details

**Step 5: Verify no cipherpowers references in shipped code**

```bash
grep -r "cipherpowers\|CIPHERPOWERS" /Users/tobyhede/psrc/turboshovel/ --include="*.ts" --include="*.json" --include="*.md" | grep -v ".work" | grep -v "node_modules"
```

Expected: No matches (all rebranded to turboshovel)

**⚠️ IMPORTANT: .work/ Directory Exemption**

The `.work/` directory exclusion in the grep command above is **intentional and correct**. Files in `.work/` are:

- **This implementation plan** - legitimately references "cipherpowers" as the source project being extracted from (see line 3 of this file)
- **Work-in-progress documentation** - not shipped with the plugin
- **Review reports and notes** - development artifacts only

**What MUST be rebranded:** All files under `plugin/`, `README.md`, `CLAUDE.md` (the shipped content)

**What is EXEMPT:** `.work/` directory (development/documentation artifacts not shipped with plugin)

If the grep command returns matches from `.work/`, this is expected and acceptable. Only matches from shipped code paths indicate incomplete rebranding.

---

## Task 21: Verify Plugin Installation in Claude Code

**Files:**
- Test: Plugin installation and hook execution in actual Claude Code environment

**Step 1: Install plugin locally**

```bash
claude plugins install /Users/tobyhede/psrc/turboshovel
```

Expected: Plugin installs successfully

**Step 2: Verify plugin loaded**

```bash
claude plugins list | grep turboshovel
```

Expected: turboshovel plugin listed

**Step 3: Test in Claude Code session**

Start a new Claude Code session in a test project and verify:
- [ ] SessionStart hook fires (check for session-start.md context injection)
- [ ] PostToolUse hook fires after Edit/Write operations
- [ ] Gates execute when configured in `.claude/gates.json`
- [ ] Context files from `.claude/context/` inject properly
- [ ] Logs appear in `$TMPDIR/turboshovel/` when `TURBOSHOVEL_LOG=1`

**Step 4: Verify hooks.json references work**

Check that hooks.json correctly references the CLI entry point and hooks fire as expected.

---

## Summary

**Total Tasks:** 21
**Estimated Time:** 50-65 minutes

**Key Changes from cipherpowers:**
1. Removed `plan-compliance.ts` gate (cipherpowers-specific)
2. Rebranded env vars: `TURBOSHOVEL_LOG`, `TURBOSHOVEL_LOG_LEVEL`
3. Rebranded log directory: `$TMPDIR/turboshovel/`
4. Renamed package: `@turboshovel/hooks-app`
5. Cleared `enabled_agents` arrays (no cipherpowers agents)
6. Removed all cipherpowers references from documentation

**Verification Checklist:**
- [ ] Build succeeds (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] No cipherpowers references remain
- [ ] CLI responds to hook input
- [ ] Logs write to correct directory
