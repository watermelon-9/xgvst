import { Hono } from 'hono';
import { QuoteDurableObject } from './durable/QuoteDurableObject';
import { encodeQuote } from './proto/quote';

type Bindings = {
  API_URL: string;
  KV_NAMESPACE: string;
  D1_DATABASE_ID: string;
  QUOTE_KV: KVNamespace;
  QUOTE_DB: D1Database;
  QUOTE_DO: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/health', (c) => {
  return c.json({ ok: true, service: 'xgvst-workers', ts: new Date().toISOString() });
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
  if (c.req.header('upgrade') !== 'websocket') {
    return c.text('Expected websocket upgrade', 426);
  }

  const id = c.env.QUOTE_DO.idFromName('default');
  const stub = c.env.QUOTE_DO.get(id);
  return stub.fetch(new Request('https://quote-do/ws', { headers: c.req.raw.headers }));
});

export { QuoteDurableObject };
export default app;
