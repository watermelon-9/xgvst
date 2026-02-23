#!/usr/bin/env bash
set -euo pipefail

URL="${1:-}"
THRESHOLD="${2:-97}"
RUNS="${3:-3}"
OUT_DIR="${4:-reports/lighthouse/P1.3_C2_CI}"

if [[ -z "$URL" ]]; then
  echo "Usage: $0 <url> [threshold=97] [runs=3] [out_dir=reports/lighthouse/P1.3_C2_CI]" >&2
  exit 2
fi

if ! [[ "$THRESHOLD" =~ ^[0-9]+$ ]] || ! [[ "$RUNS" =~ ^[0-9]+$ ]]; then
  echo "[lh-median-check] threshold/runs 必须是整数" >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_ABS="$ROOT_DIR/$OUT_DIR"
mkdir -p "$OUT_ABS"

TS="$(date +%Y%m%d-%H%M%S)"
PREFIX="$OUT_ABS/lh-median-${TS}"

scores=()
json_files=()

for i in $(seq 1 "$RUNS"); do
  json_path="${PREFIX}-run${i}.json"
  json_files+=("$json_path")

  npx -y lighthouse "$URL" \
    --only-categories=performance \
    --emulated-form-factor=mobile \
    --chrome-flags='--headless=new --no-sandbox' \
    --output=json \
    --output-path="$json_path" \
    --quiet

  score="$(node - <<'NODE' "$json_path"
const fs = require('fs');
const p = process.argv[2];
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const s = Math.round((j?.categories?.performance?.score ?? 0) * 100);
console.log(s);
NODE
)"
  scores+=("$score")
  echo "[lh-median-check] run ${i}/${RUNS}: score=${score}"
done

summary_path="${PREFIX}-summary.json"
node - <<'NODE' "$URL" "$THRESHOLD" "$RUNS" "$summary_path" "${scores[@]}"
const fs = require('fs');
const [url, thresholdRaw, runsRaw, summaryPath, ...scoreRaw] = process.argv.slice(2);
const threshold = Number(thresholdRaw);
const runs = Number(runsRaw);
const scores = scoreRaw.map((x) => Number(x)).filter((x) => Number.isFinite(x));
const sorted = [...scores].sort((a,b)=>a-b);
const median = sorted.length % 2
  ? sorted[(sorted.length - 1) / 2]
  : Math.round((sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2);
const pass = median >= threshold;
const out = {
  url,
  threshold,
  runs,
  scores,
  sortedScores: sorted,
  median,
  pass,
  generatedAt: new Date().toISOString()
};
fs.writeFileSync(summaryPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
NODE

median="$(node - <<'NODE' "$summary_path"
const fs = require('fs');
const p = process.argv[2];
const j = JSON.parse(fs.readFileSync(p,'utf8'));
console.log(j.median);
NODE
)"

if (( median < THRESHOLD )); then
  echo "[lh-median-check] FAIL: median=${median} < threshold=${THRESHOLD}" >&2
  echo "[lh-median-check] summary: $summary_path" >&2
  exit 1
fi

echo "[lh-median-check] PASS: median=${median} >= threshold=${THRESHOLD}"
echo "[lh-median-check] summary: $summary_path"
