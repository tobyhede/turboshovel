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
