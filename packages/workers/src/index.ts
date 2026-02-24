import { Hono } from 'hono';
import { QuoteDurableObject } from './durable/QuoteDurableObject';
import { encodeQuote } from './proto/quote';
import { SourceManager } from './sources/SourceManager';
import type { QuoteTick } from './sources/QuoteSource';

type Bindings = Env;

const app = new Hono<{ Bindings: Bindings }>();

type DebugBindings = Bindings & { DEBUG_SOURCE_TOKEN?: string };

function isDebugAuthorized(c: {
  req: { header: (name: string) => string | undefined };
  env: DebugBindings;
}) {
  const token = c.env.DEBUG_SOURCE_TOKEN;
  if (!token) return true;
  return c.req.header('x-debug-token') === token;
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return ['*'];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveCorsOrigin(requestOrigin: string | undefined, allowedOrigins: string[]): string {
  if (allowedOrigins.includes('*')) return '*';
  if (!requestOrigin) return allowedOrigins[0] ?? '*';
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] ?? '*';
}

const SYNTHETIC_BASE_PRICE = new Map<string, number>([
  ['000001', 10.88],
  ['600519', 1628.3],
  ['300750', 182.45],
  ['000858', 145.2],
  ['601318', 42.6]
]);

type WsFrameStats = {
  sentBinaryFrames: number;
  sentFallbackFrames: number;
};

const textEncoder = new TextEncoder();

function encodeCustomBinaryTickFrame(tick: QuoteTick): Uint8Array | null {
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

  const tsLengthView = new DataView(frame.buffer, frame.byteOffset + offset, 2);
  tsLengthView.setUint16(0, tsBytes.length, true);
  offset += 2;
  frame.set(tsBytes, offset);
  offset += tsBytes.length;

  frame[offset] = sourceBytes.length;
  offset += 1;
  frame.set(sourceBytes, offset);

  return frame;
}

function buildCorsHeaders(c: { req: { header: (name: string) => string | undefined }; env: Bindings }): Headers {
  const origin = c.req.header('origin');
  const allowedOrigins = parseAllowedOrigins(c.env.CORS_ALLOW_ORIGINS);
  const resolved = resolveCorsOrigin(origin, allowedOrigins);

  return new Headers({
    'Access-Control-Allow-Origin': resolved,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, X-Debug-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  });
}

class QuoteConnectionPool {
  private readonly clients = new Map<WebSocket, { symbols: Set<string>; lastPongAt: number }>();
  private readonly sourceManager = new SourceManager();
  private readonly frameStats: WsFrameStats = {
    sentBinaryFrames: 0,
    sentFallbackFrames: 0
  };
  private started = false;

  constructor(private readonly env: Bindings) {}

  async start() {
    if (this.started) return;
    this.started = true;

    await this.sourceManager.start((tick) => {
      this.broadcastTick(tick);
    });

    setInterval(() => {
      this.heartbeatSweep();
    }, 15000);
  }

  status() {
    return {
      clients: this.clients.size,
      availableSources: this.sourceManager.getAvailableSources(),
      wsFrameStats: { ...this.frameStats },
      ...this.sourceManager.status()
    };
  }

  async debugSetSource(sourceName: string | null) {
    await this.sourceManager.debugSetSource(sourceName);
    await this.syncSubscriptions();
    return this.status();
  }

  async debugForceFailover(reason = 'debug api') {
    await this.sourceManager.forceFailover(reason);
    await this.syncSubscriptions();
    return this.status();
  }

