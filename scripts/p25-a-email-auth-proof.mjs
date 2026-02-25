#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = (process.env.P25_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const OUT_DIR = path.resolve(process.env.P25_OUT_DIR ?? 'reports/lighthouse/P2.5_A/raw/r1_1-v2');
const SECRET = process.env.ACCESS_JWT_HS256_SECRET ?? process.env.P25_JWT_SECRET ?? 'dev-jwt-secret';
const AUD = process.env.ACCESS_JWT_AUD?.trim() || '';
const ISS = process.env.ACCESS_JWT_ISS?.trim() || '';

const nowIsoTag = new Date().toISOString().replace(/[:.]/g, '-');
const testEmail = `p25-v2-${Date.now()}@example.com`;
const testPassword = 'P25v2-demo-Password!123';
const wrongPassword = 'wrong-password-123';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signJwt(payload, secret = SECRET) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

async function call(pathname, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;

  const startedAt = performance.now();
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let json = null;
  let text = '';
  try {
    json = await res.json();
  } catch {
    text = await res.text().catch(() => '');
  }

  return {
    path: pathname,
    method,
    status: res.status,
    ok: res.ok,
    latencyMs: Number((performance.now() - startedAt).toFixed(3)),
    json,
    text
  };
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  const steps = [];

  // 1) 邮箱认证接口（登录/注册/忘记密码）
  steps.push({ name: 'register-invalid-email', result: await call('/api/v2/auth/register', { method: 'POST', body: { email: 'bad', password: '12345678' } }) });
  steps.push({ name: 'register-short-password', result: await call('/api/v2/auth/register', { method: 'POST', body: { email: testEmail, password: '123' } }) });

  const registerOk = await call('/api/v2/auth/register', {
    method: 'POST',
    body: { email: testEmail, password: testPassword }
  });
  steps.push({ name: 'register-success', result: registerOk });

  const loginFail = await call('/api/v2/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: wrongPassword }
  });
  steps.push({ name: 'login-wrong-password', result: loginFail });

  const loginOk = await call('/api/v2/auth/login', {
    method: 'POST',
    body: { email: testEmail, password: testPassword }
  });
  steps.push({ name: 'login-success', result: loginOk });

  const forgotInvalid = await call('/api/v2/auth/forgot-password', {
    method: 'POST',
    body: { email: 'bad-email' }
  });
  steps.push({ name: 'forgot-invalid-email', result: forgotInvalid });

  const forgotOk = await call('/api/v2/auth/forgot-password', {
    method: 'POST',
    body: { email: testEmail }
  });
  steps.push({ name: 'forgot-success', result: forgotOk });

  // 2) JWT + 受保护 self-select 链路（成功/失败/边界）
  const bearer = loginOk.json?.accessToken;

  steps.push({ name: 'self-select-no-token', result: await call('/api/v2/self-selects') });

  const putOk = await call('/api/v2/self-selects', {
    method: 'PUT',
    token: bearer,
    body: { symbols: ['000001', '600519', '000001'] }
  });
  steps.push({ name: 'self-select-put-with-login-token', result: putOk });

  const getOk = await call('/api/v2/self-selects', { token: bearer });
  steps.push({ name: 'self-select-get-with-login-token', result: getOk });

  const boundarySubOnlyToken = signJwt({
    sub: testEmail,
    exp: Math.floor(Date.now() / 1000) + 300,
    ...(ISS ? { iss: ISS } : {}),
    ...(AUD ? { aud: AUD } : {})
  });
  steps.push({
    name: 'self-select-boundary-sub-only-token',
    result: await call('/api/v2/self-selects', { token: boundarySubOnlyToken })
  });

  const expiredToken = signJwt({
    sub: testEmail,
    email: testEmail,
    exp: Math.floor(Date.now() / 1000) - 10,
    ...(ISS ? { iss: ISS } : {}),
    ...(AUD ? { aud: AUD } : {})
  });
  steps.push({ name: 'self-select-expired-token', result: await call('/api/v2/self-selects', { token: expiredToken }) });

  const badSigToken = signJwt(
    {
      sub: testEmail,
      email: testEmail,
      exp: Math.floor(Date.now() / 1000) + 300,
      ...(ISS ? { iss: ISS } : {}),
      ...(AUD ? { aud: AUD } : {})
    },
    'wrong-secret'
  );
  steps.push({ name: 'self-select-invalid-signature-token', result: await call('/api/v2/self-selects', { token: badSigToken }) });

  if (AUD) {
    const wrongAudToken = signJwt({
      sub: testEmail,
      email: testEmail,
      aud: `${AUD}-wrong`,
      exp: Math.floor(Date.now() / 1000) + 300,
      ...(ISS ? { iss: ISS } : {})
    });
    steps.push({ name: 'self-select-aud-mismatch-token', result: await call('/api/v2/self-selects', { token: wrongAudToken }) });
  }

  const clearListBoundary = await call('/api/v2/self-selects', {
    method: 'PUT',
    token: bearer,
    body: { symbols: [] }
  });
  steps.push({ name: 'self-select-boundary-clear-empty-array', result: clearListBoundary });

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    email: testEmail,
    env: {
      accessJwtAudConfigured: Boolean(AUD),
      accessJwtIssConfigured: Boolean(ISS)
    },
    pass: {
      registerSuccess: registerOk.status === 200 && Boolean(registerOk.json?.accessToken),
      loginSuccess: loginOk.status === 200 && Boolean(loginOk.json?.accessToken),
      forgotSuccess: forgotOk.status === 200 && forgotOk.json?.accepted === true,
      selfSelectProtected: steps.find((s) => s.name === 'self-select-no-token')?.result.status === 401,
      selfSelectJwtSuccess: putOk.status === 200 && getOk.status === 200,
      selfSelectJwtExpiredRejected: steps.find((s) => s.name === 'self-select-expired-token')?.result.status === 401,
      selfSelectJwtBadSigRejected: steps.find((s) => s.name === 'self-select-invalid-signature-token')?.result.status === 401,
      subOnlyTokenAccepted: steps.find((s) => s.name === 'self-select-boundary-sub-only-token')?.result.status === 200,
      clearBoundaryAccepted: clearListBoundary.status === 200
    },
    steps
  };

  const outFile = path.join(OUT_DIR, `p25-a-email-auth-proof-${nowIsoTag}.json`);
  const latestFile = path.join(OUT_DIR, 'p25-a-email-auth-proof-latest.json');

  await writeFile(outFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(latestFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        outFile,
        latestFile,
        summary: summary.pass
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
