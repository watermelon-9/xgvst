import { Hono } from 'hono';
import { QuoteDurableObject } from './durable/QuoteDurableObject';
import { encodeQuote } from './proto/quote';
import { SourceManager } from './sources/SourceManager';
import type { QuoteTick } from './sources/QuoteSource';

type Bindings = {
  QUOTE_KV: KVNamespace;
  QUOTE_DB: D1Database;
  QUOTE_DO: DurableObjectNamespace;
  QUOTE_API_TOKEN?: string;
  CORS_ALLOW_ORIGINS?: string;
  ALLTICK_TOKEN?: string;
  SINA_COOKIE?: string;
  EASTMONEY_TOKEN?: string;
  TENCENT_TOKEN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

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

function buildCorsHeaders(c: { req: { header: (name: string) => string | undefined }; env: Bindings }): Headers {
  const origin = c.req.header('origin');
  const allowedOrigins = parseAllowedOrigins(c.env.CORS_ALLOW_ORIGINS);
  const resolved = resolveCorsOrigin(origin, allowedOrigins);

  return new Headers({
    'Access-Control-Allow-Origin': resolved,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  });
}

class QuoteConnectionPool {
  private readonly clients = new Map<WebSocket, { symbols: Set<string>; lastPongAt: number }>();
  private readonly sourceManager = new SourceManager();
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
      ...this.sourceManager.status()
    };
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
        sourceStatus: this.sourceManager.status()
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
          return;
        }

        if (parsed.type === 'subscribe') {
          for (const symbol of parsed.symbols ?? []) client.symbols.add(symbol);
          await this.syncSubscriptions();
          ws.send(JSON.stringify({ ok: true, type: 'subscribed', symbols: [...client.symbols] }));
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
    const frame = JSON.stringify({ type: 'tick', data: tick });
    for (const [ws, { symbols }] of this.clients.entries()) {
      if (!symbols.has(tick.symbol)) continue;
      try {
        ws.send(frame);
      } catch {
        ws.close(1011, 'broadcast failed');
        this.clients.delete(ws);
      }
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

app.get('/ws/quote', async (c) => {
  if ((c.req.header('upgrade') ?? '').toLowerCase() !== 'websocket') {
    return c.json({ ok: false, error: 'Expected websocket upgrade' }, 426);
  }

  const pool = getQuotePool(c.env);
  await pool.start();
  return pool.acceptWebSocket();
});

export { QuoteDurableObject };
export default app;
