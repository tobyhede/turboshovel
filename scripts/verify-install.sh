#!/bin/bash
set -e

SOURCE="${1:-local}"  # "local" or "npm"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "=== Turboshovel Test Environment ==="
echo "Source: $SOURCE"

if [ "$SOURCE" = "local" ]; then
  # Build packages
  echo "Building packages..."
  npm run build

  # Create tarballs
  echo "Creating tarballs..."
  mkdir -p dist
  rm -f dist/*.tgz
  (cd packages/shared && npm pack --pack-destination "$ROOT_DIR/dist")
  (cd packages/cli && npm pack --pack-destination "$ROOT_DIR/dist")

  # Build Docker image
  echo "Building Docker image..."
  docker compose build test-local
else
  # Build minimal image for npm install
  echo "Building Docker image (npm source)..."
  docker compose build test-npm
fi

# Persist Claude auth in project-local directory
CLAUDE_DOCKER_DIR="$ROOT_DIR/.claude-docker"
mkdir -p "$CLAUDE_DOCKER_DIR"

# Create onboarding config if missing
# Claude Code requires this file to skip the login prompt, even with valid credentials
if [[ ! -f "$CLAUDE_DOCKER_DIR/.claude.json" ]]; then
  echo "Creating onboarding config..."
  echo '{"hasCompletedOnboarding": true}' > "$CLAUDE_DOCKER_DIR/.claude.json"
fi

# Extract credentials from macOS Keychain for Linux container
# (macOS stores in Keychain, Linux needs file - see github.com/anthropics/claude-code/issues/10039)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Extracting Claude credentials from macOS Keychain..."
  if security find-generic-password -s "Claude Code-credentials" -w > "$CLAUDE_DOCKER_DIR/.credentials.json" 2>/dev/null; then
    echo "Credentials extracted successfully"
  else
    echo "Warning: Could not extract credentials from Keychain. You may need to login inside container."
  fi
fi

# Run interactive container with docker compose
echo "Starting interactive Docker container..."
echo "Auth persisted in: $CLAUDE_DOCKER_DIR"
echo "Logs captured to: $ROOT_DIR/logs/"

if [ "$SOURCE" = "local" ]; then
  docker compose run --rm test-local
else
  docker compose run --rm test-npm
fi
