#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
REPORT_DIR="$ROOT_DIR/reports/lighthouse"
DATE_TAG="$(date +%F)"
PREVIEW_PORT="${PREVIEW_PORT:-}"

if [[ -z "$PREVIEW_PORT" ]]; then
  PREVIEW_PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
fi

mkdir -p "$REPORT_DIR"
LOCK_DIR="$ROOT_DIR/.tmp/verify-p1.1.lock"
mkdir -p "$ROOT_DIR/.tmp"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[verify-p1.1] ERROR: 已有验收脚本在运行，请先结束后再重试" >&2
  exit 1
fi

RUN_TAG="$(date +%Y%m%d_%H%M%S)"
DEV_LOG="$REPORT_DIR/p1.1-verify-${RUN_TAG}-dev.log"
PREVIEW_LOG="$REPORT_DIR/p1.1-verify-${RUN_TAG}-preview.log"
CHECK_LOG="$REPORT_DIR/p1.1-verify-${RUN_TAG}-check.log"
BUILD_LOG="$REPORT_DIR/p1.1-verify-${RUN_TAG}-build.log"
MOBILE_JSON="$REPORT_DIR/p1.1-verify-${RUN_TAG}-mobile.json"
DESKTOP_JSON="$REPORT_DIR/p1.1-verify-${RUN_TAG}-desktop.json"
REPORT_MD="$REPORT_DIR/P1.1_统一口径验收报告_${DATE_TAG}_${RUN_TAG}.md"
LATEST_REPORT_MD="$REPORT_DIR/P1.1_统一口径验收报告_${DATE_TAG}.md"
LATEST_MOBILE_JSON="$REPORT_DIR/p1.1-verify-mobile.json"
LATEST_DESKTOP_JSON="$REPORT_DIR/p1.1-verify-desktop.json"

DEV_PID=""
PREVIEW_PID=""

cleanup() {
  if [[ -n "$DEV_PID" ]] && kill -0 "$DEV_PID" >/dev/null 2>&1; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$PREVIEW_PID" ]] && kill -0 "$PREVIEW_PID" >/dev/null 2>&1; then
    kill "$PREVIEW_PID" >/dev/null 2>&1 || true
  fi
  rmdir "$LOCK_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_log_pattern() {
  local file="$1"
  local pattern="$2"
  local timeout_sec="$3"
  local start_ts
  start_ts="$(date +%s)"

  while true; do
    if [[ -f "$file" ]] && grep -Eq "$pattern" "$file"; then
      return 0
    fi
    if (( $(date +%s) - start_ts >= timeout_sec )); then
      return 1
    fi
    sleep 0.25
  done
}

wait_for_http() {
  local url="$1"
  local timeout_sec="$2"
  local start_ts
  start_ts="$(date +%s)"

  while true; do
    if curl -sSf "$url" >/dev/null 2>&1; then
      return 0
    fi
    if (( $(date +%s) - start_ts >= timeout_sec )); then
      return 1
    fi
    sleep 0.25
  done
}

extract_ready_ms() {
  local file="$1"
  python3 - <<'PY' "$file"
import re,sys
text=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
m=re.search(r'ready in\s+(\d+)\s*ms', text, re.I)
print(m.group(1) if m else '')
PY
}

median_from_ints() {
  python3 - <<'PY' "$@"
import statistics,sys
vals=[int(x) for x in sys.argv[1:] if x]
if not vals:
    print('')
else:
    print(int(statistics.median(vals)))
PY
}

score_from_lighthouse() {
  local json_path="$1"
  node - <<'NODE' "$json_path"
const fs = require('fs');
const p = process.argv[2];
const j = JSON.parse(fs.readFileSync(p,'utf8'));
const score = Math.round((j.categories.performance.score || 0) * 100);
console.log(score);
NODE
}

