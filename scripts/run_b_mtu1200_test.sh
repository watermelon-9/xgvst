#!/usr/bin/env bash
set -euo pipefail

URL="https://api.xgvst.com/v3/health"
OUT_DIR="/Users/mac/.openclaw/workspace/xgvst/reports/lighthouse"
TS="$(date '+%Y%m%d_%H%M%S')"
OUT="$OUT_DIR/P1.4-2_B组_MTU1200_${TS}.log"

mkdir -p "$OUT_DIR"

echo "[B] set Wi-Fi MTU=1200" | tee "$OUT"
/usr/sbin/networksetup -setMTU "Wi-Fi" 1200 | tee -a "$OUT"

{
  echo "[B] cloudflared tunnel info"
  /Users/mac/.local/bin/cloudflared tunnel info ca779b9b-368d-4615-85be-a3f43e69f5e3 | sed -n '1,80p'
  echo "[B] jitter test 50 samples"
  cd /Users/mac/.openclaw/workspace/xgvst
  ./scripts/sentry_jitter_trimmed_check.sh "$URL" 50
} | tee -a "$OUT"

echo "[B] restore Wi-Fi MTU=automatic" | tee -a "$OUT"
/usr/sbin/networksetup -setMTU "Wi-Fi" automatic | tee -a "$OUT"

echo "[B] done, log=$OUT" | tee -a "$OUT"
