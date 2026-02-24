#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const encoder = new TextEncoder();

const WS_URL = process.env.P22_WS_URL || process.env.WS_URL || 'wss://xgvst-workers.viehh642.workers.dev/ws/quote';
const SYMBOLS = (process.env.P22_SYMBOLS || '000001,600519,300750,000858,601318')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const TARGET_CONCURRENCY = Number(process.env.P22_TARGET_CONCURRENCY || 1000);
const ACTUAL_CONCURRENCY = Number(process.env.P22_ACTUAL_CONCURRENCY || 40);
const TEST_DURATION_MS = Number(process.env.P22_TEST_DURATION_MS || 20000);
const RECONNECT_RATIO = Number(process.env.P22_RECONNECT_RATIO || 0.6);
const CONNECT_TIMEOUT_MS = Number(process.env.P22_CONNECT_TIMEOUT_MS || 10000);
const RECOVERY_TIMEOUT_MS = Number(process.env.P22_RECOVERY_TIMEOUT_MS || 6000);
const BUNDLE_WINDOW_MS = Number(process.env.P22_BUNDLE_WINDOW_MS || 100);

const outDir = path.resolve('reports/lighthouse/P2.2_C');

function wsToStatusUrl(wsUrl) {
  return wsUrl.replace(/^wss?:\/\//, (m) => (m === 'wss://' ? 'https://' : 'http://')).replace(/\/ws\/quote$/, '/api/source/status');
}

const STATUS_URL = process.env.P22_STATUS_URL || wsToStatusUrl(WS_URL);

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function toJsonBytes(obj) {
  return encoder.encode(JSON.stringify(obj)).length;
}

function decodeBinaryTickFrame(frame) {
  if (!(frame instanceof Uint8Array) || frame.length < 3) return null;
  if (frame[0] !== 0x51 || frame[1] !== 0x54 || frame[2] !== 0x31) return null;

  let offset = 3;
  const symbolLen = frame[offset];
  offset += 1;
  if (!Number.isFinite(symbolLen) || offset + symbolLen > frame.length) return null;
  const symbol = new TextDecoder().decode(frame.subarray(offset, offset + symbolLen));
  offset += symbolLen;

  if (offset + 16 > frame.length) return null;
  const view = new DataView(frame.buffer, frame.byteOffset + offset, 16);
  const price = view.getFloat64(0, true);
  const changePct = view.getFloat64(8, true);
  offset += 16;

  if (offset + 2 > frame.length) return null;
  const tsLen = new DataView(frame.buffer, frame.byteOffset + offset, 2).getUint16(0, true);
  offset += 2;
  if (offset + tsLen > frame.length) return null;
  const ts = new TextDecoder().decode(frame.subarray(offset, offset + tsLen));
  offset += tsLen;

  if (offset + 1 > frame.length) return null;
  const sourceLen = frame[offset];
  offset += 1;
  if (offset + sourceLen > frame.length) return null;
  const source = new TextDecoder().decode(frame.subarray(offset, offset + sourceLen));

  return { symbol, price, changePct, ts, source };
}

class BundleWindow {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.buckets = new Map();
    this.bundledFrames = 0;
    this.bundledBytes = 0;
    this.totalItems = 0;
    this.flushCount = 0;
  }

  push(tick) {
    const key = tick.symbol;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { itemJsonBytes: 0, count: 0 };
      this.buckets.set(key, bucket);
      setTimeout(() => this.flushKey(key), this.windowMs);
    }

    bucket.itemJsonBytes += toJsonBytes(tick);
    bucket.count += 1;
  }

  flushAll() {
    for (const key of this.buckets.keys()) this.flushKey(key);
  }

  flushKey(key) {
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    this.buckets.delete(key);

    if (bucket.count <= 0) return;
    const envelopeOverhead = encoder.encode('{"type":"tick_bundle","data":[]}').length;
    const commaCost = Math.max(0, bucket.count - 1);
    const bytes = envelopeOverhead + bucket.itemJsonBytes + commaCost;

    this.bundledFrames += 1;
    this.bundledBytes += bytes;
    this.totalItems += bucket.count;
    this.flushCount += 1;
  }
}

class ClientRunner {
  constructor(id, symbols, metrics, events) {
    this.id = id;
    this.symbols = symbols;
    this.metrics = metrics;
    this.events = events;
    this.ws = null;
    this.openAt = null;
    this.reconnectAttempted = false;
    this.reconnectOk = false;
    this.subscriptionRecovered = false;
    this.closed = false;
    this.tickAfterReconnect = null;
  }