run_dev_ready_once() {
  local run_label="$1"
  local tmp_log="$REPORT_DIR/.p1.1-verify-${run_label}.log"
  local run_port
  run_port="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"

  (
    cd "$WEB_DIR"
    corepack pnpm dev --host 127.0.0.1 --port "$run_port" --strictPort >"$tmp_log" 2>&1
  ) &
  DEV_PID=$!

  if ! wait_for_log_pattern "$tmp_log" 'ready in[[:space:]]+[0-9]+[[:space:]]*ms' 60; then
    echo "[verify-p1.1] ERROR: dev(${run_label}) 未在60秒内就绪" >&2
    return 1
  fi

  local ready_ms
  ready_ms="$(extract_ready_ms "$tmp_log")"
  if [[ -z "$ready_ms" ]]; then
    echo "[verify-p1.1] ERROR: dev(${run_label}) 无法解析 ready 时间" >&2
    return 1
  fi

  {
    echo "===== ${run_label} ====="
    cat "$tmp_log"
    echo
  } >>"$DEV_LOG"

  kill "$DEV_PID" >/dev/null 2>&1 || true
  pkill -f "vite dev --host 127.0.0.1 --port ${run_port}" >/dev/null 2>&1 || true
  DEV_PID=""
  rm -f "$tmp_log"

  echo "$ready_ms"
}

: > "$DEV_LOG"

echo "[verify-p1.1] 1/7 清理 dev 缓存（仅 .vite）"
rm -rf "$WEB_DIR/node_modules/.vite"

echo "[verify-p1.1] 2/7 dev 启动分层采样（1次冷启动 + 5次热启动）"
COLD_READY_MS="$(run_dev_ready_once 'cold-run-1')"
WARM_READY_MS=()
for i in 1 2 3 4 5; do
  WARM_READY_MS+=("$(run_dev_ready_once "warm-run-${i}")")
done
HOT_MEDIAN_MS="$(median_from_ints "${WARM_READY_MS[@]}")"

echo "[verify-p1.1] 3/7 check/build"
(
  cd "$ROOT_DIR"
  corepack pnpm --filter web check | tee "$CHECK_LOG"
)
(
  cd "$ROOT_DIR"
  corepack pnpm --filter web build | tee "$BUILD_LOG"
)

echo "[verify-p1.1] 4/7 preview + Lighthouse（统一口径）"
(
  cd "$WEB_DIR"
  corepack pnpm preview --host 127.0.0.1 --port "$PREVIEW_PORT" --strictPort >"$PREVIEW_LOG" 2>&1
) &
PREVIEW_PID=$!

if ! wait_for_http "http://127.0.0.1:${PREVIEW_PORT}/" 30; then
  echo "[verify-p1.1] ERROR: preview 未就绪" >&2
  exit 1
fi

(
  cd "$ROOT_DIR"
  npx -y lighthouse "http://127.0.0.1:${PREVIEW_PORT}" \
    --only-categories=performance \
    --chrome-flags='--headless=new --no-sandbox' \
    --output=json --output-path="$MOBILE_JSON" --quiet

  npx -y lighthouse "http://127.0.0.1:${PREVIEW_PORT}" \
    --preset=desktop --only-categories=performance \
    --chrome-flags='--headless=new --no-sandbox' \
    --output=json --output-path="$DESKTOP_JSON" --quiet
)

MOBILE_SCORE="$(score_from_lighthouse "$MOBILE_JSON")"
DESKTOP_SCORE="$(score_from_lighthouse "$DESKTOP_JSON")"

kill "$PREVIEW_PID" >/dev/null 2>&1 || true
PREVIEW_PID=""

echo "[verify-p1.1] 5/7 DoD 条件判定"
DOD1_COLD_REF="FAIL"
DOD1_HOT_PASS="FAIL"
DOD2_PASS="FAIL"
DOD3_PASS="FAIL"
DOD4_PASS="FAIL"
DOD5_PASS="FAIL"

if [[ "$COLD_READY_MS" =~ ^[0-9]+$ ]] && (( COLD_READY_MS < 1200 )); then
  DOD1_COLD_REF="PASS"
fi

if [[ -n "$HOT_MEDIAN_MS" && "$HOT_MEDIAN_MS" =~ ^[0-9]+$ ]] && (( HOT_MEDIAN_MS < 800 )); then
  DOD1_HOT_PASS="PASS"
fi

if [[ -f "$ROOT_DIR/apps/web/src/routes/+page.svelte" ]] \
  && [[ -f "$ROOT_DIR/apps/web/src/routes/market/+page.svelte" ]] \
  && [[ -f "$ROOT_DIR/apps/web/src/routes/detail/+page.svelte" ]] \
  && grep -q "toggleTheme" "$ROOT_DIR/apps/web/src/routes/+layout.svelte"; then
  DOD2_PASS="PASS"
