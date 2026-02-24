#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve(process.env.P23_R3_OUT_DIR ?? 'reports/lighthouse/P2.3_C/raw');
const WS_URL = process.env.P23_R3_WS_URL ?? 'ws://127.0.0.1:8787/ws/quote?session=p23-r3-5000';
const STORAGE_URL = process.env.P23_R3_STORAGE_URL ?? 'http://127.0.0.1:8787/api/debug/storage/bench';
const DEBUG_TOKEN = process.env.DEBUG_SOURCE_TOKEN ?? '';

const SYMBOLS = (process.env.P23_R3_SYMBOLS ?? '000001,600519,300750,000858,601318')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const CONCURRENCY = Number(process.env.P23_R3_CONCURRENCY ?? 240);
const DURATION_MS = Number(process.env.P23_R3_DURATION_MS ?? 30000);
const CONNECT_BATCH_SIZE = Number(process.env.P23_R3_CONNECT_BATCH_SIZE ?? 30);
const CONNECT_BATCH_GAP_MS = Number(process.env.P23_R3_CONNECT_BATCH_GAP_MS ?? 80);
const STORAGE_INTERVAL_MS = Number(process.env.P23_R3_STORAGE_INTERVAL_MS ?? 3000);
const STORAGE_ITERATIONS = Number(process.env.P23_R3_STORAGE_ITERATIONS ?? 120);
const STORAGE_VALUE_SIZE = Number(process.env.P23_R3_STORAGE_VALUE_SIZE ?? 256);

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const BUNDLE_MAGIC = [0x51, 0x42, 0x32];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))] ?? null;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((acc, n) => acc + n, 0) / values.length;
}

function linearSlope(points, xKey, yKey) {
  if (points.length < 2) return null;
  const x0 = points[0][xKey];
  const xs = points.map((p) => p[xKey] - x0);
  const ys = points.map((p) => p[yKey]);

  const xMean = mean(xs);
  const yMean = mean(ys);
  if (xMean == null || yMean == null) return null;

  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    num += dx * dy;
    den += dx * dx;
  }
  if (den === 0) return null;
  return num / den;
}

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
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    return {
      kind: 'control',
      parsed,
      rawBytes: textEncoder.encode(raw).byteLength,
      tickCount: 0,
      decodeMs: 0
    };
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

async function postStorageBench() {
  const started = Date.now();
  try {
    const res = await fetch(STORAGE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(DEBUG_TOKEN ? { 'x-debug-token': DEBUG_TOKEN } : {})
      },
      body: JSON.stringify({ iterations: STORAGE_ITERATIONS, valueSize: STORAGE_VALUE_SIZE }),
      signal: AbortSignal.timeout(30000)
    });

    const bodyText = await res.text();
    let body = null;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }

    return {
      ts: new Date().toISOString(),
      latencyMs: Date.now() - started,
      httpStatus: res.status,
      ok: Boolean(res.ok && body?.ok),
      stats: body?.stats ?? null,
      error: body?.ok ? null : body?.error ?? null,
      rawText: body ? undefined : bodyText
    };
  } catch (error) {
    return {
      ts: new Date().toISOString(),
      latencyMs: Date.now() - started,
      httpStatus: null,
      ok: false,
      stats: null,
      error: String(error?.message || error)
    };
  }
}

function aggregateStorage(samples) {
  const okSamples = samples.filter((s) => s.ok && s.stats);

  const metric = (path) => {
    const means = [];
    const p95s = [];
    for (const s of okSamples) {
      const v = path(s.stats);
      if (typeof v?.meanMs === 'number') means.push(v.meanMs);
      if (typeof v?.p95Ms === 'number') p95s.push(v.p95Ms);
    }
    return {
      runs: okSamples.length,
      meanOfMeanMs: mean(means),
      p95OfP95Ms: percentile(p95s, 95),
      maxP95Ms: p95s.length ? Math.max(...p95s) : null
    };
  };

  return {
    sampleCount: samples.length,
    okCount: okSamples.length,
    errorRatePct: samples.length ? ((samples.length - okSamples.length) / samples.length) * 100 : 0,
    kvWrite: metric((stats) => stats.kvWrite),
    kvRead: metric((stats) => stats.kvRead),
    d1Read: metric((stats) => stats.d1Read),
    d1Write: metric((stats) => stats.d1Write)
  };
}

function buildTrendSeries(startedAtMs, bucketMap) {
  const rows = [...bucketMap.entries()]
    .map(([sec, count]) => ({ sec, ticks: count, tFromStartSec: sec }))
    .sort((a, b) => a.sec - b.sec)
    .map((row) => ({
      ...row,
      wallTime: new Date(startedAtMs + row.sec * 1000).toISOString()
    }));

  const values = rows.map((r) => r.ticks);
  return {
    rows,
    avg: mean(values),
    p95: percentile(values, 95),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null
  };
}

