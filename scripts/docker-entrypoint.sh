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

# 3. Install plugin
echo "Installing turboshovel plugin..."
if [ "$SOURCE" = "local" ]; then
  mkdir -p ~/.claude/plugins
  cp -r /test/plugin ~/.claude/plugins/turboshovel

  # Enable plugin in settings
  mkdir -p ~/.claude
  cat > ~/.claude/settings.json << 'EOF'
{
  "enabledPlugins": {
    "turboshovel@local": true
  }
}
EOF
  echo "  Plugin installed and enabled"
else
  claude plugin install turboshovel@turboshovel
fi

# 4. Create test project
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
echo "Plugin: installed to ~/.claude/plugins/turboshovel"
echo "Test project: /test/project"
echo ""
echo "Starting Claude Code..."
echo ""

cd /test/project
exec claude
