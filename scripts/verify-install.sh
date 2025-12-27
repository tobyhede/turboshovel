#!/bin/bash
set -e

COMMAND="${1:-verify}"  # "login", "verify", or "verify-npm"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CLAUDE_AUTH_DIR="${CLAUDE_AUTH_DIR:-$HOME/.claude-docker}"

cd "$ROOT_DIR"

# Ensure auth directory exists
mkdir -p "$CLAUDE_AUTH_DIR"

build_image() {
  local target="$1"

  if [ "$target" = "local" ]; then
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
    docker build -f scripts/Dockerfile.test --target local -t turboshovel-test .
  else
    # Build minimal image for npm install
    echo "Building Docker image (npm source)..."
    docker build -f scripts/Dockerfile.test --target npm -t turboshovel-test .
  fi
}

case "$COMMAND" in
  login)
    echo "=== Claude Code Login ==="
    echo "Auth will be stored in: $CLAUDE_AUTH_DIR"
    build_image "local"
    docker run -it --rm \
      -v "$CLAUDE_AUTH_DIR:/root/.claude" \
      turboshovel-test login
    echo "=== Login Complete ==="
    ;;

  verify)
    echo "=== Turboshovel Installation Verification (local) ==="
    if [ ! -d "$CLAUDE_AUTH_DIR" ] || [ -z "$(ls -A "$CLAUDE_AUTH_DIR" 2>/dev/null)" ]; then
      echo "ERROR: No Claude auth found. Run 'npm run verify:login' first."
      exit 1
    fi
    build_image "local"
    docker run --rm \
      -v "$CLAUDE_AUTH_DIR:/root/.claude" \
      turboshovel-test verify local
    echo "=== Verification Complete ==="
    ;;

  verify-npm)
    echo "=== Turboshovel Installation Verification (npm) ==="
    if [ ! -d "$CLAUDE_AUTH_DIR" ] || [ -z "$(ls -A "$CLAUDE_AUTH_DIR" 2>/dev/null)" ]; then
      echo "ERROR: No Claude auth found. Run 'npm run verify:login' first."
      exit 1
    fi
    build_image "npm"
    docker run --rm \
      -v "$CLAUDE_AUTH_DIR:/root/.claude" \
      turboshovel-test verify npm
    echo "=== Verification Complete ==="
    ;;

  *)
    echo "Usage: $0 {login|verify|verify-npm}"
    echo ""
    echo "Commands:"
    echo "  login       - Interactive Claude login (run once)"
    echo "  verify      - Verify local package installation"
    echo "  verify-npm  - Verify npm package installation"
    exit 1
    ;;
esac
