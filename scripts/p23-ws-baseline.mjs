#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve(process.env.P23_OUT_DIR ?? 'reports/lighthouse/P2.3_C/raw');
const WS_URL = process.env.P23_WS_URL ?? 'ws://127.0.0.1:8787/ws/quote?session=p23-baseline';
const SYMBOLS = (process.env.P23_SYMBOLS ?? '000001,600519,300750,000858,601318').split(',').map((s) => s.trim()).filter(Boolean);
const CONCURRENCY = Number(process.env.P23_CONCURRENCY ?? 200);
const DURATION_MS = Number(process.env.P23_DURATION_MS ?? 8000);
const CONNECT_BATCH_SIZE = Number(process.env.P23_CONNECT_BATCH_SIZE ?? 40);
const CONNECT_BATCH_GAP_MS = Number(process.env.P23_CONNECT_BATCH_GAP_MS ?? 60);

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
const BUNDLE_MAGIC = [0x51, 0x42, 0x32];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readVarint(bytes, start) {
  let value = 0;
  let shift = 0;
  let offset = start;

  while (offset < bytes.length && shift <= 35) {
    const b = bytes[offset];
    value |= (b & 0x7f) << shift;
    offset += 1;
    if ((b & 0x80) === 0) return { value, next: offset };
    shift += 7;
  }

  return null;
}

function zigzagDecode32(v) {
  return (v >>> 1) ^ -(v & 1);
}

function decodeQuoteProto(bytes) {
  const out = {};
  let offset = 0;

  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    if (!tag) return null;
    offset = tag.next;

    const field = tag.value >>> 3;
    const wt = tag.value & 0x07;

    if (wt === 2) {
      const len = readVarint(bytes, offset);
      if (!len) return null;
      offset = len.next;
      const end = offset + len.value;
      if (end > bytes.length) return null;
      const v = textDecoder.decode(bytes.slice(offset, end));
      if (field === 1) out.symbol = v;
      if (field === 4) out.ts = v;
      offset = end;
      continue;
    }

    if (wt === 1) {
      if (offset + 8 > bytes.length) return null;
      const v = new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getFloat64(0, true);
      if (field === 2) out.price = v;
      if (field === 3) out.changePct = v;
      offset += 8;
      continue;
    }

    if (wt === 0) {
      const next = readVarint(bytes, offset);
      if (!next) return null;
      offset = next.next;
      continue;
    }

    return null;
  }

  if (!out.symbol || typeof out.price !== 'number' || typeof out.changePct !== 'number') return null;
  return out;
}

function readPackedVarints(bytes, start) {
  const len = readVarint(bytes, start);
  if (!len) return null;

  let offset = len.next;
  const end = offset + len.value;
  if (end > bytes.length) return null;

  const values = [];
  while (offset < end) {
    const value = readVarint(bytes, offset);
    if (!value) return null;
    values.push(value.value);
    offset = value.next;
  }

  return { values, next: end };
}

function decodeQuoteBundleProto(bytes) {
  const out = {
    symbolIds: [],
    sourceIds: [],
    priceDeltas: [],
    changeDeltas: [],
    tsOffsetsMs: []
  };

  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    if (!tag) return null;
    offset = tag.next;

    const field = tag.value >>> 3;
    const wt = tag.value & 0x07;

    if ((field >= 3 && field <= 7) && wt === 2) {
      const packed = readPackedVarints(bytes, offset);
      if (!packed) return null;
      if (field === 3) out.symbolIds = packed.values;
      if (field === 4) out.sourceIds = packed.values;
      if (field === 5) out.priceDeltas = packed.values.map((v) => zigzagDecode32(v));
      if (field === 6) out.changeDeltas = packed.values.map((v) => zigzagDecode32(v));
      if (field === 7) out.tsOffsetsMs = packed.values;
      offset = packed.next;
      continue;
    }

    if (wt === 0) {
      const next = readVarint(bytes, offset);
      if (!next) return null;
      offset = next.next;
      continue;
    }

    return null;
  }

  return { sampleCount: out.symbolIds.length };
}

async function maybeDecompress(bytes, codec) {
  if (codec === 0) return bytes;
  if (codec === 1) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if (codec === 2) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return null;
}

