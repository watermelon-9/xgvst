#!/usr/bin/env bash
set -euo pipefail

URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "Usage: $0 <url>"
  exit 1
fi

echo "[1/3] TTFB sampling for: $URL"
for i in 1 2 3 4 5; do
  curl -sS -o /dev/null -w "sample#$i ttfb=%{time_starttransfer}s total=%{time_total}s code=%{http_code}\n" "$URL"
done

echo
echo "[2/3] CDN compression headers"
curl -sSI -H 'Accept-Encoding: br,gzip' "$URL" | grep -Ei 'HTTP/|content-encoding|content-length|cf-cache-status|server|vary' || true

echo
echo "[3/3] Local dist size baseline (apps/web/dist)"
if [[ -d "$(dirname "$0")/../apps/web/dist" ]]; then
  du -sh "$(dirname "$0")/../apps/web/dist"
  has_brotli=0
  if command -v brotli >/dev/null 2>&1; then
    has_brotli=1
  fi
  find "$(dirname "$0")/../apps/web/dist/assets" -type f -maxdepth 1 2>/dev/null | head -n 10 | while read -r f; do
    raw=$(wc -c < "$f" | tr -d ' ')
    gz=$(gzip -c "$f" | wc -c | tr -d ' ')
    if [[ "$has_brotli" -eq 1 ]]; then
      br=$(brotli -c "$f" | wc -c | tr -d ' ')
    else
      br="N/A(no-brotli-cli)"
    fi
    echo "$(basename "$f") raw=${raw} gzip=${gz} br=${br}"
  done
else
  echo "dist not found. run: cd apps/web && corepack pnpm build"
fi
