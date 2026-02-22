#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://api.xgvst.com/v3/health}"

echo "[protocol] target=$URL"

echo "[protocol] response headers"
curl -sS -o /dev/null -D - "$URL" | grep -Ei 'HTTP/|server:|alt-svc|cf-ray|content-type' || true

echo "[protocol] h3 availability check"
if curl -sS -o /dev/null -D - "$URL" | grep -qi 'alt-svc:.*h3'; then
  echo "h3_advertised=yes"
else
  echo "h3_advertised=no"
fi

# Note: local curl build may not support --http3 (no quiche/ngtcp2).