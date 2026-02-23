#!/usr/bin/env bash
set -euo pipefail

HOME_ROUTER="192.168.31.1"
URL="https://api.xgvst.com/v3/health"
LOG_DIR="/Users/mac/.openclaw/workspace/xgvst/reports/lighthouse"
mkdir -p "$LOG_DIR"

stamp(){ date '+%F %T'; }
router_ip(){ /usr/sbin/ipconfig getsummary en1 2>/dev/null | awk '/Router :/{print $3; exit}'; }

echo "[$(stamp)] watcher start: wait for non-home router (home=$HOME_ROUTER)"
while true; do
  r="$(router_ip || true)"
  if [[ -n "${r}" && "${r}" != "$HOME_ROUTER" ]]; then
    ts="$(date '+%Y%m%d_%H%M%S')"
    out="$LOG_DIR/P1.4-2_C组_5G热点自动采样_${ts}.log"
    {
      echo "[$(stamp)] detected router=$r, start C-group 50 samples"
      /Users/mac/.local/bin/cloudflared tunnel info ca779b9b-368d-4615-85be-a3f43e69f5e3 | sed -n '1,80p'
      cd /Users/mac/.openclaw/workspace/xgvst
      ./scripts/sentry_jitter_trimmed_check.sh "$URL" 50
    } | tee "$out"
    echo "[$(stamp)] C-group finished, log=$out"
    exit 0
  fi
  sleep 5
done
