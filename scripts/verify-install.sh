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
  docker build -f scripts/Dockerfile.test --target local -t turboshovel-test .
else
  # Build minimal image for npm install
  echo "Building Docker image (npm source)..."
  docker build -f scripts/Dockerfile.test --target npm -t turboshovel-test .
fi

# Run test container
echo "Running verification..."
docker run --rm \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  turboshovel-test "$SOURCE"

echo "=== Verification Complete ==="
