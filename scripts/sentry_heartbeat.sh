#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://api.xgvst.com/v3/health}"
LOG="/Users/mac/.openclaw/workspace/xgvst/reports/lighthouse/p1.3-heartbeat.log"

mkdir -p "$(dirname "$LOG")"

while true; do
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  out=$(curl --http1.1 -sS -o /tmp/xgvst-health.$$ -w "%{http_code} %{time_starttransfer} %{time_total}" "$URL" || echo "000 0 0")
  code=$(echo "$out" | awk '{print $1}')
  ttfb=$(echo "$out" | awk '{print $2}')
  total=$(echo "$out" | awk '{print $3}')
  echo "$ts code=$code ttfb=${ttfb}s total=${total}s" | tee -a "$LOG"
  sleep 60
done