async function decodeFrame(raw) {
  if (typeof raw === 'string') {
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch {}
    return { kind: 'control', parsed, rawBytes: textEncoder.encode(raw).byteLength, tickCount: 0, decodeMs: 0 };
  }

  const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : null;
  if (!bytes) return { kind: 'unknown', rawBytes: 0, tickCount: 0, decodeMs: 0 };

  const started = performance.now();

  if (
    bytes.length >= 4 &&
    bytes[0] === BUNDLE_MAGIC[0] &&
    bytes[1] === BUNDLE_MAGIC[1] &&
    bytes[2] === BUNDLE_MAGIC[2]
  ) {
    const codec = bytes[3];
    const payload = await maybeDecompress(bytes.slice(4), codec);
    if (!payload) return { kind: 'decode_failed', rawBytes: bytes.byteLength, tickCount: 0, decodeMs: performance.now() - started };

    const bundle = decodeQuoteBundleProto(payload);
    if (!bundle) return { kind: 'decode_failed', rawBytes: bytes.byteLength, tickCount: 0, decodeMs: performance.now() - started };

    return { kind: 'bundle', rawBytes: bytes.byteLength, tickCount: bundle.sampleCount, decodeMs: performance.now() - started };
  }

  const quote = decodeQuoteProto(bytes);
  if (quote) return { kind: 'quote', rawBytes: bytes.byteLength, tickCount: 1, decodeMs: performance.now() - started };

  return { kind: 'decode_failed', rawBytes: bytes.byteLength, tickCount: 0, decodeMs: performance.now() - started };
}

async function runScenario(name, transport, compression) {
  const stats = {
    scenario: name,
    transport,
    compression,
    clientsTarget: CONCURRENCY,
    clientsConnected: 0,
    openFailed: 0,
    totalFrames: 0,
    totalTicks: 0,
    totalRawBytes: 0,
    decodeFailedFrames: 0,
    bundleFrames: 0,
    quoteFrames: 0,
    decodeMs: []
  };

  const sockets = [];

  async function openOne() {
    return await new Promise((resolve) => {
      let ws;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        stats.openFailed += 1;
        resolve(null);
        return;
      }

      ws.binaryType = 'arraybuffer';
      const timeout = setTimeout(() => {
        try { ws.close(); } catch {}
        stats.openFailed += 1;
        resolve(null);
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        stats.clientsConnected += 1;
        ws.send(JSON.stringify({ type: 'subscribe', symbols: SYMBOLS, transport, compression }));
        resolve(ws);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        stats.openFailed += 1;
        resolve(null);
      };

      ws.onmessage = async (event) => {
        const decoded = await decodeFrame(event.data);
        if (decoded.kind === 'control') {
          if (decoded.parsed?.type === 'ping') {
            try { ws.send('pong'); } catch {}
          }
          return;
        }

        stats.totalFrames += 1;
        stats.totalRawBytes += decoded.rawBytes;
        stats.totalTicks += decoded.tickCount;
        stats.decodeMs.push(decoded.decodeMs);

        if (decoded.kind === 'bundle') stats.bundleFrames += 1;
        else if (decoded.kind === 'quote') stats.quoteFrames += 1;
        else if (decoded.kind === 'decode_failed') stats.decodeFailedFrames += 1;
      };
    });
  }

  for (let offset = 0; offset < CONCURRENCY; offset += CONNECT_BATCH_SIZE) {
    const batch = [];
    for (let i = offset; i < Math.min(CONCURRENCY, offset + CONNECT_BATCH_SIZE); i += 1) {
      batch.push(openOne());
    }
    const connected = await Promise.all(batch);
    for (const ws of connected) if (ws) sockets.push(ws);
    if (offset + CONNECT_BATCH_SIZE < CONCURRENCY) await sleep(CONNECT_BATCH_GAP_MS);
  }

  await sleep(DURATION_MS);

  for (const ws of sockets) {
    try { ws.close(1000, 'done'); } catch {}
  }

  await sleep(350);

  const sortedDecode = [...stats.decodeMs].sort((a, b) => a - b);
  const p95DecodeMs = sortedDecode.length ? sortedDecode[Math.ceil(sortedDecode.length * 0.95) - 1] : null;

  return {
    ...stats,
    bytesPerTick: stats.totalTicks ? stats.totalRawBytes / stats.totalTicks : null,
    decodeAvgMs: stats.decodeMs.length ? stats.decodeMs.reduce((a, n) => a + n, 0) / stats.decodeMs.length : null,
    decodeP95Ms: p95DecodeMs
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const baseline = await runScenario('baseline', 'legacy', 'none');
  await sleep(1200);
  const optimized = await runScenario('optimized', 'bundle', 'gzip');

  const savingPct = baseline.totalRawBytes > 0
    ? ((baseline.totalRawBytes - optimized.totalRawBytes) / baseline.totalRawBytes) * 100
    : 0;

  const report = {
    generatedAt: new Date().toISOString(),
    wsUrl: WS_URL,
    concurrency: CONCURRENCY,
    durationMs: DURATION_MS,
    baseline,
    optimized,
    savingPct: Number(savingPct.toFixed(2))
  };

  const file = path.join(OUT_DIR, 'p23-ws-baseline.json');
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, file, savingPct: report.savingPct }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
