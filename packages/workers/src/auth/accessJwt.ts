import type { MiddlewareHandler } from 'hono';

type Bindings = Env;

export type AccessIdentity = {
  sub: string;
  email: string | null;
  userId: string;
  issuer?: string;
  audience?: string | null;
  tokenSource: 'cf-access-jwt-assertion' | 'authorization-bearer' | 'cf-access-email-header';
};

type JwtPayload = {
  sub?: unknown;
  email?: unknown;
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
};

function toBase64Url(input: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...input));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized + '='.repeat(4 - padding);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function parseJwt(token: string): { headerRaw: string; payloadRaw: string; signatureRaw: string; payload: JwtPayload } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerRaw, payloadRaw, signatureRaw] = parts;
  try {
    const payloadText = new TextDecoder().decode(fromBase64Url(payloadRaw));
    const payload = JSON.parse(payloadText) as JwtPayload;
    return { headerRaw, payloadRaw, signatureRaw, payload };
  } catch {
    return null;
  }
}

async function verifyHs256(token: string, secret: string): Promise<boolean> {
  const parsed = parseJwt(token);
  if (!parsed) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const data = new TextEncoder().encode(`${parsed.headerRaw}.${parsed.payloadRaw}`);
  const signed = await crypto.subtle.sign('HMAC', key, data);
  const signature = toBase64Url(new Uint8Array(signed));
  return signature === parsed.signatureRaw;
}

function readBearer(req: { header: (name: string) => string | undefined }): string | null {
  const auth = req.header('authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function normalizeAud(aud: unknown): string | null {
  if (typeof aud === 'string') return aud;
  if (Array.isArray(aud)) {
    const first = aud.find((x) => typeof x === 'string');
    return typeof first === 'string' ? first : null;
  }
  return null;
}

function toUnix(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function unauthorized(message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 401,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export async function resolveAccessIdentity(c: {
  env: Bindings;
  req: { header: (name: string) => string | undefined };
}): Promise<AccessIdentity | null> {
  const required = c.env.ACCESS_AUTH_REQUIRED !== '0';
  const trustedCfHeader = c.env.ACCESS_TRUST_CF_HEADERS === '1';

  const fromCfEmail = c.req.header('cf-access-authenticated-user-email')?.trim().toLowerCase() || null;
  if (trustedCfHeader && fromCfEmail) {
    return {
      sub: fromCfEmail,
      email: fromCfEmail,
      userId: fromCfEmail,
      tokenSource: 'cf-access-email-header'
    };
  }

  const token = c.req.header('cf-access-jwt-assertion')?.trim() || readBearer(c.req);
  if (!token) return required ? null : null;

  const parsed = parseJwt(token);
  if (!parsed) return null;

  if (c.env.ACCESS_JWT_HS256_SECRET) {
    const ok = await verifyHs256(token, c.env.ACCESS_JWT_HS256_SECRET);
    if (!ok) return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = toUnix(parsed.payload.exp);
  if (exp !== null && exp <= nowSec) return null;

  const requiredIss = c.env.ACCESS_JWT_ISS?.trim();
  const iss = typeof parsed.payload.iss === 'string' ? parsed.payload.iss : undefined;
  if (requiredIss && iss !== requiredIss) return null;

  const requiredAud = c.env.ACCESS_JWT_AUD?.trim();
  const aud = normalizeAud(parsed.payload.aud);
  if (requiredAud && aud !== requiredAud) return null;

  const sub = typeof parsed.payload.sub === 'string' ? parsed.payload.sub.trim() : '';
  const emailClaim = typeof parsed.payload.email === 'string' ? parsed.payload.email.trim().toLowerCase() : '';
  const userId = emailClaim || sub;
  if (!userId) return null;

  return {
    sub: sub || userId,
    email: emailClaim || null,
    userId,
    issuer: iss,
    audience: aud,
    tokenSource: c.req.header('cf-access-jwt-assertion') ? 'cf-access-jwt-assertion' : 'authorization-bearer'
  };
}

export const accessJwtMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: { auth?: AccessIdentity } }> = async (
  c,
  next
) => {
  const required = c.env.ACCESS_AUTH_REQUIRED !== '0';
  const identity = await resolveAccessIdentity(c);

  if (!identity && required) {
    return unauthorized('unauthorized: missing or invalid access jwt');
  }

  if (identity) c.set('auth', identity);
  await next();
};