fi

if grep -q "svelte-check found 0 errors and 0 warnings" "$CHECK_LOG" \
  && grep -q -- "--color-up" "$ROOT_DIR/apps/web/src/app.css" \
  && grep -q "up: '#ef4444'" "$ROOT_DIR/apps/web/uno.config.ts"; then
  DOD3_PASS="PASS"
fi

if (( MOBILE_SCORE >= 98 )) && (( DESKTOP_SCORE >= 98 )); then
  DOD4_PASS="PASS"
fi

if git -C "$ROOT_DIR" ls-files --error-unmatch PERFORMANCE.md >/dev/null 2>&1 \
  && git -C "$ROOT_DIR" ls-files --error-unmatch "reports/lighthouse/西瓜说股_v3.0_P1.1_初始性能报告.md" >/dev/null 2>&1; then
  DOD5_PASS="PASS"
fi

OVERALL="FAIL"
if [[ "$DOD1_HOT_PASS" == "PASS" && "$DOD2_PASS" == "PASS" && "$DOD3_PASS" == "PASS" && "$DOD4_PASS" == "PASS" && "$DOD5_PASS" == "PASS" ]]; then
  OVERALL="PASS"
fi

echo "[verify-p1.1] 6/7 生成报告：$REPORT_MD"
DEV_LOG_FILE="$(basename "$DEV_LOG")"
CHECK_LOG_FILE="$(basename "$CHECK_LOG")"
BUILD_LOG_FILE="$(basename "$BUILD_LOG")"
MOBILE_JSON_FILE="$(basename "$MOBILE_JSON")"
DESKTOP_JSON_FILE="$(basename "$DESKTOP_JSON")"
cat >"$REPORT_MD" <<EOF
# P1.1 统一口径验收报告（${DATE_TAG}）

- 执行脚本：scripts/verify-p1.1.sh
- 验收模式：
  - Dev 冷启动：参考值 < 1200ms
  - Dev 热启动：连续 5 次 warm-run 中位数 < 800ms（DoD-1 主判定）
  - Lighthouse：仅在 build+preview 口径下验收（DoD-4）

## 总判定

**${OVERALL}**

## DoD 结果

1. DoD-1（pnpm dev 秒开）
   - 冷启动 ready: ${COLD_READY_MS} ms（参考线<1200：${DOD1_COLD_REF}）
   - 热启动5次 ready(ms): ${WARM_READY_MS[*]}
   - 热启动中位数: ${HOT_MEDIAN_MS} ms（门禁<800：${DOD1_HOT_PASS}）
2. DoD-2（Mock 三页 + 暗黑切换）：${DOD2_PASS}
3. DoD-3（Runes + UnoCSS + 无警告）：${DOD3_PASS}
4. DoD-4（Lighthouse mobile/desktop >=98，preview口径）
   - mobile: ${MOBILE_SCORE}
   - desktop: ${DESKTOP_SCORE}
   - 判定: ${DOD4_PASS}
5. DoD-5（PERFORMANCE.md + 初始报告已提交）：${DOD5_PASS}

## 证据文件

- Dev 日志：reports/lighthouse/${DEV_LOG_FILE}
- Check 日志：reports/lighthouse/${CHECK_LOG_FILE}
- Build 日志：reports/lighthouse/${BUILD_LOG_FILE}
- Lighthouse：
  - reports/lighthouse/${MOBILE_JSON_FILE}
  - reports/lighthouse/${DESKTOP_JSON_FILE}
EOF

cp "$REPORT_MD" "$LATEST_REPORT_MD"
cp "$MOBILE_JSON" "$LATEST_MOBILE_JSON"
cp "$DESKTOP_JSON" "$LATEST_DESKTOP_JSON"

echo "[verify-p1.1] 7/7 DONE: OVERALL=${OVERALL}, cold=${COLD_READY_MS}ms, warm=${WARM_READY_MS[*]}, warm-median=${HOT_MEDIAN_MS}ms, mobile=${MOBILE_SCORE}, desktop=${DESKTOP_SCORE}"