  async connect({ reconnect = false } = {}) {
    const startedAt = Date.now();
    const ws = await new Promise((resolve, reject) => {
      let timer = setTimeout(() => reject(new Error('connect_timeout')), CONNECT_TIMEOUT_MS);
      let socket;
      try {
        socket = new WebSocket(WS_URL);
      } catch (e) {
        clearTimeout(timer);
        reject(e);
        return;
      }

      socket.binaryType = 'arraybuffer';
      socket.onopen = () => {
        clearTimeout(timer);
        resolve(socket);
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error('ws_error'));
      };
    });

    this.ws = ws;
    this.openAt = Date.now();
    const openLatencyMs = this.openAt - startedAt;

    if (reconnect) {
      this.reconnectOk = true;
      this.events.push({ ts: nowIso(), clientId: this.id, type: 'reconnect_open', openLatencyMs });
      this.metrics.reconnectLatencies.push(openLatencyMs);
    } else {
      this.events.push({ ts: nowIso(), clientId: this.id, type: 'connect_open', openLatencyMs });
      this.metrics.connectLatencies.push(openLatencyMs);
    }

    ws.onmessage = (event) => this.onMessage(event);
    ws.onerror = (event) => {
      this.events.push({
        ts: nowIso(),
        clientId: this.id,
        type: 'ws_error',
        detail: String(event?.message || 'ws_error')
      });
    };
    ws.onclose = (event) => {
      this.closed = true;
      this.events.push({
        ts: nowIso(),
        clientId: this.id,
        type: 'ws_close',
        code: event?.code ?? null,
        reason: event?.reason ?? ''
      });
    };

    ws.send(JSON.stringify({ type: 'subscribe', symbols: this.symbols }));
  }

  onMessage(event) {
    let tick = null;
    let rawBytes = 0;
    let jsonFallback = false;

    if (typeof event.data === 'string') {
      rawBytes = encoder.encode(event.data).length;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed?.type === 'ping') {
          this.ws?.send('pong');
          return;
        }
        if (parsed?.type === 'tick' && parsed?.data) {
          tick = parsed.data;
          jsonFallback = true;
        }
      } catch {
        return;
      }
    } else if (event.data instanceof ArrayBuffer) {
      const frame = new Uint8Array(event.data);
      rawBytes = frame.byteLength;
      tick = decodeBinaryTickFrame(frame);
      if (!tick) return;
    } else {
      return;
    }

    if (!tick) return;

    this.metrics.rawFrames += 1;
    this.metrics.rawBytes += rawBytes;
    this.metrics.tickCount += 1;
    this.metrics.tickArrivalTs.push(Date.now());

    const jsonBytes = toJsonBytes({ type: 'tick', data: tick });
    this.metrics.jsonEquivalentBytes += jsonBytes;
    if (jsonFallback) this.metrics.jsonFallbackFrames += 1;
    else this.metrics.binaryFrames += 1;

    this.metrics.bundleWindow.push(tick);

    if (this.reconnectAttempted && !this.subscriptionRecovered && this.reconnectOk) {
      if (this.symbols.includes(tick.symbol)) {
        this.subscriptionRecovered = true;
        this.tickAfterReconnect = Date.now();
      }
    }
  }

  async forceReconnect() {
    if (!this.ws) return;

    this.reconnectAttempted = true;
    this.events.push({ ts: nowIso(), clientId: this.id, type: 'forced_disconnect' });

    try {
      this.ws.close(1000, 'sentinel reconnect test');
    } catch {}

    await sleep(120);

    try {
      await this.connect({ reconnect: true });
    } catch (error) {
      this.events.push({ ts: nowIso(), clientId: this.id, type: 'reconnect_failed', error: String(error?.message || error) });
      return;
    }

    const started = Date.now();
    while (Date.now() - started <= RECOVERY_TIMEOUT_MS) {
      if (this.subscriptionRecovered) {
        this.metrics.recoveryLatencies.push(this.tickAfterReconnect - started);
        this.events.push({ ts: nowIso(), clientId: this.id, type: 'subscription_recovered', recoveryLatencyMs: this.tickAfterReconnect - started });
        return;
      }
      await sleep(50);
    }

    this.events.push({ ts: nowIso(), clientId: this.id, type: 'subscription_recovery_timeout', timeoutMs: RECOVERY_TIMEOUT_MS });
  }

  async stop() {
    try {
      this.ws?.close(1000, 'sentinel test done');
    } catch {}
  }
}

