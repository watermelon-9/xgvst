#!/usr/bin/env bash
set -euo pipefail

CONFIG="/Users/mac/.cloudflared/config-xgvst-api.yml"
LOG="/Users/mac/Library/Logs/cloudflared-xgvst-api-supervisor.log"

mkdir -p "$(dirname "$LOG")"

echo "[$(date '+%F %T')] supervisor start" >> "$LOG"

while true; do
  echo "[$(date '+%F %T')] starting cloudflared" >> "$LOG"
  /Users/mac/.local/bin/cloudflared --no-autoupdate --protocol http2 --config "$CONFIG" tunnel run >> "$LOG" 2>&1 || true
  echo "[$(date '+%F %T')] cloudflared exited, restart in 2s" >> "$LOG"
  sleep 2
done
