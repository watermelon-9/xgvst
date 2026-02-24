import { encodeQuote } from '../proto/quote';
import { SourceManager } from '../sources/SourceManager';
import type { QuoteTick } from '../sources/QuoteSource';

type ClientState = {
  symbols: Set<string>;
  lastPongAt: number;
};

type QuoteDOStats = {
  clients: number;
  subscriptions: number;
  pendingSymbols: number;
  flushCount: number;
  sentBinaryFrames: number;
  sentProtobufFrames: number;
  sentFallbackFrames: number;
  droppedFrames: number;
  lastFlushAt: string | null;
};

const HEARTBEAT_SWEEP_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 30_000;
const BATCH_FLUSH_MS = 100;

const textEncoder = new TextEncoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const cloned = bytes.slice();
  return cloned.buffer;
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
  private readonly sourceManager = new SourceManager();

  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  private readonly stats: QuoteDOStats = {
    clients: 0,
    subscriptions: 0,
    pendingSymbols: 0,
    flushCount: 0,
    sentBinaryFrames: 0,
    sentProtobufFrames: 0,
    sentFallbackFrames: 0,
    droppedFrames: 0,
    lastFlushAt: null
  };

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
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
      if (!this.symbolSubscribers.has(tick.symbol)) return;
      this.pendingBySymbol.set(tick.symbol, tick);
      this.stats.pendingSymbols = this.pendingBySymbol.size;
    });

    this.flushTimer = setInterval(() => {
      this.flushBatch();
    }, BATCH_FLUSH_MS);

    this.heartbeatTimer = setInterval(() => {
      this.heartbeatSweep();
    }, HEARTBEAT_SWEEP_MS);
  }

  private acceptWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.accept();
    this.clients.set(server, { symbols: new Set(), lastPongAt: Date.now() });
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
        batchFlushMs: BATCH_FLUSH_MS,
        sourceStatus: this.sourceManager.status(),
        transportPreferred: 'protobuf'
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

    let parsed: { type?: string; symbols?: string[] };
    try {
      parsed = JSON.parse(raw) as { type?: string; symbols?: string[] };
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
      for (const symbol of parsed.symbols ?? []) {
        this.subscribe(ws, symbol);
      }
      await this.syncUpstreamSubscriptions();
      ws.send(JSON.stringify({ ok: true, type: 'subscribed', symbols: [...client.symbols] }));
      return;
    }

    if (parsed.type === 'unsubscribe') {
      for (const symbol of parsed.symbols ?? []) {
        this.unsubscribe(ws, symbol);
      }
      await this.syncUpstreamSubscriptions();
      ws.send(JSON.stringify({ ok: true, type: 'unsubscribed', symbols: [...client.symbols] }));
      return;
    }

    ws.send(JSON.stringify({ ok: false, error: 'unsupported message type' }));
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

    void this.syncUpstreamSubscriptions();
  }

  private flushBatch() {
    if (!this.pendingBySymbol.size) return;

    const ticks = [...this.pendingBySymbol.values()];
    this.pendingBySymbol.clear();
    this.stats.pendingSymbols = 0;
    this.stats.flushCount += 1;
    this.stats.lastFlushAt = new Date().toISOString();

    for (const tick of ticks) {
      const listeners = this.symbolSubscribers.get(tick.symbol);
      if (!listeners?.size) continue;

      let frameToSend: ArrayBuffer | string;
      let sentAsFallback = false;

      try {
        const proto = encodeQuote({
          symbol: tick.symbol,
          price: tick.price,
          changePct: tick.changePct,
          ts: tick.ts
        });
        frameToSend = toArrayBuffer(proto);
      } catch {
        const debugEnabled = (this.env as unknown as { QT1_DEBUG_FALLBACK?: string }).QT1_DEBUG_FALLBACK === '1';
        if (debugEnabled) {
          const qt1 = encodeQt1DebugFrame(tick);
          if (qt1) {
            frameToSend = toArrayBuffer(qt1);
          } else {
            frameToSend = JSON.stringify({ type: 'tick', data: tick, transport: 'json-fallback' });
            sentAsFallback = true;
          }
        } else {
          frameToSend = JSON.stringify({ type: 'tick', data: tick, transport: 'json-fallback' });
          sentAsFallback = true;
        }
      }

      for (const ws of listeners) {
        try {
          ws.send(frameToSend);
          if (typeof frameToSend === 'string') {
            this.stats.sentFallbackFrames += 1;
          } else {
            this.stats.sentBinaryFrames += 1;
            if (!sentAsFallback) {
              this.stats.sentProtobufFrames += 1;
            }
          }
        } catch {
          this.stats.droppedFrames += 1;
          ws.close(1011, 'broadcast failed');
          this.cleanupClient(ws);
        }
      }
    }
  }

  private heartbeatSweep() {
    const now = Date.now();

    for (const [ws, state] of this.clients.entries()) {
      if (now - state.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
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
        heartbeatSweepMs: HEARTBEAT_SWEEP_MS,
        heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS,
        batchFlushMs: BATCH_FLUSH_MS
      }
    };
  }
}

export class QuoteDO extends QuoteDurableObject {}