  async acceptWebSocket(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    server.accept();
    this.clients.set(server, { symbols: new Set(), lastPongAt: Date.now() });

    server.addEventListener('message', (event) => {
      void this.onMessage(server, event.data);
    });

    server.addEventListener('close', () => {
      this.clients.delete(server);
      void this.syncSubscriptions();
    });

    server.send(
      JSON.stringify({
        ok: true,
        type: 'connected',
        sourceStatus: this.sourceManager.status(),
        transportPreferred: 'binary'
      })
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  private async onMessage(ws: WebSocket, raw: unknown) {
    const client = this.clients.get(ws);
    if (!client) return;

    if (typeof raw === 'string') {
      if (raw === 'pong') {
        client.lastPongAt = Date.now();
        return;
      }

      try {
        const parsed = JSON.parse(raw) as
          | { type: 'subscribe'; symbols?: string[] }
          | { type: 'unsubscribe'; symbols?: string[] }
          | { type: 'ping' }
          | { type: 'force_failover' };

        if (parsed.type === 'ping') {
          client.lastPongAt = Date.now();
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          this.broadcastSyntheticTicks();
          return;
        }

        if (parsed.type === 'subscribe') {
          for (const symbol of parsed.symbols ?? []) client.symbols.add(symbol);
          await this.syncSubscriptions();
          ws.send(JSON.stringify({ ok: true, type: 'subscribed', symbols: [...client.symbols] }));
          this.broadcastSyntheticTicks();
          return;
        }

        if (parsed.type === 'unsubscribe') {
          for (const symbol of parsed.symbols ?? []) client.symbols.delete(symbol);
          await this.syncSubscriptions();
          ws.send(JSON.stringify({ ok: true, type: 'unsubscribed', symbols: [...client.symbols] }));
          return;
        }

        if (parsed.type === 'force_failover') {
          await this.sourceManager.forceFailover('ws command');
          await this.syncSubscriptions();
          return;
        }
      } catch {
        ws.send(JSON.stringify({ ok: false, error: 'Invalid ws payload' }));
      }
    }
  }

  private heartbeatSweep() {
    const now = Date.now();

    for (const [ws, state] of this.clients.entries()) {
      if (now - state.lastPongAt > 30000) {
        ws.close(1001, 'heartbeat timeout');
        this.clients.delete(ws);
        continue;
      }

      try {
        ws.send(JSON.stringify({ type: 'ping', ts: now }));
      } catch {
        ws.close(1011, 'ping send failed');
        this.clients.delete(ws);
      }
    }

    void this.syncSubscriptions();
  }

  private async syncSubscriptions() {
    const merged = new Set<string>();
    for (const { symbols } of this.clients.values()) {
      for (const symbol of symbols) merged.add(symbol);
    }
    await this.sourceManager.setSymbols([...merged]);
  }

  private broadcastTick(tick: QuoteTick) {
    const binaryFrame = encodeCustomBinaryTickFrame(tick);
    const fallbackFrame = JSON.stringify({ type: 'tick', data: tick });

    for (const [ws, { symbols }] of this.clients.entries()) {
      if (!symbols.has(tick.symbol)) continue;

      try {
        if (binaryFrame) {
          ws.send(binaryFrame);
          this.frameStats.sentBinaryFrames += 1;
        } else {
          ws.send(fallbackFrame);
          this.frameStats.sentFallbackFrames += 1;
        }
      } catch {
        ws.close(1011, 'broadcast failed');
        this.clients.delete(ws);
      }
    }
  }

  private broadcastSyntheticTicks() {
    const status = this.sourceManager.status();
    const source = status.activeSource ?? 'alltick';

    const mergedSymbols = new Set<string>();
    for (const { symbols } of this.clients.values()) {
      for (const symbol of symbols) mergedSymbols.add(symbol);
    }

    for (const symbol of mergedSymbols) {
      const base = SYNTHETIC_BASE_PRICE.get(symbol) ?? 20;
      const noise = (Math.random() - 0.5) * 0.12;
      const price = Number((base + noise).toFixed(2));
      const changePct = Number((((price - base) / base) * 100).toFixed(2));

      this.broadcastTick({
        symbol,
        price,
        changePct,
        ts: new Date().toISOString(),
        source
      });
    }
  }
}

let quotePool: QuoteConnectionPool | null = null;

function getQuotePool(env: Bindings) {
  if (!quotePool) quotePool = new QuoteConnectionPool(env);
  return quotePool;
}

app.use('*', async (c, next) => {
  const corsHeaders = buildCorsHeaders(c);

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  await next();

  for (const [key, value] of corsHeaders.entries()) {
    try {
      c.res.headers.set(key, value);
    } catch {
      // ignore immutable headers on websocket upgrade responses
    }
  }
});

app.get('/health', async (c) => {
  const pool = getQuotePool(c.env);
  await pool.start();

  return c.json({
    ok: true,
    service: 'xgvst-workers',
    ts: new Date().toISOString(),
    wsPool: pool.status()
  });
});

app.get('/v3/universe', (c) => {
  const updatedAt = new Date().toISOString();

  return c.json({
    boards: [
      { code: 'BK001', name: '沪深主板', changePct: 0.72 },
      { code: 'BK002', name: '人工智能', changePct: 1.38 },
      { code: 'BK003', name: '新能源', changePct: -0.41 }
    ],
    watchlist: [
      { symbol: '000001', name: '平安银行', last: 10.88, changePct: 0.56 },
      { symbol: '600519', name: '贵州茅台', last: 1628.3, changePct: 0.42 },
      { symbol: '300750', name: '宁德时代', last: 182.45, changePct: -0.35 }
    ],
    updatedAt
  });
});

app.get('/api/quote/mock', (c) => {
  const payload = {
    symbol: '000001',
    name: '平安银行',
    price: 10.88,
    changePct: 0.56,
    ts: new Date().toISOString()
  };

  const proto = encodeQuote({
    symbol: payload.symbol,
    price: payload.price,
    changePct: payload.changePct,
    ts: payload.ts
  });

  return c.json({ ...payload, protoBase64: btoa(String.fromCharCode(...proto)) });
});

app.get('/api/source/status', async (c) => {
  const pool = getQuotePool(c.env);
  await pool.start();
  return c.json({ ok: true, ...pool.status() });
});

app.post('/api/debug/source/control', async (c) => {
  if (!isDebugAuthorized({ req: c.req, env: c.env as DebugBindings })) {
    return c.json({ ok: false, error: 'debug access denied' }, 403);
  }

  const pool = getQuotePool(c.env);
  await pool.start();

  const payload = await c.req.json().catch(() => ({})) as {
    action?: 'switch' | 'auto' | 'failover';
    source?: string | null;
  };

  const action = payload.action;

  if (action === 'switch') {
    const source = typeof payload.source === 'string' ? payload.source.trim() : '';
    if (!source) {
      return c.json({ ok: false, error: 'source is required for switch' }, 400);
    }

    try {
      const status = await pool.debugSetSource(source);
      return c.json({ ok: true, action, source, status });
    } catch (error) {
      return c.json({ ok: false, action, error: String((error as Error)?.message || error) }, 400);
    }
  }

  if (action === 'auto') {
    const status = await pool.debugSetSource(null);
    return c.json({ ok: true, action, status });
  }

  if (action === 'failover') {
    const status = await pool.debugForceFailover('debug api');
    return c.json({ ok: true, action, status });
  }

  return c.json({ ok: false, error: 'unsupported action', expected: ['switch', 'auto', 'failover'] }, 400);
});

function resolveQuoteSessionKey(c: { req: { query: (key: string) => string | undefined; header: (name: string) => string | undefined } }) {
  const fromQuery = c.req.query('session');
  if (fromQuery?.trim()) return `sess:${fromQuery.trim()}`;

  const fromAccess = c.req.header('cf-access-authenticated-user-email');
  if (fromAccess?.trim()) return `acc:${fromAccess.trim().toLowerCase()}`;

  const fromHeader = c.req.header('x-session-id');
  if (fromHeader?.trim()) return `hdr:${fromHeader.trim()}`;

  return 'anonymous';
}

app.get('/api/do/metrics', async (c) => {
  const sessionKey = resolveQuoteSessionKey(c);
  const doId = c.env.QUOTE_DO.idFromName(sessionKey);
  const stub = c.env.QUOTE_DO.get(doId);

  const response = await stub.fetch('https://quote-do/metrics');
  const payload = await response.json();
  return c.json({ ok: true, sessionKey, payload });
});

app.get('/ws/quote', async (c) => {
  if ((c.req.header('upgrade') ?? '').toLowerCase() !== 'websocket') {
    return c.json({ ok: false, error: 'Expected websocket upgrade' }, 426);
  }

  const sessionKey = resolveQuoteSessionKey(c);
  const doId = c.env.QUOTE_DO.idFromName(sessionKey);
  const stub = c.env.QUOTE_DO.get(doId);

  const doRequest = new Request('https://quote-do/ws', c.req.raw);
  return stub.fetch(doRequest);
});

export { QuoteDurableObject };
export default app;
