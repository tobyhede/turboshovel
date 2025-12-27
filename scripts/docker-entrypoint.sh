#!/bin/bash
set -e

COMMAND="${1:-verify}"
SOURCE="${2:-local}"

case "$COMMAND" in
  login)
    echo "=== Claude Code Login ==="
    echo "Starting interactive Claude session for authentication..."
    claude
    ;;

  verify)
    echo "=== Turboshovel Installation Verification ==="
    echo "Source: $SOURCE"

    # 1. Install CLI package
    echo "Installing @turboshovel/cli..."
    if [ "$SOURCE" = "local" ]; then
      npm install -g ./packages/turboshovel-cli-*.tgz
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
      cp -r ./plugin ~/.claude/plugins/turboshovel
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

    # 5. Run walkthrough
    echo "Running walkthrough..."
    cd /test/project
    claude --print "run /turboshovel:walkthrough"

    echo "=== Verification PASSED ==="
    ;;

  *)
    echo "Usage: entrypoint.sh {login|verify} [local|npm]"
    exit 1
    ;;
esac
