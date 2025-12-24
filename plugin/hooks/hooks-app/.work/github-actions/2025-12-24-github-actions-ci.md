# GitHub Actions CI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create GitHub Actions workflow for automated testing with coverage reporting

**Architecture:** Single CI workflow triggered on push/PR to main, running build/lint/test across Node.js 18/20/22 matrix with Codecov integration

**Tech Stack:** GitHub Actions, Jest coverage, Codecov

---

## Task 1: Create GitHub Workflows Directory

**Files:**
- Create: `.github/workflows/` (directory)

**Step 1: Create directory structure**

Run: `mkdir -p .github/workflows`

**Step 2: Verify directory exists**

Run: `ls -la .github/`
Expected: Shows `workflows` directory

**Step 3: Commit**

```bash
git add .github
git commit -m "chore: create github workflows directory"
```

---

## Task 2: Create CI Workflow File

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create workflow file**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20, 22]

    defaults:
      run:
        working-directory: plugin/hooks/hooks-app

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          cache-dependency-path: plugin/hooks/hooks-app/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Test with coverage
        run: npm test -- --coverage

      - name: Upload coverage to Codecov
        if: matrix.node-version == 20
        uses: codecov/codecov-action@v4
        with:
          directory: plugin/hooks/hooks-app/coverage
          flags: unittests
          fail_ci_if_error: false
        env:
          CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

**Step 2: Validate YAML syntax**

Run: `cat .github/workflows/ci.yml | head -20`
Expected: Shows valid YAML without errors

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add github actions workflow for testing"
```

---

## Task 3: Test Coverage Generation Locally

**Step 1: Run tests with coverage**

Run: `cd plugin/hooks/hooks-app && npm test -- --coverage`
Expected: Tests pass with coverage report generated

**Step 2: Verify coverage directory created**

Run: `ls plugin/hooks/hooks-app/coverage/`
Expected: Shows `lcov-report/`, `lcov.info`, etc.

**Step 3: Add coverage to gitignore if not present**

Check: `grep coverage plugin/hooks/hooks-app/.gitignore`

If not present, add:
```
coverage/
```

**Step 4: Commit gitignore update (if changed)**

```bash
git add plugin/hooks/hooks-app/.gitignore
git commit -m "chore: add coverage directory to gitignore"
```

---

## Task 4: Push and Verify Workflow

**Step 1: Push branch to trigger workflow**

Run: `git push -u origin HEAD`

**Step 2: Check workflow status**

Run: `gh run list --limit 1`
Expected: Shows CI workflow running or completed

**Step 3: View workflow details (if needed)**

Run: `gh run view --web`
Expected: Opens browser to workflow run

---

## Verification Checklist

| Check | Command |
|-------|---------|
| Workflow file exists | `ls .github/workflows/ci.yml` |
| YAML syntax valid | `cat .github/workflows/ci.yml` |
| Local coverage works | `npm test -- --coverage` |
| Workflow triggered | `gh run list --limit 1` |

---

## Setup Notes (Post-Implementation)

**Codecov setup (for private repos):**
1. Sign up at codecov.io with GitHub
2. Add `CODECOV_TOKEN` to repo secrets (Settings → Secrets → Actions)

**For public repos:** Token is optional, Codecov auto-detects

---

## Critical Files

- `.github/workflows/ci.yml` - Main CI workflow
- `plugin/hooks/hooks-app/.gitignore` - May need coverage exclusion
