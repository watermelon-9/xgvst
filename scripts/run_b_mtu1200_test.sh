#!/usr/bin/env bash
set -euo pipefail

URL="https://api.xgvst.com/v3/health"
OUT_DIR="/Users/mac/.openclaw/workspace/xgvst/reports/lighthouse"
TS="$(date '+%Y%m%d_%H%M%S')"
# macOS Wi-Fi valid MTU range is usually 1280-1500; use 1280 as closest low-MTU probe.
TARGET_MTU="${1:-1280}"
OUT="$OUT_DIR/P1.4-2_B组_MTU${TARGET_MTU}_${TS}.log"

mkdir -p "$OUT_DIR"

auto_restore() {
  echo "[B] restore Wi-Fi MTU=automatic" | tee -a "$OUT"
  /usr/sbin/networksetup -setMTUAndMediaAutomatically "Wi-Fi" | tee -a "$OUT" || true
}
trap auto_restore EXIT

echo "[B] set Wi-Fi MTU=${TARGET_MTU}" | tee "$OUT"
/usr/sbin/networksetup -setMTU "Wi-Fi" "$TARGET_MTU" | tee -a "$OUT"

{
  echo "[B] cloudflared tunnel info"
  /Users/mac/.local/bin/cloudflared tunnel info ca779b9b-368d-4615-85be-a3f43e69f5e3 | sed -n '1,80p'
  echo "[B] jitter test 50 samples"
  cd /Users/mac/.openclaw/workspace/xgvst
  ./scripts/sentry_jitter_trimmed_check.sh "$URL" 50
} | tee -a "$OUT"

echo "[B] done, log=$OUT" | tee -a "$OUT"
