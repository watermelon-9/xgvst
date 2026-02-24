#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const WORKERS_DIR = path.join(ROOT, 'packages/workers');
const OUT_DIR = path.join(ROOT, 'reports/lighthouse/P2.4_A/raw');
const OUT_FILE = path.join(OUT_DIR, 'r5-auth-dual-mode.json');

const HOST = '127.0.0.1';
const PORT = Number(process.env.P24_R5_PORT ?? 8899);
const BASE_URL = `http://${HOST}:${PORT}`;
const SECRET = process.env.ACCESS_JWT_HS256_SECRET || 'dev-access-secret';
const USER = process.env.P24_R5_USER || 'p24-r5@example.com';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(`${BASE_URL}/health`);
      if (r.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function request(pathname, headers = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: 'GET',
    headers
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // noop
  }
  return { status: res.status, ok: res.ok, json };
}

function spawnWrangler() {
  const args = [
    'pnpm',
    'exec',
    'wrangler',
    'dev',
    '--local',
    '--ip',
    HOST,
    '--port',
    String(PORT),
    '--persist-to',
    '.wrangler/state',
    '--log-level',
    'error',
    '--var',
    'ACCESS_AUTH_REQUIRED:1',
    '--var',
    'ACCESS_TRUST_CF_HEADERS:1',
    '--var',
    'ACCESS_JWT_HS256_SECRET:dev-access-secret',
    '--var',
    'ACCESS_JWT_ISS:',
    '--var',
    'ACCESS_JWT_AUD:'
  ];

  return spawn('corepack', args, {
    cwd: WORKERS_DIR,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const proc = spawnWrangler();
  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => (stdout += d.toString()));
  proc.stderr.on('data', (d) => (stderr += d.toString()));

  try {
    const ready = await waitForServer();
    if (!ready) throw new Error('wrangler dev not ready');

    const exp = Math.floor(Date.now() / 1000) + 600;
    const token = signJwt({ sub: USER, email: USER, exp }, SECRET);

    const cases = [
      {
        name: 'unauthorized-no-token',
        headers: {},
        expectedStatus: 401,
        mode: 'none'
      },
      {
        name: 'jwt-authorization-bearer',
        headers: { authorization: `Bearer ${token}` },
        expectedStatus: 200,
        mode: 'jwt-bearer'
      },
      {
        name: 'access-cf-access-jwt-assertion',
        headers: { 'cf-access-jwt-assertion': token },
        expectedStatus: 200,
        mode: 'access-jwt-assertion'
      },
      {
        name: 'access-cf-email-header-trusted',
        headers: { 'cf-access-authenticated-user-email': USER },
        expectedStatus: 200,
        mode: 'access-email-header'
      }
    ];

    const results = [];
    for (const item of cases) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request('/api/v2/self-selects', {
        'content-type': 'application/json',
        ...item.headers
      });
      results.push({ ...item, actualStatus: res.status, ok: res.ok, pass: res.status === item.expectedStatus, response: res.json });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      endpoint: '/api/v2/self-selects',
      user: USER,
      passCount: results.filter((x) => x.pass).length,
      total: results.length,
      allPass: results.every((x) => x.pass),
      results
    };

    await writeFile(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const logFile = path.join(OUT_DIR, 'r5-auth-dual-mode.log');
    await writeFile(logFile, `# stdout\n${stdout}\n\n# stderr\n${stderr}\n`, 'utf8');

    console.log(JSON.stringify({ ok: report.allPass, outFile: OUT_FILE, passCount: report.passCount, total: report.total }, null, 2));
    if (!report.allPass) process.exit(2);
  } finally {
    proc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    if (!proc.killed) proc.kill('SIGKILL');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
