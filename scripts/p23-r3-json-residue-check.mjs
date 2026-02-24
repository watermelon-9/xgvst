#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const wsUrl = process.env.WS_URL ?? 'ws://127.0.0.1:8787/ws/quote?session=p23-r3-json-check';
const outPath = resolve(
  process.env.OUT_PATH ?? `reports/lighthouse/P2.3_A/raw/r3-json-residue-check-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
);
const durationMs = Number(process.env.DURATION_MS ?? 2500);

const counters = {
  textFrames: 0,
  textTickFrames: 0,
  textJsonFallbackTransportFrames: 0,
  resyncAckFrames: 0,
  resyncAckImmediateDataFrames: 0,
  resyncAckImmediateDataTotal: 0,
  binaryFrames: 0
};

const samples = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const ws = new WebSocket(wsUrl);
ws.binaryType = 'arraybuffer';

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('ws connect timeout')), 5000);
  ws.onopen = () => {
    clearTimeout(timer);
    resolve();
  };
  ws.onerror = (e) => {
    clearTimeout(timer);
    reject(new Error(`ws open error: ${String(e?.message || 'unknown')}`));
  };
});

ws.send(JSON.stringify({ type: 'subscribe', symbols: ['000001', '600519'], transport: 'legacy' }));
await sleep(200);
ws.send(JSON.stringify({ type: 'resync', symbols: ['000001', '600519'], transport: 'legacy' }));

const started = Date.now();
while (Date.now() - started < durationMs) {
  const event = await new Promise((resolve) => {
    const onMessage = (msg) => {
      ws.removeEventListener('message', onMessage);
      resolve(msg);
    };
    ws.addEventListener('message', onMessage);
    setTimeout(() => {
      ws.removeEventListener('message', onMessage);
      resolve(null);
    }, 500);
  });

  if (!event) continue;

  const data = event.data;
  if (typeof data === 'string') {
    counters.textFrames += 1;
    let parsed = null;
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = null;
    }

    if (parsed?.type === 'tick') counters.textTickFrames += 1;
    if (parsed?.transport === 'json-fallback' || parsed?.transport === 'json') {
      counters.textJsonFallbackTransportFrames += 1;
    }
    if (parsed?.type === 'resync_ack') {
      counters.resyncAckFrames += 1;
      if (Array.isArray(parsed.immediateData)) {
        counters.resyncAckImmediateDataFrames += 1;
        counters.resyncAckImmediateDataTotal += parsed.immediateData.length;
      }
    }

    if (samples.length < 12) {
      samples.push(parsed ?? data.slice(0, 180));
    }

    if (parsed?.type === 'ping') ws.send('pong');
  } else {
    counters.binaryFrames += 1;
  }
}

try {
  ws.close(1000, 'done');
} catch {}

const checks = {
  noJsonTickFrames: counters.textTickFrames === 0,
  noJsonFallbackTransportFrames: counters.textJsonFallbackTransportFrames === 0,
  noImmediateDataResidue: counters.resyncAckImmediateDataFrames === 0 && counters.resyncAckImmediateDataTotal === 0,
  gotBinaryFrames: counters.binaryFrames > 0
};

const report = {
  ok: Object.values(checks).every(Boolean),
  ts: new Date().toISOString(),
  wsUrl,
  durationMs,
  checks,
  counters,
  samples
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (!report.ok) {
  console.error(`[p23-r3-json-residue-check] FAILED out=${outPath}`);
  process.exit(1);
}

console.log(`[p23-r3-json-residue-check] OK out=${outPath}`);
