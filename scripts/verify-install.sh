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

  # Build Docker image with local artifacts
  echo "Building Docker image..."
  docker build -f scripts/Dockerfile.test --target local -t turboshovel-test .
else
  # Build minimal image for npm install
  echo "Building Docker image (npm source)..."
  docker build -f scripts/Dockerfile.test --target npm -t turboshovel-test .
fi

# Persist Claude auth in project-local directory
CLAUDE_DOCKER_DIR="$ROOT_DIR/.claude-docker"
mkdir -p "$CLAUDE_DOCKER_DIR"

# Run interactive container with mounted volumes
echo "Starting interactive Docker container..."
echo "Auth persisted in: $CLAUDE_DOCKER_DIR"
docker run -it --rm \
  -v "$CLAUDE_DOCKER_DIR:/root/.claude" \
  turboshovel-test "$SOURCE"
