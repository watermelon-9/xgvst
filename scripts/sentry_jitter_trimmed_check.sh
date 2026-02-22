#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://api.xgvst.com/v3/health}"
N="${2:-50}"

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
  sleep 0.5
done

if [[ ${#vals[@]} -lt 10 ]]; then
  echo "[trimmed-jitter] insufficient valid samples"
  exit 1
fi

python3 - <<PY
vals=[float(v) for v in "${vals[*]}".split()]
vals=sorted(vals)
n=len(vals)
trim=max(1, int(n*0.05))
core=vals[trim:n-trim] if n-2*trim>=2 else vals
mn=min(core); mx=max(core); diff=mx-mn
avg=sum(core)/len(core)
print(f"[trimmed-jitter] samples={n} trim_each_side={trim} core={len(core)}")
print(f"[trimmed-jitter] avg={avg:.3f}ms min={mn:.3f}ms max={mx:.3f}ms diff={diff:.3f}ms")
if diff < 50:
    print('[trimmed-jitter] PASS (<50ms)')
else:
    print('[trimmed-jitter] FAIL (>=50ms)')
    raise SystemExit(2)
PY