function evaluateDod(summary) {
  const dod5Rules = {
    requireMetricsPresent:
      summary.storage.kvWrite.meanOfMeanMs != null &&
      summary.storage.kvRead.meanOfMeanMs != null &&
      summary.storage.d1Read.meanOfMeanMs != null &&
      summary.storage.d1Write.meanOfMeanMs != null,
    requireStorageErrorRateLe1: summary.storage.errorRatePct <= 1,
    requireWsErrorRateLe01: summary.errors.wsErrorRatePct <= 0.1,
    requireBandwidthMeasured: summary.bandwidth.bytesPerSec > 0 && summary.bandwidth.bytesPerTick > 0
  };

  const dod6Rules = {
    requireSustained5000: summary.throughput.ticksPerSec >= 5000,
    requireP95BucketGe4500: (summary.trends.tickRatePerSec.p95 ?? 0) >= 4500,
    requireNoCriticalErrors: summary.errors.wsErrorRatePct <= 0.1 && summary.storage.errorRatePct <= 1,
    requireMemorySlopeStable: Math.abs(summary.memory.rssSlopeBytesPerSec ?? 0) <= 2 * 1024 * 1024
  };

  const dod5Pass = Object.values(dod5Rules).every(Boolean);
  const dod6Pass = Object.values(dod6Rules).every(Boolean);

  return {
    DoD5: {
      name: '性能报告（含 D1/KV 指标）',
      pass: dod5Pass,
      rules: dod5Rules,
      recommendation: dod5Pass ? 'PASS（证据完整且误差/错误率在阈值内）' : 'FAIL（需补齐缺失项或降低错误率）'
    },
    DoD6: {
      name: '高压稳定性（5000 Tick/s）',
      pass: dod6Pass,
      rules: dod6Rules,
      recommendation: dod6Pass ? 'PASS（达到并稳定维持 5000 tick/s 级别）' : 'FAIL（吞吐或稳定性未达到严格阈值）'
    }
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const metrics = {
    startedAt: Date.now(),
    clientsConnected: 0,
    openFailed: 0,
    wsErrors: 0,
    controlFrames: 0,
    totalFrames: 0,
    totalTicks: 0,
    totalRawBytes: 0,
    decodeFailedFrames: 0,
    bundleFrames: 0,
    quoteFrames: 0,
    decodeMs: [],
    tickBuckets: new Map(),
    sampleClientArrivalGapMs: [],
    storageSamples: [],
    memorySamples: []
  };

  const sockets = [];
  const sampleClientIdx = new Set([0, 1, 2, 3, 4]);
  const lastArrivalBySample = new Map();

  async function openOne(clientIndex) {
    return await new Promise((resolve) => {
      let ws;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        metrics.openFailed += 1;
        resolve(null);
        return;
      }

      ws.binaryType = 'arraybuffer';

      const timeout = setTimeout(() => {
        metrics.openFailed += 1;
        try {
          ws.close();
        } catch {}
        resolve(null);
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        metrics.clientsConnected += 1;
        ws.send(JSON.stringify({
          type: 'subscribe',
          symbols: SYMBOLS,
          transport: 'bundle',
          compression: 'gzip'
        }));
        resolve(ws);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        metrics.wsErrors += 1;
      };

      ws.onmessage = async (event) => {
        const decoded = await decodeFrame(event.data);

        if (decoded.kind === 'control') {
          metrics.controlFrames += 1;
          if (decoded.parsed?.type === 'ping') {
            try {
              ws.send('pong');
            } catch {}
          }
          return;
        }

        metrics.totalFrames += 1;
        metrics.totalRawBytes += decoded.rawBytes;
        metrics.totalTicks += decoded.tickCount;
        metrics.decodeMs.push(decoded.decodeMs);

        if (decoded.kind === 'bundle') metrics.bundleFrames += 1;
        else if (decoded.kind === 'quote') metrics.quoteFrames += 1;
        else if (decoded.kind === 'decode_failed') metrics.decodeFailedFrames += 1;

        const sec = Math.floor((Date.now() - metrics.startedAt) / 1000);
        metrics.tickBuckets.set(sec, (metrics.tickBuckets.get(sec) ?? 0) + decoded.tickCount);

        if (sampleClientIdx.has(clientIndex)) {
          const now = Date.now();
          const last = lastArrivalBySample.get(clientIndex);
          if (typeof last === 'number') {
            metrics.sampleClientArrivalGapMs.push(now - last);
          }
          lastArrivalBySample.set(clientIndex, now);
        }
      };
    });
  }

  for (let offset = 0; offset < CONCURRENCY; offset += CONNECT_BATCH_SIZE) {
    const jobs = [];
    for (let i = offset; i < Math.min(CONCURRENCY, offset + CONNECT_BATCH_SIZE); i += 1) {
      jobs.push(openOne(i));
    }
    const opened = await Promise.all(jobs);
    for (const ws of opened) if (ws) sockets.push(ws);
    if (offset + CONNECT_BATCH_SIZE < CONCURRENCY) await sleep(CONNECT_BATCH_GAP_MS);
  }

  const memoryTimer = setInterval(() => {
    const m = process.memoryUsage();
    metrics.memorySamples.push({
      ts: Date.now(),
      rssBytes: m.rss,
      heapUsedBytes: m.heapUsed,
      heapTotalBytes: m.heapTotal,
      externalBytes: m.external
    });
  }, 1000);

  let stopStorage = false;
  const storageLoop = (async () => {
    while (!stopStorage) {
      metrics.storageSamples.push(await postStorageBench());
      await sleep(STORAGE_INTERVAL_MS);
    }
  })();

  await sleep(DURATION_MS);

  stopStorage = true;
  await storageLoop;
  clearInterval(memoryTimer);

  for (const ws of sockets) {
    try {
      ws.close(1000, 'done');
    } catch {}
  }
  await sleep(400);

  const durationSec = DURATION_MS / 1000;
  const decodeSorted = [...metrics.decodeMs].sort((a, b) => a - b);
  const storage = aggregateStorage(metrics.storageSamples);

  const memoryPeakRss = metrics.memorySamples.length
    ? Math.max(...metrics.memorySamples.map((m) => m.rssBytes))
    : null;
  const memoryPeakHeap = metrics.memorySamples.length
    ? Math.max(...metrics.memorySamples.map((m) => m.heapUsedBytes))
    : null;

  const rssSlope = linearSlope(metrics.memorySamples, 'ts', 'rssBytes');
  const heapSlope = linearSlope(metrics.memorySamples, 'ts', 'heapUsedBytes');

  const tickTrend = buildTrendSeries(metrics.startedAt, metrics.tickBuckets);
  const steadyRows = tickTrend.rows.filter((row) => row.sec >= 3 && row.sec <= Math.max(3, Math.floor(durationSec) - 3));
  const steadyTicks = steadyRows.map((row) => row.ticks);
  const steadyTickRate = {
    windowSec: steadyRows.length,
    avg: mean(steadyTicks),
    p95: percentile(steadyTicks, 95),
    min: steadyTicks.length ? Math.min(...steadyTicks) : null,
    max: steadyTicks.length ? Math.max(...steadyTicks) : null
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    config: {
      wsUrl: WS_URL,
      storageUrl: STORAGE_URL,
      symbols: SYMBOLS,
      concurrencyTarget: CONCURRENCY,
      durationMs: DURATION_MS,
      connectBatchSize: CONNECT_BATCH_SIZE,
      connectBatchGapMs: CONNECT_BATCH_GAP_MS,
      storageIterations: STORAGE_ITERATIONS,
      storageValueSize: STORAGE_VALUE_SIZE
    },
    connections: {
      target: CONCURRENCY,
      connected: metrics.clientsConnected,
      openFailed: metrics.openFailed,
      connectSuccessRatePct: CONCURRENCY ? (metrics.clientsConnected / CONCURRENCY) * 100 : 0
    },
    throughput: {
      totalTicks: metrics.totalTicks,
      totalFrames: metrics.totalFrames,
      ticksPerSec: metrics.totalTicks / durationSec,
      framesPerSec: metrics.totalFrames / durationSec,
      bundleFrames: metrics.bundleFrames,
      quoteFrames: metrics.quoteFrames
    },
    bandwidth: {
      totalRawBytes: metrics.totalRawBytes,
      bytesPerSec: metrics.totalRawBytes / durationSec,
      bytesPerTick: metrics.totalTicks ? metrics.totalRawBytes / metrics.totalTicks : null
    },
    decode: {
      avgMs: mean(metrics.decodeMs),
      p95Ms: decodeSorted.length ? decodeSorted[Math.ceil(decodeSorted.length * 0.95) - 1] : null,
      decodeFailedFrames: metrics.decodeFailedFrames
    },
    storage,
    errors: {
      wsErrors: metrics.wsErrors,
      decodeFailedFrames: metrics.decodeFailedFrames,
      wsErrorRatePct: metrics.totalFrames
        ? ((metrics.wsErrors + metrics.decodeFailedFrames) / metrics.totalFrames) * 100
        : 0
    },
    memory: {
      sampleCount: metrics.memorySamples.length,
      peakRssBytes: memoryPeakRss,
      peakHeapUsedBytes: memoryPeakHeap,
      rssSlopeBytesPerSec: rssSlope != null ? rssSlope * 1000 : null,
      heapSlopeBytesPerSec: heapSlope != null ? heapSlope * 1000 : null
    },
    jitter: {
      sampleCount: metrics.sampleClientArrivalGapMs.length,
      interArrivalGapAvgMs: mean(metrics.sampleClientArrivalGapMs),
      interArrivalGapP95Ms: percentile(metrics.sampleClientArrivalGapMs, 95),
      interArrivalGapP99Ms: percentile(metrics.sampleClientArrivalGapMs, 99)
    },
    trends: {
      tickRatePerSec: tickTrend,
      steadyTickRate,
      memorySamples: metrics.memorySamples
    }
  };

  const dod = evaluateDod(summary);

  const raw = {
    summary,
    dod,
    storageSamples: metrics.storageSamples
  };

  const outPath = path.join(OUT_DIR, 'r3-5000ticks-stability.json');
  await fs.writeFile(outPath, JSON.stringify(raw, null, 2));

  console.log(JSON.stringify({ ok: true, outPath, throughput: summary.throughput, dod }, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
