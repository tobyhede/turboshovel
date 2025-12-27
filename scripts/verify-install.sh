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
  (cd packages/cli && npm pack --pack-destination "$ROOT_DIR/dist")

  # Build Docker image with local artifacts
  echo "Building Docker image..."
  docker build -f scripts/Dockerfile.test --target local -t turboshovel-test .
else
  # Build minimal image for npm install
  echo "Building Docker image (npm source)..."
  docker build -f scripts/Dockerfile.test --target npm -t turboshovel-test .
fi

# Run interactive container
echo "Starting interactive Docker container..."
docker run -it --rm turboshovel-test "$SOURCE"
