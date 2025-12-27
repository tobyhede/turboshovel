#!/bin/bash
set -e

SOURCE="${1:-local}"  # "local" or "npm"

echo "=== Turboshovel Test Environment ==="
echo "Source: $SOURCE"

# 1. Install packages
echo "Installing turboshovel packages..."
if [ "$SOURCE" = "local" ]; then
  # Install both together so npm can resolve shared as CLI dependency
  npm install -g ./packages/turboshovel-shared-*.tgz ./packages/turboshovel-cli-*.tgz
else
  npm install -g @turboshovel/cli
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
  exec claude --plugin-dir /test/plugin
else
  # For npm mode, install from marketplace
  claude plugin install turboshovel@turboshovel
  exec claude
fi
