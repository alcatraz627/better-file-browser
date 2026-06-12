#!/usr/bin/env bash
# Sets up the native messaging hosts: Ghostty terminal launcher + lm AI bridge.
# Usage: ./install.sh <extension-id>
#   Extension ID is shown on chrome://extensions after loading the unpacked extension.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_ID="${1:-}"

if [[ -z "$EXT_ID" ]]; then
  echo "Usage: $0 <chrome-extension-id>"
  echo "Find your extension ID at chrome://extensions"
  exit 1
fi

# Make the hosts executable
chmod +x "$SCRIPT_DIR/ghostty_launcher.py"
chmod +x "$SCRIPT_DIR/llm_host.py"

# Write the host manifest with the real extension ID
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/com.better_file_browser.ghostty.json" <<EOF
{
  "name": "com.better_file_browser.ghostty",
  "description": "Opens Ghostty terminal for Better File Browser extension",
  "path": "$SCRIPT_DIR/ghostty_launcher.py",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://${EXT_ID}/"]
}
EOF

cat > "$MANIFEST_DIR/com.better_file_browser.llm.json" <<EOF
{
  "name": "com.better_file_browser.llm",
  "description": "Runs the local lm CLI for Better File Browser AI features",
  "path": "$SCRIPT_DIR/llm_host.py",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://${EXT_ID}/"]
}
EOF

echo "✓ Native messaging hosts installed"
echo "  Manifest: $MANIFEST_DIR/com.better_file_browser.ghostty.json"
echo "  Manifest: $MANIFEST_DIR/com.better_file_browser.llm.json"
echo "  Hosts:    $SCRIPT_DIR/ghostty_launcher.py · $SCRIPT_DIR/llm_host.py"
echo ""
echo "Reload the extension at chrome://extensions to pick them up."
