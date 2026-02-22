#!/usr/bin/env bash
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.xgvst.api.cloudflared.plist"
launchctl unload "$PLIST"
echo "[tunnel_down] unloaded $PLIST"
