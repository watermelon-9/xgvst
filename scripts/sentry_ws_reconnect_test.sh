#!/usr/bin/env bash
set -euo pipefail

WS_URL="${1:-wss://api.xgvst.com/ws}"
SERVER_PLIST="$HOME/Library/LaunchAgents/com.xgvst.api.server.plist"
TMP_NODE="/tmp/xgvst-ws-reconnect.mjs"
OUT="/tmp/xgvst-ws-reconnect.out"

cat > "$TMP_NODE" <<'JS'
const url = process.argv[2]
let stage = 'initial'
let reconnectStartedAt = 0
let attempts = 0

const backoff = [0, 200, 500, 1000, 2000]

function openSocket() {
  attempts += 1
  const ws = new WebSocket(url)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    if (stage === 'initial') {
      console.log('initial_open')
      stage = 'steady'
      return
    }
    if (stage === 'reconnecting') {
      const elapsed = Date.now() - reconnectStartedAt
      console.log(`reconnected attempt=${attempts} elapsedMs=${elapsed}`)
      ws.close()
      process.exit(0)
    }
  }

  ws.onclose = () => {
    if (stage === 'steady') {
      stage = 'reconnecting'
      reconnectStartedAt = Date.now()
      attempts = 0
    }

    if (stage === 'reconnecting') {
      const wait = backoff[Math.min(attempts, backoff.length - 1)]
      if (attempts > 6) {
        console.log('reconnect_failed')
        process.exit(2)
      }
      setTimeout(openSocket, wait)
    }
  }

  ws.onerror = () => {}
}

openSocket()
JS

node "$TMP_NODE" "$WS_URL" > "$OUT" 2>&1 &
NODE_PID=$!

for _ in {1..30}; do
  if grep -q 'initial_open' "$OUT" 2>/dev/null; then
    break
  fi
  sleep 0.2
done

# 模拟链路波动：关闭后端服务 150ms 后恢复
launchctl unload "$SERVER_PLIST" >/dev/null 2>&1 || true
sleep 0.15
launchctl load "$SERVER_PLIST"

for _ in {1..80}; do
  if grep -q 'reconnected' "$OUT" 2>/dev/null; then
    cat "$OUT"
    kill "$NODE_PID" >/dev/null 2>&1 || true
    exit 0
  fi
  if grep -q 'reconnect_failed' "$OUT" 2>/dev/null; then
    cat "$OUT"
    exit 2
  fi
  sleep 0.2
done

cat "$OUT" || true
kill "$NODE_PID" >/dev/null 2>&1 || true
echo 'reconnect_timeout'
exit 2