type Bindings = Env;

export type EmailAuthJwtPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PASSWORD_MIN_LEN = 8;
const DEFAULT_PBKDF2_ITERATIONS = 120_000;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 2 * 60 * 60;
const DEFAULT_RESET_TOKEN_TTL_SECONDS = 15 * 60;

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

function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function passwordMinLength(env: Bindings): number {
  const n = Number(env.AUTH_PASSWORD_MIN_LENGTH ?? DEFAULT_PASSWORD_MIN_LEN);
  if (!Number.isFinite(n)) return DEFAULT_PASSWORD_MIN_LEN;
  return Math.max(6, Math.min(64, Math.round(n)));
}

function pbkdf2Iterations(env: Bindings): number {
  const n = Number(env.AUTH_PBKDF2_ITERATIONS ?? DEFAULT_PBKDF2_ITERATIONS);
  if (!Number.isFinite(n)) return DEFAULT_PBKDF2_ITERATIONS;
  return Math.max(50_000, Math.min(600_000, Math.round(n)));
}

function accessTokenTtlSeconds(env: Bindings): number {
  const n = Number(env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS);
  if (!Number.isFinite(n)) return DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
  return Math.max(300, Math.min(7 * 24 * 60 * 60, Math.round(n)));
}

function resetTokenTtlSeconds(env: Bindings): number {
  const n = Number(env.AUTH_RESET_TOKEN_TTL_SECONDS ?? DEFAULT_RESET_TOKEN_TTL_SECONDS);
  if (!Number.isFinite(n)) return DEFAULT_RESET_TOKEN_TTL_SECONDS;
  return Math.max(300, Math.min(24 * 60 * 60, Math.round(n)));
}

function authPepper(env: Bindings): string {
  return env.AUTH_PASSWORD_PEPPER?.trim() || '';
}

function resetTokenPepper(env: Bindings): string {
  return env.AUTH_RESET_TOKEN_PEPPER?.trim() || '';
}

function unauthorizedJson(message: string, status = 401) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const cloned = new Uint8Array(bytes.byteLength);
  cloned.set(bytes);
  return cloned.buffer;
}

async function sha256Bytes(input: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(input));
  return new Uint8Array(digest);
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number, pepper = ''): Promise<Uint8Array> {
  const combined = `${password}${pepper}`;
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(combined)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations
    },
    key,
    32 * 8
  );

  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function ensureEmailAuthTables(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS auth_accounts (
        email TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_algo TEXT NOT NULL,
        password_iter INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT,
        reset_token_hash TEXT,
        reset_token_exp TEXT,
        reset_requested_at TEXT
      )`
    ),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_accounts_updated_at ON auth_accounts(updated_at DESC)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_accounts_reset_exp ON auth_accounts(reset_token_exp)')
  ]);
}

export async function hashPasswordForStorage(password: string, env: Bindings) {
  const iterations = pbkdf2Iterations(env);
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, iterations, authPepper(env));

  return {
    passwordHash: toBase64Url(hash),
    passwordSalt: toBase64Url(salt),
    passwordAlgo: 'pbkdf2-sha256',
    passwordIter: iterations
  };
}

export async function verifyPasswordAgainstStorage(
  password: string,
  storedHash: string,
  storedSalt: string,
  storedIterations: number,
  env: Bindings
): Promise<boolean> {
  if (!storedHash || !storedSalt || !Number.isFinite(storedIterations) || storedIterations <= 0) return false;

  const salt = fromBase64Url(storedSalt);
  const expectedHash = fromBase64Url(storedHash);
  const actualHash = await pbkdf2(password, salt, Math.round(storedIterations), authPepper(env));
  return constantTimeEqual(expectedHash, actualHash);
}

export async function hashResetTokenForStorage(rawToken: string, env: Bindings): Promise<string> {
  const input = new TextEncoder().encode(`${rawToken}${resetTokenPepper(env)}`);
  const digest = await sha256Bytes(input);
  return toBase64Url(digest);
}

export async function issueEmailAccessJwt(email: string, env: Bindings): Promise<string | null> {
  const secret = env.ACCESS_JWT_HS256_SECRET?.trim();
  if (!secret) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const payload: EmailAuthJwtPayload = {
    sub: email,
    email,
    iat: nowSec,
    exp: nowSec + accessTokenTtlSeconds(env),
    ...(env.ACCESS_JWT_ISS?.trim() ? { iss: env.ACCESS_JWT_ISS.trim() } : {}),
    ...(env.ACCESS_JWT_AUD?.trim() ? { aud: env.ACCESS_JWT_AUD.trim() } : {})
  };

  const headerEncoded = toBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadEncoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headerEncoded}.${payloadEncoded}`));
  const signature = toBase64Url(new Uint8Array(signed));
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

export type RegisterPayload = { email?: unknown; password?: unknown };
export type LoginPayload = { email?: unknown; password?: unknown };
export type ForgotPayload = { email?: unknown };

export function parseRegisterPayload(input: unknown): { email: string; password: string; error?: string } {
  const payload = (input ?? {}) as RegisterPayload;
  const email = normalizeEmail(payload.email);
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!validEmail(email)) return { email, password, error: 'invalid email' };
  return { email, password };
}

export function parseLoginPayload(input: unknown): { email: string; password: string; error?: string } {
  const payload = (input ?? {}) as LoginPayload;
  const email = normalizeEmail(payload.email);
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!validEmail(email)) return { email, password, error: 'invalid email' };
  return { email, password };
}

export function parseForgotPayload(input: unknown): { email: string; error?: string } {
  const payload = (input ?? {}) as ForgotPayload;
  const email = normalizeEmail(payload.email);
  if (!validEmail(email)) return { email, error: 'invalid email' };
  return { email };
}

export function validatePasswordStrength(password: string, env: Bindings): string | null {
  const minLen = passwordMinLength(env);
  if (!password) return 'password is required';
  if (password.length < minLen) return `password must be at least ${minLen} characters`;
  return null;
}

export function forgotDebugReturnToken(env: Bindings): boolean {
  return env.AUTH_FORGOT_DEBUG_RETURN_TOKEN === '1';
}

export function resetTokenExpiryIso(env: Bindings): string {
  return new Date(Date.now() + resetTokenTtlSeconds(env) * 1000).toISOString();
}

export function newResetToken(): string {
  return toBase64Url(randomBytes(24));
}

export function genericForgotResponse() {
  return {
    ok: true,
    accepted: true,
    message: 'If the email exists, reset instructions will be sent.'
  };
}

export function invalidAuthConfigResponse() {
  return unauthorizedJson('auth misconfigured: ACCESS_JWT_HS256_SECRET is required for email auth token issuing', 503);
}
