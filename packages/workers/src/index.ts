import { Hono } from 'hono';
import { QuoteDurableObject } from './durable/QuoteDurableObject';
import { encodeQuote } from './proto/quote';

type Bindings = {
  QUOTE_KV: KVNamespace;
  QUOTE_DB: D1Database;
  QUOTE_DO: DurableObjectNamespace;
  QUOTE_API_TOKEN?: string;
  CORS_ALLOW_ORIGINS?: string;
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
      // WebSocket upgrade responses have immutable headers in workerd.
      // Ignore to avoid breaking upgrade handshakes.
    }
  }
});

app.get('/health', (c) => {
  return c.json({ ok: true, service: 'xgvst-workers', ts: new Date().toISOString() });
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

app.get('/ws/quote', async (c) => {
  if ((c.req.header('upgrade') ?? '').toLowerCase() !== 'websocket') {
    return c.json({ ok: false, error: 'Expected websocket upgrade' }, 426);
  }

  const id = c.env.QUOTE_DO.idFromName('default');
  const stub = c.env.QUOTE_DO.get(id);
  return stub.fetch(new Request('https://quote-do/ws', { headers: c.req.raw.headers }));
});

export { QuoteDurableObject };
export default app;
