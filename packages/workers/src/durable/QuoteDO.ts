import { encodeQuoteBundleDelta } from '../proto/quoteBundleDelta';
import { protobufCodec } from '../proto/codec';
import { SourceManager } from '../sources/SourceManager';
import type { QuoteTick } from '../sources/QuoteSource';
import { StorageTelemetry } from '../observability/storageTelemetry';

type TransportMode = 'legacy' | 'bundle';
type CompressionMode = 'none' | 'gzip' | 'deflate';

type LastSentTick = {
  sourceId: number;
  priceMilli: number;
  changeBp: number;
  tsMs: number;
  sentAtMs: number;
};

type ClientState = {
  symbols: Set<string>;
  lastPongAt: number;
  transport: TransportMode;
  compression: CompressionMode;
  subscriptionSignature: string;
  dictVersion: number;
  symbolIdMap: Map<string, number>;
  lastSentBySymbolId: Map<number, LastSentTick>;
};

type QuoteDOStats = {
  clients: number;
  subscriptions: number;
  pendingSymbols: number;
  flushCount: number;
  sentBinaryFrames: number;
  sentProtobufFrames: number;
  sentBundleFrames: number;
  sentCompressedFrames: number;
  sentFallbackFrames: number;
  sentBytes: number;
  droppedFrames: number;
  lastFlushAt: string | null;
};

type QuoteTickSnapshot = {
  symbol: string;
  price: number;
  changePct: number;
  ts: string;
  source: string;
};

type SnapshotPlan = {
  targetSymbols: string[];
  immediateData: QuoteTickSnapshot[];
  memoryRemainder: QuoteTickSnapshot[];
  missingSymbols: string[];
};

const DEFAULT_HEARTBEAT_SWEEP_MS = 30_000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 60_000;
const DEFAULT_BATCH_FLUSH_MS = 100;
const DEFAULT_SNAPSHOT_BATCH_SYMBOLS = 24;
const DEFAULT_SNAPSHOT_IMMEDIATE_SYMBOLS = 8;
const DEFAULT_SNAPSHOT_BACKPRESSURE_BYTES = 512 * 1024;
const DEFAULT_SNAPSHOT_BACKPRESSURE_YIELD_MS = 8;
// 提升 bundle delta 阈值，减少对前端几乎无感的抖动帧
const DEFAULT_PRICE_DELTA_MILLI = 15;
const DEFAULT_CHANGE_DELTA_BP = 8;
// 拉长强制快照周期，减少“保活式”重复样本
const DEFAULT_FORCE_SNAPSHOT_MS = 10_000;

const BUNDLE_MAGIC_0 = 0x51; // Q
const BUNDLE_MAGIC_1 = 0x42; // B
const BUNDLE_MAGIC_2 = 0x32; // 2
const CODEC_NONE = 0;
const CODEC_GZIP = 1;
const CODEC_DEFLATE = 2;

const textEncoder = new TextEncoder();
const BUNDLE_SOURCES = ['alltick', 'sina', 'eastmoney', 'tencent'];
const storageTelemetry = new StorageTelemetry('quote-do');
const BUNDLE_SOURCE_ID = new Map(BUNDLE_SOURCES.map((name, index) => [name, index]));
const KV_SNAPSHOT_PREFIX = 'quote:';
const KV_SNAPSHOT_TTL_SECONDS = 300;