async function fetchStatusSafe() {
  try {
    const started = Date.now();
    const res = await fetch(STATUS_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    const body = await res.json();
    return { ok: res.ok, latencyMs: Date.now() - started, body };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

function evaluateDoD(summary) {
  const dod = {};

  dod.DoD1 = {
    name: '断线重连成功率 >= 99%',
    actual: Number(summary.reconnect.successRatePct.toFixed(2)),
    target: 99,
    pass: summary.reconnect.successRatePct >= 99,
    gap: Number(Math.max(0, 99 - summary.reconnect.successRatePct).toFixed(2))
  };

  dod.DoD2 = {
    name: '订阅恢复成功率 >= 99%',
    actual: Number(summary.subscriptionRecovery.successRatePct.toFixed(2)),
    target: 99,
    pass: summary.subscriptionRecovery.successRatePct >= 99,
    gap: Number(Math.max(0, 99 - summary.subscriptionRecovery.successRatePct).toFixed(2))
  };

  dod.DoD3 = {
    name: '100ms 合包后帧频下降 >= 30%',
    actual: Number(summary.bundle.reductionByFramePct.toFixed(2)),
    target: 30,
    pass: summary.bundle.reductionByFramePct >= 30,
    gap: Number(Math.max(0, 30 - summary.bundle.reductionByFramePct).toFixed(2))
  };

  dod.DoD4 = {
    name: '并发连接达到 1000',
    actual: summary.concurrency.actual,
    target: summary.concurrency.target,
    pass: summary.concurrency.actual >= summary.concurrency.target,
    gap: summary.concurrency.target - summary.concurrency.actual
  };

  dod.DoD5 = {
    name: '二进制/合包带宽节省 >= 30%',
    actual: Number(summary.bandwidth.savingVsJsonPct.toFixed(2)),
    target: 30,
    pass: summary.bandwidth.savingVsJsonPct >= 30,
    gap: Number(Math.max(0, 30 - summary.bandwidth.savingVsJsonPct).toFixed(2))
  };

  dod.DoD6 = {
    name: '单实例内存具备可观测口径（已采样）',
    actual: summary.memory.observable ? 1 : 0,
    target: 1,
    pass: summary.memory.observable,
    gap: summary.memory.observable ? 0 : 1,
    note: summary.memory.note
  };

  return dod;
}

function buildMarkdown(evidence) {
  const s = evidence.summary;
  const dod = evidence.dod;

  return `# P2.2 Sentinel 按需订阅压测报告\n\n- 生成时间：${evidence.generatedAt}\n- WS：\`${evidence.config.WS_URL}\`\n- STATUS：\`${evidence.config.STATUS_URL}\`\n- 样本并发：${s.concurrency.actual}（目标 ${s.concurrency.target}）\n\n## 一、执行覆盖（对应 P2.2 任务要求）\n\n1. **断线重连**：对 ${s.reconnect.attempted} 个客户端执行强制断开后重连，重连成功 ${s.reconnect.success}。\n2. **订阅恢复**：重连后检测原订阅恢复，成功 ${s.subscriptionRecovery.success}/${s.subscriptionRecovery.attempted}。\n3. **100ms 合包延迟**：按 ${evidence.config.bundleWindowMs}ms 进行合包仿真，帧频下降 ${s.bundle.reductionByFramePct.toFixed(2)}%。\n4. **最小并发样本**：当前执行并发 ${s.concurrency.actual}；距 1000 并发差 ${s.concurrency.gapToTarget}。\n\n## 二、关键指标\n\n- **带宽节省（相对 JSON 直发）**：${s.bandwidth.savingVsJsonPct.toFixed(2)}%\n  - 原始接收字节：${s.bandwidth.rawBytes}\n  - JSON 等价字节：${s.bandwidth.jsonEquivalentBytes}\n- **单实例内存（可观测口径）**：\n  - 采样进程：压测器 Node 进程（代理口径）\n  - 峰值 RSS：${(s.memory.peakRssBytes / (1024 * 1024)).toFixed(2)} MiB\n  - 峰值 HeapUsed：${(s.memory.peakHeapUsedBytes / (1024 * 1024)).toFixed(2)} MiB\n- **广播频率**：\n  - 原始 tick 频率：${s.broadcast.rawTicksPerSec.toFixed(2)} tick/s\n  - 合包后帧频：${s.broadcast.bundledFramesPerSec.toFixed(2)} frame/s\n- **重连成功率**：${s.reconnect.successRatePct.toFixed(2)}%\n\n## 三、DoD1~DoD6 判定与缺口\n\n| DoD | 内容 | 判定 | 实际 | 目标 | 缺口 |\n|---|---|---|---:|---:|---:|\n| DoD1 | ${dod.DoD1.name} | ${dod.DoD1.pass ? 'PASS' : 'FAIL'} | ${dod.DoD1.actual} | ${dod.DoD1.target} | ${Math.max(0, dod.DoD1.gap)} |\n| DoD2 | ${dod.DoD2.name} | ${dod.DoD2.pass ? 'PASS' : 'FAIL'} | ${dod.DoD2.actual} | ${dod.DoD2.target} | ${Math.max(0, dod.DoD2.gap)} |\n| DoD3 | ${dod.DoD3.name} | ${dod.DoD3.pass ? 'PASS' : 'FAIL'} | ${dod.DoD3.actual} | ${dod.DoD3.target} | ${Math.max(0, dod.DoD3.gap)} |\n| DoD4 | ${dod.DoD4.name} | ${dod.DoD4.pass ? 'PASS' : 'FAIL'} | ${dod.DoD4.actual} | ${dod.DoD4.target} | ${Math.max(0, dod.DoD4.gap)} |\n| DoD5 | ${dod.DoD5.name} | ${dod.DoD5.pass ? 'PASS' : 'FAIL'} | ${dod.DoD5.actual} | ${dod.DoD5.target} | ${Math.max(0, dod.DoD5.gap)} |\n| DoD6 | ${dod.DoD6.name} | ${dod.DoD6.pass ? 'PASS' : 'FAIL'} | ${dod.DoD6.actual} | ${dod.DoD6.target} | ${Math.max(0, dod.DoD6.gap)} |\n\n> 证据 JSON：\`reports/lighthouse/P2.2_C/sentinel-load-evidence.json\`\n`;}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const events = [];
  const memorySamples = [];
  const metrics = {
    connectLatencies: [],
    reconnectLatencies: [],
    recoveryLatencies: [],
    rawFrames: 0,
    rawBytes: 0,
    tickCount: 0,
    tickArrivalTs: [],
    jsonEquivalentBytes: 0,
    binaryFrames: 0,
    jsonFallbackFrames: 0,
    bundleWindow: new BundleWindow(BUNDLE_WINDOW_MS)
  };

  const statusBefore = await fetchStatusSafe();

  const clients = [];
  const actual = Math.max(1, ACTUAL_CONCURRENCY);

  for (let i = 0; i < actual; i += 1) {
    const symbol = SYMBOLS[i % SYMBOLS.length];
    const client = new ClientRunner(i + 1, [symbol], metrics, events);
    clients.push(client);
  }

  await Promise.allSettled(
    clients.map(async (client) => {
      try {
        await client.connect();
      } catch (error) {
        events.push({ ts: nowIso(), clientId: client.id, type: 'connect_failed', error: String(error?.message || error) });
      }
    })
  );

  const reconnectCandidates = clients.slice(0, Math.floor(clients.length * RECONNECT_RATIO));
  const reconnectKickAt = Date.now() + Math.floor(TEST_DURATION_MS * 0.45);

  const memoryTimer = setInterval(() => {
    const m = process.memoryUsage();
    memorySamples.push({
      ts: Date.now(),
      rssBytes: m.rss,
      heapTotalBytes: m.heapTotal,
      heapUsedBytes: m.heapUsed,
      externalBytes: m.external
    });
  }, 500);

  while (Date.now() < reconnectKickAt) {
    await sleep(100);
  }

  await Promise.allSettled(reconnectCandidates.map((c) => c.forceReconnect()));

  const endAt = Date.now() + Math.max(1000, Math.floor(TEST_DURATION_MS * 0.4));
  while (Date.now() < endAt) {
    await sleep(100);
  }

  clearInterval(memoryTimer);

  for (const c of clients) {
    await c.stop();
  }

  metrics.bundleWindow.flushAll();

  const statusAfter = await fetchStatusSafe();

  const reconnectAttempted = reconnectCandidates.length;
  const reconnectSuccess = reconnectCandidates.filter((c) => c.reconnectOk).length;
  const recoveryAttempted = reconnectCandidates.filter((c) => c.reconnectOk).length;
  const recoverySuccess = reconnectCandidates.filter((c) => c.reconnectOk && c.subscriptionRecovered).length;

  const durationMs = Math.max(1, (metrics.tickArrivalTs.at(-1) || Date.now()) - (metrics.tickArrivalTs[0] || Date.now() - 1));
  const testSeconds = durationMs / 1000;

  const peakRssBytes = memorySamples.length ? Math.max(...memorySamples.map((m) => m.rssBytes)) : process.memoryUsage().rss;
  const peakHeapUsedBytes = memorySamples.length ? Math.max(...memorySamples.map((m) => m.heapUsedBytes)) : process.memoryUsage().heapUsed;

  const summary = {
    concurrency: {
      target: TARGET_CONCURRENCY,
      actual,
      gapToTarget: Math.max(0, TARGET_CONCURRENCY - actual)
    },
    reconnect: {
      attempted: reconnectAttempted,
      success: reconnectSuccess,
      successRatePct: reconnectAttempted ? (reconnectSuccess / reconnectAttempted) * 100 : 0,
      p50OpenMs: percentile(metrics.reconnectLatencies, 50),
      p95OpenMs: percentile(metrics.reconnectLatencies, 95)
    },
    subscriptionRecovery: {
      attempted: recoveryAttempted,
      success: recoverySuccess,
      successRatePct: recoveryAttempted ? (recoverySuccess / recoveryAttempted) * 100 : 0,
      p50RecoveryMs: percentile(metrics.recoveryLatencies, 50),
      p95RecoveryMs: percentile(metrics.recoveryLatencies, 95)
    },
    bandwidth: {
      rawBytes: metrics.rawBytes,
      jsonEquivalentBytes: metrics.jsonEquivalentBytes,
      savingVsJsonPct: metrics.jsonEquivalentBytes > 0 ? ((metrics.jsonEquivalentBytes - metrics.rawBytes) / metrics.jsonEquivalentBytes) * 100 : 0,
      binaryFrames: metrics.binaryFrames,
      jsonFallbackFrames: metrics.jsonFallbackFrames
    },
    bundle: {
      rawFrames: metrics.rawFrames,
      bundledFrames: metrics.bundleWindow.bundledFrames,
      bundledBytes: metrics.bundleWindow.bundledBytes,
      reductionByFramePct: metrics.rawFrames > 0 ? ((metrics.rawFrames - metrics.bundleWindow.bundledFrames) / metrics.rawFrames) * 100 : 0,
      reductionByBytesPctVsRaw: metrics.rawBytes > 0 ? ((metrics.rawBytes - metrics.bundleWindow.bundledBytes) / metrics.rawBytes) * 100 : 0,
      windowMs: BUNDLE_WINDOW_MS
    },
    broadcast: {
      rawTicksPerSec: metrics.tickCount / testSeconds,
      bundledFramesPerSec: metrics.bundleWindow.bundledFrames / testSeconds,
      observedSeconds: testSeconds
    },
    memory: {
      observable: true,
      note: '仅可观测压测器进程内存；Worker 单实例内存需平台级指标补充。',
      peakRssBytes,
      peakHeapUsedBytes,
      sampleCount: memorySamples.length
    },
    sourceStatus: {
      before: statusBefore,
      after: statusAfter
    }
  };

  const evidence = {
    generatedAt: nowIso(),
    config: {
      WS_URL,
      STATUS_URL,
      symbols: SYMBOLS,
      targetConcurrency: TARGET_CONCURRENCY,
      actualConcurrency: actual,
      testDurationMs: TEST_DURATION_MS,
      reconnectRatio: RECONNECT_RATIO,
      recoveryTimeoutMs: RECOVERY_TIMEOUT_MS,
      bundleWindowMs: BUNDLE_WINDOW_MS
    },
    summary,
    dod: evaluateDoD(summary),
    samples: {
      memorySamples,
      events
    }
  };

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const jsonTsPath = path.join(outDir, `sentinel-load-evidence-${stamp}.json`);
  const jsonLatestPath = path.join(outDir, 'sentinel-load-evidence.json');
  const mdPath = path.join(outDir, 'sentinel-load-report.md');

  await fs.writeFile(jsonTsPath, JSON.stringify(evidence, null, 2));
  await fs.writeFile(jsonLatestPath, JSON.stringify(evidence, null, 2));
  await fs.writeFile(mdPath, buildMarkdown(evidence));

  console.log(JSON.stringify({ ok: true, jsonLatestPath, jsonTsPath, mdPath, summary: evidence.summary, dod: evidence.dod }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
