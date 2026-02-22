#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://api.xgvst.com/v3/health}"
N="${2:-10}"

vals=()
for ((i=1;i<=N;i++)); do
  out=$(curl --http1.1 -sS -o /dev/null -w "%{http_code} %{time_starttransfer}" "$URL" || echo "000 0")
  code=$(echo "$out" | awk '{print $1}')
  ttfb=$(echo "$out" | awk '{print $2}')
  ms=$(python3 - <<PY
print(round(float('$ttfb')*1000,3))
PY
)
  echo "sample#$i code=$code ttfb=${ms}ms"
  if [[ "$code" == "200" ]]; then
    vals+=("$ms")
  fi
  sleep 1
done

if [[ ${#vals[@]} -lt 2 ]]; then
  echo "[jitter] insufficient valid samples"
  exit 1
fi

min=${vals[0]}
max=${vals[0]}
for v in "${vals[@]}"; do
  awk "BEGIN{exit !($v < $min)}" && min=$v || true
  awk "BEGIN{exit !($v > $max)}" && max=$v || true
done
jitter=$(python3 - <<PY
print(round(float('$max')-float('$min'),3))
PY
)
echo "[jitter] min=${min}ms max=${max}ms diff=${jitter}ms"

awk "BEGIN{exit !($jitter > 50)}" && {
  echo "[jitter] UNSTABLE (>50ms)"
  exit 2
} || {
  echo "[jitter] STABLE"
}
