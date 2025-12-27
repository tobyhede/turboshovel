#!/bin/bash
set -e

SOURCE="${1:-local}"  # "local" or "npm"

echo "=== Turboshovel Test Environment ==="
echo "Source: $SOURCE"

# 1. Install packages (local mode: already installed during Docker build)
if [ "$SOURCE" = "npm" ]; then
  echo "Installing turboshovel packages from npm..."
  # For npm mode, use sudo for global install
  sudo npm install -g @turboshovel/cli
else
  echo "Using pre-installed local packages..."
fi

# 2. Verify CLI
echo "Verifying CLI installation..."
tsv --version

# 3. Create test project
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

echo ""
echo "=== Setup Complete ==="
echo "CLI: tsv --version works"
echo "Plugin: /test/plugin (loaded via --plugin-dir)"
echo "Test project: /test/project"
echo ""
echo "Starting Claude Code..."
echo ""

cd /test/project
if [ "$SOURCE" = "local" ]; then
  exec claude --plugin-dir /test/plugin --dangerously-skip-permissions
else
  # For npm mode, install from marketplace
  claude plugin install turboshovel@turboshovel
  exec claude --dangerously-skip-permissions
fi
