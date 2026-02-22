#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://api.xgvst.com/v3/blob?bytes=1048576}"
out=$(curl --http1.1 -sS -o /tmp/xgvst-1mb.bin -w "%{http_code} %{size_download} %{time_total}" "$URL")
code=$(echo "$out" | awk '{print $1}')
size=$(echo "$out" | awk '{print $2}')
time=$(echo "$out" | awk '{print $3}')
mbps=$(python3 - <<PY
size=float('$size')
sec=max(float('$time'),1e-9)
print(round((size/1024/1024)/sec,3))
PY
)
echo "code=$code size=${size}B total=${time}s throughput=${mbps}MB/s"
