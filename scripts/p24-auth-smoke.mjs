#!/usr/bin/env node
import { createHmac } from 'node:crypto';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:8787';
const secret = process.env.ACCESS_JWT_HS256_SECRET || 'dev-access-secret';
const aud = process.env.ACCESS_JWT_AUD || undefined;
const iss = process.env.ACCESS_JWT_ISS || undefined;
const user = process.env.USER_ID || 'p24-smoke@example.com';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  return { status: res.status, ok: res.ok, json };
}

const exp = Math.floor(Date.now() / 1000) + 10 * 60;
const token = signJwt({ sub: user, email: user, exp, ...(aud ? { aud } : {}), ...(iss ? { iss } : {}) });

const steps = [];
steps.push(['unauthorized-check', await request('/api/v2/self-selects')]);
steps.push([
  'authorized-put',
  await request('/api/v2/self-selects', { method: 'PUT', token, body: { symbols: ['000001', '600519'] } })
]);
steps.push(['authorized-get', await request('/api/v2/self-selects', { token })]);
steps.push(['authorized-history', await request('/api/v2/self-selects/history?limit=10', { token })]);

const result = {
  ts: new Date().toISOString(),
  baseUrl,
  user,
  steps
};

console.log(JSON.stringify(result, null, 2));
