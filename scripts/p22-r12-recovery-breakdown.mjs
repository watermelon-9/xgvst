#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WS_BASE_URL = process.env.P22_R12_WS_URL || 'ws://127.0.0.1:8787/ws/quote';
const ITERATIONS = Number(process.env.P22_R12_ITERATIONS || 40);
const SYMBOLS = (process.env.P22_R12_SYMBOLS || '000001,600519,300750').split(',').map((s) => s.trim()).filter(Boolean);
const OUT_DIR = path.resolve(process.env.P22_R12_OUT_DIR || 'reports/lighthouse/P2.2_R12_A');

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function summarize(values) {
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: values.length ? Math.max(...values) : null
  };
}

function connectWs(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('connect_timeout'));
    }, timeoutMs);

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }

    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ws);
    };
    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('ws_error'));
    };
  });
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const session = process.env.P22_R12_SESSION || `p22-r12-breakdown-${Date.now()}`;
  const wsUrl = `${WS_BASE_URL}${WS_BASE_URL.includes('?') ? '&' : '?'}session=${encodeURIComponent(session)}`;

  const stages = {
    openToResyncSendMs: [],
    resyncToDoRecvMs: [],
    doRecvToUpstreamReadyMs: [],
    upstreamToMemorySnapshotSentMs: [],
    memorySnapshotToFirstTickMs: [],
    endToEndOpenToFirstTickMs: [],
    endToEndResyncToFirstTickMs: []
  };

  const rows = [];

  let ws = await connectWs(wsUrl);
  ws.send(JSON.stringify({ type: 'subscribe', symbols: SYMBOLS }));
  await sleep(500);

  for (let i = 0; i < ITERATIONS; i += 1) {
    const reconnectStart = Date.now();
    try { ws.close(1000, 'r12 breakdown reconnect'); } catch {}
    await sleep(60);

    const openStart = Date.now();
    ws = await connectWs(wsUrl);
    const openAt = Date.now();

    const resyncSentAt = Date.now();
    ws.send(JSON.stringify({ type: 'resync', symbols: SYMBOLS, clientSentAtMs: resyncSentAt }));

    const row = {
      iteration: i + 1,
      openLatencyMs: openAt - openStart,
      reconnectGapMs: openAt - reconnectStart,
      resyncedPerf: null,
      firstTickAtMs: null
    };

    const outcome = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 6000);
      let perf = null;
      let firstTickAtMs = null;

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          let parsed = null;
          try { parsed = JSON.parse(event.data); } catch {}
          if (!parsed) return;
          if (parsed?.type === 'ping') {
            try { ws.send('pong'); } catch {}
            return;
          }
          if (parsed?.type === 'resynced' && parsed?.perf) {
            perf = parsed.perf;
            row.resyncedPerf = perf;
            if (firstTickAtMs !== null) {
              clearTimeout(timer);
              resolve({ ok: true, perf, firstTickAtMs });
            }
          }
          return;
        }

        if (firstTickAtMs === null) {
          firstTickAtMs = Date.now();
          row.firstTickAtMs = firstTickAtMs;
          if (perf) {
            clearTimeout(timer);
            resolve({ ok: true, perf, firstTickAtMs });
          }
        }
      };
    });

    rows.push(row);

    if (!outcome.ok || !outcome.perf || !outcome.firstTickAtMs) {
      continue;
    }

    const perf = outcome.perf;
    const doRecv = Number(perf.doResyncReceivedAtMs);
    const doUpstreamReady = Number(perf.doUpstreamReadyAtMs);
    const doMemorySnapshotSent = Number(perf.doMemorySnapshotSentAtMs);
    const clientSent = Number(perf.clientSentAtMs || resyncSentAt);
    const firstTickAtMs = Number(outcome.firstTickAtMs);

    if ([doRecv, doUpstreamReady, doMemorySnapshotSent, clientSent, firstTickAtMs].every((v) => Number.isFinite(v))) {
      stages.openToResyncSendMs.push(Math.max(0, resyncSentAt - openAt));
      stages.resyncToDoRecvMs.push(Math.max(0, doRecv - clientSent));
      stages.doRecvToUpstreamReadyMs.push(Math.max(0, doUpstreamReady - doRecv));
      stages.upstreamToMemorySnapshotSentMs.push(Math.max(0, doMemorySnapshotSent - doUpstreamReady));
      stages.memorySnapshotToFirstTickMs.push(Math.max(0, firstTickAtMs - doMemorySnapshotSent));
      stages.endToEndOpenToFirstTickMs.push(Math.max(0, firstTickAtMs - openAt));
      stages.endToEndResyncToFirstTickMs.push(Math.max(0, firstTickAtMs - clientSent));
    }
  }

  try { ws.close(1000, 'done'); } catch {}

  const summary = Object.fromEntries(
    Object.entries(stages).map(([k, vals]) => [k, summarize(vals)])
  );

  const result = {
    generatedAt: new Date().toISOString(),
    config: { wsUrl, iterations: ITERATIONS, symbols: SYMBOLS },
    summary,
    samples: rows
  };

  const outPath = path.join(OUT_DIR, 'recovery-latency-breakdown.json');
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));

  console.log(JSON.stringify({ ok: true, outPath, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
