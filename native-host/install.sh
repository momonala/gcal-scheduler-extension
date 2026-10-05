#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <extension-id>   (copy the ID from chrome://extensions)" >&2
  exit 1
fi

HOST_NAME="com.gcal_scheduler.claude"
HOST_PATH="$(cd "$(dirname "$0")" && pwd)/gcal_scheduler_host.py"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

chmod +x "$HOST_PATH"
mkdir -p "$MANIFEST_DIR"
cat > "$MANIFEST_DIR/$HOST_NAME.json" <<JSON
{
  "name": "$HOST_NAME",
  "description": "gcal-scheduler Claude Code bridge",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$1/"]
}
JSON

echo "Installed $MANIFEST_DIR/$HOST_NAME.json"
