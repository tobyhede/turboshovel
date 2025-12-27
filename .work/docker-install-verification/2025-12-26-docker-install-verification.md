# Docker-Based Installation Verification

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Docker-based pre-publish verification system that tests CLI installation and plugin loading with real API calls.

**Architecture:** Three shell scripts orchestrate Docker-based testing. The outer script builds packages/tarballs and Docker image, then runs a container. The entrypoint script inside the container installs packages, configures the plugin, and runs the walkthrough test. Supports both local (pre-publish) and npm (post-publish smoke test) modes.

**Tech Stack:** Docker, Bash, Node.js 22, Claude Code CLI

---

### Task 1: Create Docker Entrypoint Script

**Files:**
- Create: `scripts/docker-entrypoint.sh`

**Step 1: Create the entrypoint script**

```bash
#!/bin/bash
set -e

SOURCE="${1:-local}"  # "local" or "npm"

echo "=== Turboshovel Installation Verification ==="
echo "Source: $SOURCE"

# 1. Verify credentials
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY not set"
  exit 1
fi

# 2. Install CLI package
echo "Installing @turboshovel/cli..."
if [ "$SOURCE" = "local" ]; then
  npm install -g ./packages/turboshovel-cli-*.tgz
else
  npm install -g @turboshovel/cli
fi

# 3. Verify CLI
echo "Verifying CLI installation..."
tsv --version

# 4. Install plugin
echo "Installing turboshovel plugin..."
if [ "$SOURCE" = "local" ]; then
  mkdir -p ~/.claude/plugins
  cp -r ./plugin ~/.claude/plugins/turboshovel
else
  claude plugin install turboshovel@turboshovel
fi

# 5. Create test project
echo "Setting up test project..."
mkdir -p /test/project/.claude
cat > /test/project/.claude/gates.json << 'EOF'
{
  "gates": {
    "echo-test": {
      "command": "echo 'gate executed successfully'",
      "on_pass": "CONTINUE"
    }
  }
}
EOF

# 6. Run walkthrough
echo "Running walkthrough..."
cd /test/project
claude --print "run /turboshovel:walkthrough"

echo "=== Verification PASSED ==="
```

**Step 2: Make script executable**

Run: `chmod +x scripts/docker-entrypoint.sh`

**Step 3: Commit**

```bash
git add scripts/docker-entrypoint.sh
git commit -m "feat: add docker entrypoint for installation verification"
```

---

### Task 2: Create Dockerfile

**Files:**
- Create: `scripts/Dockerfile.test`

**Step 1: Create the Dockerfile**

```dockerfile
FROM node:22-slim

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create test workspace
WORKDIR /test

# Copy tarballs (built by verify script)
COPY dist/*.tgz ./packages/

# Copy plugin source for local plugin install
COPY plugin/ ./plugin/

# Copy test entrypoint
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

**Step 2: Commit**

```bash
git add scripts/Dockerfile.test
git commit -m "feat: add Dockerfile for installation verification"
```

---

### Task 3: Create Orchestration Script

**Files:**
- Create: `scripts/verify-install.sh`

**Step 1: Create the orchestration script**

```bash
#!/bin/bash
set -e

SOURCE="${1:-local}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Building Turboshovel Test Image ==="
echo "Source: $SOURCE"

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY must be set"
  exit 1
fi

cd "$ROOT_DIR"

if [ "$SOURCE" = "local" ]; then
  # Build packages
  echo "Building packages..."
  (cd plugin/core && npm run build)
  (cd packages/cli && npm run build)

  # Create tarballs
  echo "Creating tarballs..."
  mkdir -p dist
  (cd packages/cli && npm pack --pack-destination "$ROOT_DIR/dist")

  # Build Docker image with local artifacts
  echo "Building Docker image..."
  docker build -f scripts/Dockerfile.test -t turboshovel-test .
else
  # Build minimal image for npm install
  echo "Building Docker image (npm source)..."
  docker build -f scripts/Dockerfile.test -t turboshovel-test --build-arg SOURCE=npm .
fi

# Run test container
echo "Running verification..."
docker run --rm \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  turboshovel-test "$SOURCE"

echo "=== Verification Complete ==="
```

**Step 2: Make script executable**

Run: `chmod +x scripts/verify-install.sh`

**Step 3: Commit**

```bash
git add scripts/verify-install.sh
git commit -m "feat: add orchestration script for installation verification"
```

---

### Task 4: Create Root package.json

**Files:**
- Create: `package.json` (root)

**Step 1: Create root package.json with verify scripts**

```json
{
  "name": "turboshovel-monorepo",
  "private": true,
  "scripts": {
    "verify:install": "./scripts/verify-install.sh",
    "verify:install:npm": "./scripts/verify-install.sh npm"
  }
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "feat: add root package.json with verify scripts"
```

---

### Task 5: Test Local Verification

**Step 1: Ensure Docker is running**

Run: `docker info > /dev/null 2>&1 && echo "Docker running" || echo "Docker not running"`
Expected: "Docker running"

**Step 2: Run verification with local packages**

Run: `ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY npm run verify:install`

Expected output:
```
=== Building Turboshovel Test Image ===
Source: local
Building packages...
Creating tarballs...
Building Docker image...
Running verification...
=== Turboshovel Installation Verification ===
Source: local
Installing @turboshovel/cli...
Verifying CLI installation...
Installing turboshovel plugin...
Setting up test project...
Running walkthrough...
=== Verification PASSED ===
=== Verification Complete ===
```

**Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: complete docker-based installation verification system"
```

---

## Summary

| File | Purpose |
|------|---------|
| `scripts/docker-entrypoint.sh` | In-container test runner |
| `scripts/Dockerfile.test` | Test environment image |
| `scripts/verify-install.sh` | Orchestration script |
| `package.json` | Root npm scripts |

## Usage

```bash
# Pre-publish verification (local packages)
export ANTHROPIC_API_KEY=sk-...
npm run verify:install

# Post-publish smoke test (npm packages)
npm run verify:install:npm
```