function isQuoteTickSnapshot(value: unknown): value is QuoteTickSnapshot {
  if (typeof value !== 'object' || value === null) return false;

  const tick = value as Partial<QuoteTickSnapshot>;
  return (
    typeof tick.symbol === 'string' &&
    typeof tick.ts === 'string' &&
    typeof tick.source === 'string' &&
    typeof tick.price === 'number' &&
    Number.isFinite(tick.price) &&
    typeof tick.changePct === 'number' &&
    Number.isFinite(tick.changePct)
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const cloned = bytes.slice();
  return cloned.buffer;
}

function normalizeTransport(value: unknown): TransportMode {
  if (value === 'bundle') return 'bundle';
  return 'legacy';
}

function normalizeCompression(value: unknown): CompressionMode {
  if (value === 'none') return 'none';
  if (value === 'deflate') return 'deflate';
  if (value === 'gzip') return 'gzip';
  // DoD5 默认保持 deflate；none 仅做显式回退开关
  return 'deflate';
}

function parseEnvInt(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.round(parsed);
  return Math.max(min, Math.min(max, normalized));
}

function normalizeSymbolSet(symbols: Set<string>): string {
  return [...symbols].sort().join(',');
}

function toFrameArrayBuffer(buffer: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (buffer instanceof Uint8Array) return toArrayBuffer(buffer);
  return buffer;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildBundleEnvelope(codec: number, payload: Uint8Array | ArrayBuffer): ArrayBuffer {
  const payloadBytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const frame = new Uint8Array(4 + payloadBytes.byteLength);
  frame[0] = BUNDLE_MAGIC_0;
  frame[1] = BUNDLE_MAGIC_1;
  frame[2] = BUNDLE_MAGIC_2;
  frame[3] = codec;
  frame.set(payloadBytes, 4);
  return frame.buffer;
}

async function compressBytes(bytes: Uint8Array, mode: 'gzip' | 'deflate'): Promise<ArrayBuffer> {
  const payload = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(payload).set(bytes);
  const stream = new Blob([payload]).stream().pipeThrough(new CompressionStream(mode));
  return await new Response(stream).arrayBuffer();
}

// QT1: 调试兜底帧（DoD3 后不再作为主路径）
function encodeQt1DebugFrame(tick: QuoteTick): Uint8Array | null {
  const symbolBytes = textEncoder.encode(tick.symbol);
  const tsBytes = textEncoder.encode(tick.ts);
  const sourceBytes = textEncoder.encode(tick.source);

  if (symbolBytes.length > 255 || sourceBytes.length > 255 || tsBytes.length > 0xffff) {
    return null;
  }

  const totalLength = 3 + 1 + symbolBytes.length + 16 + 2 + tsBytes.length + 1 + sourceBytes.length;
  const frame = new Uint8Array(totalLength);

  frame[0] = 0x51; // Q
  frame[1] = 0x54; // T
  frame[2] = 0x31; // 1

  let offset = 3;
  frame[offset] = symbolBytes.length;
  offset += 1;
  frame.set(symbolBytes, offset);
  offset += symbolBytes.length;

  const valueView = new DataView(frame.buffer, frame.byteOffset + offset, 16);
  valueView.setFloat64(0, tick.price, true);
  valueView.setFloat64(8, tick.changePct, true);
  offset += 16;

  new DataView(frame.buffer, frame.byteOffset + offset, 2).setUint16(0, tsBytes.length, true);
  offset += 2;
  frame.set(tsBytes, offset);
  offset += tsBytes.length;

  frame[offset] = sourceBytes.length;
  offset += 1;
  frame.set(sourceBytes, offset);

  return frame;
}

export class QuoteDurableObject implements DurableObject {
  private readonly clients = new Map<WebSocket, ClientState>();
  private readonly symbolSubscribers = new Map<string, Set<WebSocket>>();
  private readonly pendingBySymbol = new Map<string, QuoteTick>();
  private readonly latestTickBySymbol = new Map<string, QuoteTick>();
  private readonly sourceManager = new SourceManager();

  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private flushInFlight = false;
  private started = false;

  private readonly heartbeatSweepMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly batchFlushMs: number;
  private readonly snapshotBatchSymbols: number;
  private readonly snapshotImmediateSymbols: number;
  private readonly snapshotBackpressureBytes: number;
  private readonly snapshotBackpressureYieldMs: number;
  private readonly priceDeltaMilli: number;
  private readonly changeDeltaBp: number;
  private readonly forceSnapshotMs: number;
  private readonly snapshotTtlSeconds: number;

  private readonly stats: QuoteDOStats = {
    clients: 0,
    subscriptions: 0,
    pendingSymbols: 0,
    flushCount: 0,
    sentBinaryFrames: 0,
    sentProtobufFrames: 0,
    sentBundleFrames: 0,
    sentCompressedFrames: 0,
    sentFallbackFrames: 0,
    sentBytes: 0,
    droppedFrames: 0,
    lastFlushAt: null
  };

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));

    const runtimeEnv = this.env as unknown as {
      QUOTE_DO_HEARTBEAT_SWEEP_MS?: string;
      QUOTE_DO_HEARTBEAT_TIMEOUT_MS?: string;
      QUOTE_DO_BATCH_FLUSH_MS?: string;
      QUOTE_DO_SNAPSHOT_BATCH_SYMBOLS?: string;
      QUOTE_DO_SNAPSHOT_IMMEDIATE_SYMBOLS?: string;
      QUOTE_DO_SNAPSHOT_BACKPRESSURE_BYTES?: string;
      QUOTE_DO_SNAPSHOT_BACKPRESSURE_YIELD_MS?: string;
      QUOTE_DO_PRICE_DELTA_MILLI?: string;
      QUOTE_DO_CHANGE_DELTA_BP?: string;
      QUOTE_DO_FORCE_SNAPSHOT_MS?: string;
      QUOTE_SNAPSHOT_TTL_SECONDS?: string;
    };

    this.heartbeatSweepMs = parseEnvInt(
      runtimeEnv.QUOTE_DO_HEARTBEAT_SWEEP_MS,
      DEFAULT_HEARTBEAT_SWEEP_MS,
      5_000,
      120_000
    );
    const heartbeatTimeoutMs = parseEnvInt(
      runtimeEnv.QUOTE_DO_HEARTBEAT_TIMEOUT_MS,
      DEFAULT_HEARTBEAT_TIMEOUT_MS,
      10_000,
      300_000
    );
    this.heartbeatTimeoutMs = Math.max(heartbeatTimeoutMs, this.heartbeatSweepMs + 5_000);
    this.batchFlushMs = parseEnvInt(runtimeEnv.QUOTE_DO_BATCH_FLUSH_MS, DEFAULT_BATCH_FLUSH_MS, 40, 1000);
    this.snapshotBatchSymbols = parseEnvInt(
      runtimeEnv.QUOTE_DO_SNAPSHOT_BATCH_SYMBOLS,
      DEFAULT_SNAPSHOT_BATCH_SYMBOLS,
      4,
      128
    );
    this.snapshotImmediateSymbols = parseEnvInt(
      runtimeEnv.QUOTE_DO_SNAPSHOT_IMMEDIATE_SYMBOLS,
      DEFAULT_SNAPSHOT_IMMEDIATE_SYMBOLS,
      0,
      64
    );
    this.snapshotBackpressureBytes = parseEnvInt(
      runtimeEnv.QUOTE_DO_SNAPSHOT_BACKPRESSURE_BYTES,
      DEFAULT_SNAPSHOT_BACKPRESSURE_BYTES,
      32 * 1024,
      8 * 1024 * 1024
    );
    this.snapshotBackpressureYieldMs = parseEnvInt(
      runtimeEnv.QUOTE_DO_SNAPSHOT_BACKPRESSURE_YIELD_MS,
      DEFAULT_SNAPSHOT_BACKPRESSURE_YIELD_MS,
      1,
      100
    );
    this.priceDeltaMilli = parseEnvInt(runtimeEnv.QUOTE_DO_PRICE_DELTA_MILLI, DEFAULT_PRICE_DELTA_MILLI, 0, 100);
    this.changeDeltaBp = parseEnvInt(runtimeEnv.QUOTE_DO_CHANGE_DELTA_BP, DEFAULT_CHANGE_DELTA_BP, 0, 100);
    this.forceSnapshotMs = parseEnvInt(runtimeEnv.QUOTE_DO_FORCE_SNAPSHOT_MS, DEFAULT_FORCE_SNAPSHOT_MS, 500, 60_000);
    this.snapshotTtlSeconds = parseEnvInt(
      runtimeEnv.QUOTE_SNAPSHOT_TTL_SECONDS,
      KV_SNAPSHOT_TTL_SECONDS,
      30,
      3600
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
      await this.ensureStarted();
      return this.acceptWebSocket();
    }

    if (url.pathname === '/metrics') {
      return Response.json({ ok: true, do: 'quote', stats: this.snapshotStats() });
    }

    return Response.json({ ok: true, durableObject: 'QuoteDurableObject', ws: '/ws' });
  }

  private async ensureStarted() {
    if (this.started) return;
    this.started = true;

    await this.sourceManager.start((tick) => {
      this.latestTickBySymbol.set(tick.symbol, tick);
      this.persistSnapshot(tick);

      if (!this.symbolSubscribers.has(tick.symbol)) return;
      this.pendingBySymbol.set(tick.symbol, tick);
      this.stats.pendingSymbols = this.pendingBySymbol.size;
    });

    this.flushTimer = setInterval(() => {
      void this.flushBatch();
    }, this.batchFlushMs);

    this.heartbeatTimer = setInterval(() => {
      this.heartbeatSweep();
    }, this.heartbeatSweepMs);
  }

  private acceptWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.accept();

    const defaultTransport = normalizeTransport(
      (this.env as unknown as { QUOTE_DO_DEFAULT_TRANSPORT?: string }).QUOTE_DO_DEFAULT_TRANSPORT
    );
    const configuredCompression = normalizeCompression(
      (this.env as unknown as { QUOTE_DO_DEFAULT_COMPRESSION?: string }).QUOTE_DO_DEFAULT_COMPRESSION
    );
    const defaultCompression: CompressionMode = defaultTransport === 'bundle' ? configuredCompression : 'none';

    this.clients.set(server, {
      symbols: new Set(),
      lastPongAt: Date.now(),
      transport: defaultTransport,
      compression: defaultCompression,
      subscriptionSignature: '',
      dictVersion: 0,
      symbolIdMap: new Map(),
      lastSentBySymbolId: new Map()
    });
    this.stats.clients = this.clients.size;

    server.addEventListener('message', (event) => {
      void this.onClientMessage(server, event.data);
    });

    const cleanup = () => {
      this.cleanupClient(server);
    };

    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    server.send(
      JSON.stringify({
        ok: true,
        type: 'connected',
        batchFlushMs: this.batchFlushMs,
        sourceStatus: this.sourceManager.status(),
        transport: defaultTransport,
        compression: defaultCompression,
        transportPreferred: defaultTransport === 'bundle' ? 'bundle-protobuf' : 'protobuf'
      })
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  private async onClientMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const client = this.clients.get(ws);
    if (!client || typeof raw !== 'string') return;

    if (raw === 'pong') {
      client.lastPongAt = Date.now();
      return;
    }

    let parsed: {
      type?: string;
      symbols?: string[];
      transport?: string;
      compression?: string;
      clientSentAtMs?: number;
    };
    try {
      parsed = JSON.parse(raw) as {
        type?: string;
        symbols?: string[];
        transport?: string;
        compression?: string;
        clientSentAtMs?: number;
      };
    } catch {
      ws.send(JSON.stringify({ ok: false, error: 'invalid ws payload' }));
      return;
    }

    if (parsed.type === 'ping') {
      client.lastPongAt = Date.now();
      ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      return;
    }

    if (parsed.type === 'subscribe') {
      if (parsed.transport) client.transport = normalizeTransport(parsed.transport);
      if (parsed.compression) {
        client.compression = normalizeCompression(parsed.compression);
      } else if (client.transport === 'bundle' && client.compression === 'none') {
        client.compression = normalizeCompression(
          (this.env as unknown as { QUOTE_DO_DEFAULT_COMPRESSION?: string }).QUOTE_DO_DEFAULT_COMPRESSION
        );
      }

      const requestedSymbols = this.normalizeSymbols(parsed.symbols ?? []);
      for (const symbol of requestedSymbols) {
        this.subscribe(ws, symbol);
      }
      this.refreshClientDictionary(client);

      this.deferSlowTask(() => this.syncUpstreamSubscriptions());
      this.sendBundleDictionaryIfNeeded(ws, client);

      const targetSymbols = requestedSymbols.length ? requestedSymbols : [...client.symbols];
      const snapshotPlan = this.buildSnapshotPlan(client, targetSymbols, 0);
      this.deferSnapshotRemainder(ws, client, snapshotPlan.memoryRemainder, snapshotPlan.missingSymbols);

      ws.send(
        JSON.stringify({
          ok: true,
          type: 'subscribed',
          symbols: snapshotPlan.targetSymbols,
          transport: client.transport,
          compression: client.compression,
          dictVersion: client.dictVersion,
          snapshot: {
            memoryHits: snapshotPlan.immediateData.length + snapshotPlan.memoryRemainder.length,
            pendingSymbols: snapshotPlan.missingSymbols.length
          }
        })
      );
      return;
    }

    if (parsed.type === 'resync') {
      if (parsed.transport) client.transport = normalizeTransport(parsed.transport);
      if (parsed.compression) {
        client.compression = normalizeCompression(parsed.compression);
      } else if (client.transport === 'bundle' && client.compression === 'none') {
        client.compression = normalizeCompression(
          (this.env as unknown as { QUOTE_DO_DEFAULT_COMPRESSION?: string }).QUOTE_DO_DEFAULT_COMPRESSION
        );
      }

      const nextSymbols = this.normalizeSymbols(parsed.symbols ?? []);
      const nextSet = new Set(nextSymbols);

      for (const symbol of [...client.symbols]) {
        if (!nextSet.has(symbol)) this.unsubscribe(ws, symbol);
      }
      for (const symbol of nextSymbols) {
        this.subscribe(ws, symbol);
      }

      this.refreshClientDictionary(client);

      const snapshotPlan = this.buildSnapshotPlan(client, nextSymbols, this.snapshotImmediateSymbols);

      ws.send(
        JSON.stringify({
          ok: true,
          type: 'resync_ack',
          pending: snapshotPlan.memoryRemainder.length + snapshotPlan.missingSymbols.length > 0,
          symbols: snapshotPlan.targetSymbols,
          immediateData: snapshotPlan.immediateData,
          transport: client.transport,
          compression: client.compression,
          dictVersion: client.dictVersion,
          clientSentAtMs: typeof parsed.clientSentAtMs === 'number' ? parsed.clientSentAtMs : null
        })
      );

      void this.syncUpstreamSubscriptions().catch(() => {
        // 上游订阅同步失败不影响 resync ack 主链路
      });
      this.sendBundleDictionaryIfNeeded(ws, client);
      this.deferSnapshotRemainder(ws, client, snapshotPlan.memoryRemainder, snapshotPlan.missingSymbols);
      return;
    }

    if (parsed.type === 'unsubscribe') {
      for (const symbol of parsed.symbols ?? []) {
        this.unsubscribe(ws, symbol);
      }
      this.refreshClientDictionary(client);

      this.deferSlowTask(() => this.syncUpstreamSubscriptions());
      ws.send(
        JSON.stringify({
          ok: true,
          type: 'unsubscribed',
          symbols: [...client.symbols],
          transport: client.transport,
          compression: client.compression,
          dictVersion: client.dictVersion
        })
      );
      this.sendBundleDictionaryIfNeeded(ws, client);
      return;
    }

    ws.send(JSON.stringify({ ok: false, error: 'unsupported message type' }));
  }

  private normalizeSymbols(symbols: string[]): string[] {
    const unique = new Set<string>();
    for (const raw of symbols) {
      const symbol = raw.trim();
      if (!symbol || unique.has(symbol)) continue;
      unique.add(symbol);
    }
    return [...unique];
  }

  private isSocketOpen(ws: WebSocket): boolean {
    return ws.readyState === 1;
  }

  private deferSlowTask(run: () => Promise<unknown>) {
    const task = run().catch(() => {
      // 异步慢任务失败不应影响主链路
    });

    if (typeof this.state.waitUntil === 'function') {
      this.state.waitUntil(task);
      return;
    }

    queueMicrotask(() => {
      void task;
    });
  }

  private snapshotKvKey(symbol: string) {
    return `${KV_SNAPSHOT_PREFIX}${symbol}`;
  }

  private persistSnapshot(tick: QuoteTickSnapshot) {
    this.latestTickBySymbol.set(tick.symbol, tick);

    if (!this.env.QUOTE_KV) return;

    this.deferSlowTask(async () => {
      const bytes = protobufCodec.encodeSnapshot(tick, Date.now());
      await storageTelemetry.observe('kv', 'snapshot.put', () =>
        this.env.QUOTE_KV.put(this.snapshotKvKey(tick.symbol), bytes, {
          expirationTtl: this.snapshotTtlSeconds
        })
      );
    });
  }

  private async readSnapshotFromKv(symbol: string): Promise<QuoteTickSnapshot | null> {
    if (!this.env.QUOTE_KV) return null;

    try {
      const raw = await storageTelemetry.observe('kv', 'snapshot.get', () =>
        this.env.QUOTE_KV.get(this.snapshotKvKey(symbol), 'arrayBuffer')
      );
      if (!raw) return null;

      const decoded = protobufCodec.decodeSnapshot(raw);
      const ticker = decoded.ticker;
      const normalized: QuoteTickSnapshot = {
        symbol: ticker.symbol,
        price: ticker.price,
        changePct: ticker.changePct,
        ts: ticker.ts,
        source: ticker.source ?? 'unknown'
      };

      return isQuoteTickSnapshot(normalized) ? normalized : null;
    } catch (error) {
      storageTelemetry.record('kv', 'snapshot.read_error', 0, error);
      return null;
    }
  }

  private buildSnapshotPlan(client: ClientState, symbols: string[], immediateLimit: number): SnapshotPlan {
    const targetSymbols = this.normalizeSymbols(symbols).filter((symbol) => client.symbols.has(symbol));

    const memoryTicks: QuoteTickSnapshot[] = [];
    const missingSymbols: string[] = [];

    for (const symbol of targetSymbols) {
      const snapshot = this.latestTickBySymbol.get(symbol);
      if (snapshot) {
        memoryTicks.push(snapshot);
      } else {
        missingSymbols.push(symbol);
      }
    }

    const normalizedImmediateLimit = Math.max(0, Math.round(immediateLimit));
    const boostedImmediateLimit =
      normalizedImmediateLimit > 0 ? Math.max(normalizedImmediateLimit, Math.ceil(normalizedImmediateLimit * 1.3)) : 0;
    const safeImmediateLimit = Math.min(memoryTicks.length, boostedImmediateLimit);

    const immediateData = safeImmediateLimit > 0 ? memoryTicks.slice(0, safeImmediateLimit) : [];
    const memoryRemainder = safeImmediateLimit > 0 ? memoryTicks.slice(safeImmediateLimit) : memoryTicks;

    return {
      targetSymbols,
      immediateData,
      memoryRemainder,
      missingSymbols
    };
  }

  private deferSnapshotRemainder(
    ws: WebSocket,
    client: ClientState,
    memoryTicks: QuoteTickSnapshot[],
    missingSymbols: string[]
  ) {
    this.deferSlowTask(async () => {
      if (!this.isSocketOpen(ws) || this.clients.get(ws) !== client) return;
      await this.sendSnapshotRemainder(ws, client, memoryTicks, missingSymbols);
    });
  }

  private async sendSnapshotRemainder(
    ws: WebSocket,
    client: ClientState,
    memoryTicks: QuoteTickSnapshot[],
    missingSymbols: string[]
  ) {
    if (!this.isSocketOpen(ws) || this.clients.get(ws) !== client) return;

    if (memoryTicks.length) {
      await this.sendSnapshotTicks(ws, client, memoryTicks);
    }

    if (!missingSymbols.length) return;
    await this.sendMissingSymbols(ws, client, missingSymbols);
  }

  private async sendMissingSymbols(ws: WebSocket, client: ClientState, missingSymbols: string[]): Promise<void> {
    if (!missingSymbols.length || !this.env.QUOTE_KV) return;
    if (!this.isSocketOpen(ws) || this.clients.get(ws) !== client) return;

    const kvTicks: QuoteTickSnapshot[] = [];

    for (let index = 0; index < missingSymbols.length; index += this.snapshotBatchSymbols) {
      if (!this.isSocketOpen(ws) || this.clients.get(ws) !== client) return;

      const symbolsChunk = missingSymbols.slice(index, index + this.snapshotBatchSymbols);
      const kvResults = await Promise.all(symbolsChunk.map((symbol) => this.readSnapshotFromKv(symbol)));

      for (const tick of kvResults) {
        if (!tick) continue;
        if (!client.symbols.has(tick.symbol)) continue;
        kvTicks.push(tick);
      }
    }

    if (!kvTicks.length) return;
    await this.sendSnapshotTicks(ws, client, kvTicks);
  }

  private getSocketBufferedAmount(ws: WebSocket): number {
    const bufferedAmount = (ws as unknown as { bufferedAmount?: unknown }).bufferedAmount;
    return typeof bufferedAmount === 'number' && Number.isFinite(bufferedAmount) ? bufferedAmount : 0;
  }

  private computeSnapshotDynamicDelayMs(batchIndex: number, bufferedAmount: number): number {
    const pressureRatio = this.snapshotBackpressureBytes
      ? bufferedAmount / this.snapshotBackpressureBytes
      : 0;

    if (pressureRatio >= 1.5) return Math.min(48, this.snapshotBackpressureYieldMs * 6);
    if (pressureRatio >= 1.1) return Math.min(30, this.snapshotBackpressureYieldMs * 4);
    if (pressureRatio >= 0.8) return Math.min(18, this.snapshotBackpressureYieldMs * 2);

    if (batchIndex <= 1) return 0;
    if (batchIndex <= 4) return 1;
    return 2;
  }

  private computeSnapshotDynamicBatchSize(
    bufferedAmount: number,
    remaining: number,
    batchIndex: number,
    transport: TransportMode
  ): number {
    const base = this.snapshotBatchSymbols;
    const pressureRatio = this.snapshotBackpressureBytes
      ? bufferedAmount / this.snapshotBackpressureBytes
      : 0;

    let next = base;
    if (pressureRatio <= 0.2) {
      next = Math.min(transport === 'bundle' ? 96 : 72, Math.ceil(base * 2));
    } else if (pressureRatio <= 0.5) {
      next = Math.min(transport === 'bundle' ? 72 : 56, Math.ceil(base * 1.5));
    } else if (pressureRatio >= 1.2) {
      next = Math.max(6, Math.floor(base * 0.5));
    } else if (pressureRatio >= 0.9) {
      next = Math.max(8, Math.floor(base * 0.75));
    }

    if (batchIndex >= 4 && pressureRatio < 0.8) {
      next = Math.max(8, Math.floor(next * 0.85));
    }

    return Math.max(4, Math.min(remaining, next));
  }

  private async waitForSnapshotBackpressure(ws: WebSocket): Promise<void> {
    let bufferedAmount = this.getSocketBufferedAmount(ws);
    if (bufferedAmount < this.snapshotBackpressureBytes) return;

    let guard = 0;
    while (bufferedAmount >= this.snapshotBackpressureBytes && guard < 3) {
      await sleep(this.snapshotBackpressureYieldMs);
      bufferedAmount = this.getSocketBufferedAmount(ws);
      guard += 1;
    }
  }

  private async sendSnapshotTicks(ws: WebSocket, client: ClientState, ticks: QuoteTickSnapshot[]) {
    if (!ticks.length) return;
    if (!this.isSocketOpen(ws) || this.clients.get(ws) !== client) return;

    const normalizedTicks = ticks.slice().sort((a, b) => a.symbol.localeCompare(b.symbol));

    try {
      let batchIndex = 0;
      let index = 0;

      if (client.transport === 'bundle') {
        while (index < normalizedTicks.length) {
          if (!this.isSocketOpen(ws) || this.clients.get(ws) !== client) return;
          await this.waitForSnapshotBackpressure(ws);

          const bufferedAmount = this.getSocketBufferedAmount(ws);
          const chunkSize = this.computeSnapshotDynamicBatchSize(
            bufferedAmount,
            normalizedTicks.length - index,
            batchIndex,
            client.transport
          );
          const chunk = normalizedTicks.slice(index, index + chunkSize);
          index += chunk.length;

          const frame = await this.encodeBundleFrame(chunk, client, client.compression, true);
          if (!frame.byteLength) continue;
          if (!this.isSocketOpen(ws) || this.clients.get(ws) !== client) return;

          ws.send(frame);
          this.stats.sentBinaryFrames += 1;
          this.stats.sentBundleFrames += 1;
          if (client.compression !== 'none') this.stats.sentCompressedFrames += 1;
          this.stats.sentBytes += frame.byteLength;

          if (index >= normalizedTicks.length) continue;

          const delayMs = this.computeSnapshotDynamicDelayMs(batchIndex, this.getSocketBufferedAmount(ws));
          if (delayMs <= 0) {
            await Promise.resolve();
          } else {
            await sleep(delayMs);
          }
          batchIndex += 1;
        }
        return;
      }

      while (index < normalizedTicks.length) {
        if (!this.isSocketOpen(ws) || this.clients.get(ws) !== client) return;
        await this.waitForSnapshotBackpressure(ws);

        const bufferedAmount = this.getSocketBufferedAmount(ws);
        const chunkSize = this.computeSnapshotDynamicBatchSize(
          bufferedAmount,
          normalizedTicks.length - index,
          batchIndex,
          client.transport
        );
        const chunk = normalizedTicks.slice(index, index + chunkSize);
        index += chunk.length;

        for (const tick of chunk) {
          if (!this.isSocketOpen(ws) || this.clients.get(ws) !== client) return;
          this.sendLegacyTick(ws, client, tick);
        }

        if (index >= normalizedTicks.length) continue;

        const delayMs = this.computeSnapshotDynamicDelayMs(batchIndex, this.getSocketBufferedAmount(ws));
        if (delayMs <= 0) {
          await Promise.resolve();
        } else {
          await sleep(delayMs);
        }
        batchIndex += 1;
      }
    } catch {
      this.stats.droppedFrames += 1;
      if (this.isSocketOpen(ws)) {
        ws.close(1011, 'snapshot send failed');
      }
      this.cleanupClient(ws);
    }
  }

  private sendLegacyTick(ws: WebSocket, client: ClientState, tick: QuoteTick) {
    let frameToSend: ArrayBuffer | null = null;
    let sentAsFallback = false;

    try {
      const proto = protobufCodec.encodeQuoteTick(tick);
      frameToSend = toArrayBuffer(proto);
    } catch {
      const debugEnabled = (this.env as unknown as { QT1_DEBUG_FALLBACK?: string }).QT1_DEBUG_FALLBACK === '1';
      if (debugEnabled) {
        const qt1 = encodeQt1DebugFrame(tick);
        if (qt1) {
          frameToSend = toArrayBuffer(qt1);
          sentAsFallback = true;
        }
      }
    }

    if (!frameToSend) {
      this.stats.droppedFrames += 1;
      return;
    }

    ws.send(frameToSend);
    this.stats.sentBinaryFrames += 1;
    this.stats.sentBytes += frameToSend.byteLength;
    if (sentAsFallback) {
      this.stats.sentFallbackFrames += 1;
    } else {
      this.stats.sentProtobufFrames += 1;
    }
  }

  private subscribe(ws: WebSocket, symbol: string) {
    const normalized = symbol.trim();
    if (!normalized) return;

    const client = this.clients.get(ws);
    if (!client) return;
    if (client.symbols.has(normalized)) return;

    client.symbols.add(normalized);
    const listeners = this.symbolSubscribers.get(normalized) ?? new Set<WebSocket>();
    listeners.add(ws);
    this.symbolSubscribers.set(normalized, listeners);

    this.stats.subscriptions += 1;
  }

  private unsubscribe(ws: WebSocket, symbol: string) {
    const normalized = symbol.trim();
    if (!normalized) return;

    const client = this.clients.get(ws);
    if (!client) return;
    if (!client.symbols.has(normalized)) return;

    client.symbols.delete(normalized);

    const listeners = this.symbolSubscribers.get(normalized);
    if (listeners) {
      listeners.delete(ws);
      if (!listeners.size) {
        this.symbolSubscribers.delete(normalized);
        this.pendingBySymbol.delete(normalized);
      }
    }

    this.stats.subscriptions = Math.max(0, this.stats.subscriptions - 1);
    this.stats.pendingSymbols = this.pendingBySymbol.size;
  }

  private refreshClientDictionary(client: ClientState) {
    const sortedSymbols = [...client.symbols].sort();
    const nextSignature = sortedSymbols.join(',');

    if (client.subscriptionSignature === nextSignature && client.symbolIdMap.size === sortedSymbols.length) {
      return;
    }

    client.subscriptionSignature = nextSignature;
    client.symbolIdMap.clear();
    sortedSymbols.forEach((symbol, index) => {
      client.symbolIdMap.set(symbol, index);
    });
    client.lastSentBySymbolId.clear();
    client.dictVersion += 1;
  }

  private sendBundleDictionaryIfNeeded(ws: WebSocket, client: ClientState) {
    if (client.transport !== 'bundle') return;

    ws.send(
      JSON.stringify({
        type: 'bundle_dict',
        dictVersion: client.dictVersion,
        symbols: [...client.symbolIdMap.keys()],
        sources: BUNDLE_SOURCES
      })
    );
  }

  private async syncUpstreamSubscriptions() {
    await this.sourceManager.setSymbols([...this.symbolSubscribers.keys()]);
  }

  private cleanupClient(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) return;

    for (const symbol of client.symbols) {
      const listeners = this.symbolSubscribers.get(symbol);
      if (!listeners) continue;

      listeners.delete(ws);
      this.stats.subscriptions = Math.max(0, this.stats.subscriptions - 1);

      if (!listeners.size) {
        this.symbolSubscribers.delete(symbol);
        this.pendingBySymbol.delete(symbol);
      }
    }

    this.clients.delete(ws);
    this.stats.clients = this.clients.size;
    this.stats.pendingSymbols = this.pendingBySymbol.size;

    this.deferSlowTask(() => this.syncUpstreamSubscriptions());
  }

  private async flushBatch() {
    if (this.flushInFlight) return;
    if (!this.pendingBySymbol.size) return;

    this.flushInFlight = true;

    try {
      const ticks = [...this.pendingBySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
      this.pendingBySymbol.clear();
      this.stats.pendingSymbols = 0;
      this.stats.flushCount += 1;
      this.stats.lastFlushAt = new Date().toISOString();

      for (const [ws, client] of this.clients.entries()) {
        if (!client.symbols.size) continue;

        try {
          if (client.transport === 'bundle') {
            const selectedTicks = ticks.filter((tick) => client.symbols.has(tick.symbol));
            const frame = await this.encodeBundleFrame(selectedTicks, client, client.compression);
            if (!frame.byteLength) continue;

            ws.send(frame);
            this.stats.sentBinaryFrames += 1;
            this.stats.sentBundleFrames += 1;
            if (client.compression !== 'none') this.stats.sentCompressedFrames += 1;
            this.stats.sentBytes += frame.byteLength;
            continue;
          }

          // legacy path: one protobuf tick per symbol
          for (const tick of ticks) {
            if (!client.symbols.has(tick.symbol)) continue;
            this.sendLegacyTick(ws, client, tick);
          }
        } catch {
          this.stats.droppedFrames += 1;
          ws.close(1011, 'broadcast failed');
          this.cleanupClient(ws);
        }
      }
    } finally {
      this.flushInFlight = false;
    }
  }

  private async encodeBundleFrame(
    ticks: QuoteTick[],
    client: ClientState,
    compression: CompressionMode,
    forceFull = false
  ): Promise<ArrayBuffer> {
    if (!ticks.length) return new ArrayBuffer(0);

    const nowMs = Date.now();
    const nextTicks: Array<{
      symbolId: number;
      sourceId: number;
      priceMilli: number;
      changeBp: number;
      tsMs: number;
      last: LastSentTick | undefined;
    }> = [];

    for (const tick of ticks) {
      const symbolId = client.symbolIdMap.get(tick.symbol);
      if (symbolId === undefined) continue;

      const sourceId = BUNDLE_SOURCE_ID.get(tick.source) ?? 0;
      const priceMilli = Math.round(tick.price * 1000);
      const changeBp = Math.round(tick.changePct * 100);
      const parsedTs = Date.parse(tick.ts);
      const tsMs = Number.isFinite(parsedTs) ? Math.round(parsedTs) : nowMs;
      const last = forceFull ? undefined : client.lastSentBySymbolId.get(symbolId);

      const forceBySilence = forceFull || !last || nowMs - last.sentAtMs >= this.forceSnapshotMs;
      const sourceChanged = !last || sourceId !== last.sourceId;
      const priceChanged = !last || Math.abs(priceMilli - last.priceMilli) >= this.priceDeltaMilli;
      const changeChanged = !last || Math.abs(changeBp - last.changeBp) >= this.changeDeltaBp;

      if (!forceBySilence && !sourceChanged && !priceChanged && !changeChanged) {
        continue;
      }

      nextTicks.push({ symbolId, sourceId, priceMilli, changeBp, tsMs, last });
    }

    if (!nextTicks.length) return new ArrayBuffer(0);

    const baseTsMs = Math.min(...nextTicks.map((tick) => tick.tsMs));
    const baseTsSec = Math.floor(baseTsMs / 1000);
    const baseTsSecMs = baseTsSec * 1000;

    const symbolIds: number[] = [];
    const sourceIds: number[] = [];
    const priceDeltas: number[] = [];
    const changeDeltas: number[] = [];
    const tsOffsetsMs: number[] = [];

    for (const item of nextTicks) {
      symbolIds.push(item.symbolId);
      sourceIds.push(item.sourceId);
      priceDeltas.push(item.last ? item.priceMilli - item.last.priceMilli : item.priceMilli);
      changeDeltas.push(item.last ? item.changeBp - item.last.changeBp : item.changeBp);
      tsOffsetsMs.push(Math.max(0, item.tsMs - baseTsSecMs));

      client.lastSentBySymbolId.set(item.symbolId, {
        sourceId: item.sourceId,
        priceMilli: item.priceMilli,
        changeBp: item.changeBp,
        tsMs: item.tsMs,
        sentAtMs: nowMs
      });
    }

    const bytes = encodeQuoteBundleDelta({
      dictVersion: client.dictVersion,
      baseTsSec,
      symbolIds,
      sourceIds,
      priceDeltas,
      changeDeltas,
      tsOffsetsMs
    });

    if (compression === 'gzip') {
      const gz = await compressBytes(bytes, 'gzip');
      return buildBundleEnvelope(CODEC_GZIP, gz);
    }

    if (compression === 'deflate') {
      const df = await compressBytes(bytes, 'deflate');
      return buildBundleEnvelope(CODEC_DEFLATE, df);
    }

    return buildBundleEnvelope(CODEC_NONE, bytes);
  }

  private heartbeatSweep() {
    const now = Date.now();

    for (const [ws, state] of this.clients.entries()) {
      if (now - state.lastPongAt > this.heartbeatTimeoutMs) {
        ws.close(1001, 'heartbeat timeout');
        this.cleanupClient(ws);
        continue;
      }

      try {
        ws.send(JSON.stringify({ type: 'ping', ts: now }));
      } catch {
        ws.close(1011, 'heartbeat failed');
        this.cleanupClient(ws);
      }
    }
  }

  private snapshotStats() {
    return {
      ...this.stats,
      source: this.sourceManager.status(),
      limits: {
        heartbeatSweepMs: this.heartbeatSweepMs,
        heartbeatTimeoutMs: this.heartbeatTimeoutMs,
        batchFlushMs: this.batchFlushMs,
        snapshotBatchSymbols: this.snapshotBatchSymbols,
        snapshotImmediateSymbols: this.snapshotImmediateSymbols,
        snapshotBackpressureBytes: this.snapshotBackpressureBytes,
        snapshotBackpressureYieldMs: this.snapshotBackpressureYieldMs,
        priceDeltaMilli: this.priceDeltaMilli,
        changeDeltaBp: this.changeDeltaBp,
        forceSnapshotMs: this.forceSnapshotMs,
        snapshotTtlSeconds: this.snapshotTtlSeconds
      },
      storage: storageTelemetry.snapshot()
    };
  }
}

export class QuoteDO extends QuoteDurableObject {}
