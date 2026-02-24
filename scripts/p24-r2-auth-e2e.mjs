#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const WORKERS_DIR = path.join(ROOT, 'packages/workers');
const OUT_DIR = path.join(ROOT, 'reports/lighthouse/P2.4_A/raw');
const OUT_FILE = path.join(OUT_DIR, 'r2-auth-e2e-matrix.json');

const HOST = '127.0.0.1';
const START_PORT = Number(process.env.P24_R2_START_PORT ?? 8890);
const ENDPOINTS = ['/api/self-selects', '/api/v2/self-selects'];
const DEFAULT_SECRET = 'dev-access-secret';

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

function buildToken(overrides = {}, signSecret = DEFAULT_SECRET) {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'p24-r2@example.com',
    email: 'p24-r2@example.com',
    exp: nowSec + 600,
    ...overrides
  };
  return signJwt(payload, signSecret);
}

async function requestJson(url, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(url, { method: 'GET', headers });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, ok: response.ok, json };
}

async function waitForServer(baseUrl, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function toVarArgs(vars) {
  const args = [];
  for (const [k, v] of Object.entries(vars)) {
    args.push('--var', `${k}:${v ?? ''}`);
  }
  return args;
}

function spawnWrangler(port, vars) {
  const args = [
    'pnpm',
    'exec',
    'wrangler',
    'dev',
    '--local',
    '--ip',
    HOST,
    '--port',
    String(port),
    '--persist-to',
    '.wrangler/state',
    '--log-level',
    'error',
    ...toVarArgs(vars)
  ];

  return spawn('corepack', args, {
    cwd: WORKERS_DIR,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function runScenario(scenario, index) {
  const port = START_PORT + index;
  const baseUrl = `http://${HOST}:${port}`;
  const proc = spawnWrangler(port, scenario.vars);

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => {
    stdout += d.toString();
  });
  proc.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  try {
    const ready = await waitForServer(baseUrl);
    if (!ready) {
      throw new Error(`wrangler dev not ready @${baseUrl}`);
    }

    const goodToken = scenario.goodToken();
    const probeToken = scenario.probeToken();

    const endpointResults = [];
    for (const endpoint of ENDPOINTS) {
      const noToken = await requestJson(`${baseUrl}${endpoint}`, null);
      const good = await requestJson(`${baseUrl}${endpoint}`, goodToken);
      const probe = await requestJson(`${baseUrl}${endpoint}`, probeToken);
      endpointResults.push({ endpoint, noToken, good, probe });
    }

    const checks = endpointResults.flatMap((item) => [
      item.noToken.status === 401,
      item.good.status === 200,
      item.probe.status === scenario.expectedProbeStatus
    ]);

    return {
      name: scenario.name,
      description: scenario.description,
      vars: scenario.vars,
      expected: {
        noToken: 401,
        goodToken: 200,
        probeToken: scenario.expectedProbeStatus
      },
      pass: checks.every(Boolean),
      endpointResults
    };
  } finally {
    proc.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!proc.killed) proc.kill('SIGKILL');

    if (stdout.trim() || stderr.trim()) {
      const logFile = path.join(OUT_DIR, `r2-auth-e2e-${scenario.name}.log`);
      await writeFile(logFile, `# stdout\n${stdout}\n\n# stderr\n${stderr}\n`, 'utf8');
    }
  }
}

const scenarios = [
  {
    name: 'exp-off-no-claim',
    description: 'exp不提供时，不触发过期拒绝（路径可关闭）',
    vars: {
      ACCESS_AUTH_REQUIRED: '1',
      ACCESS_TRUST_CF_HEADERS: '0',
      ACCESS_JWT_ISS: '',
      ACCESS_JWT_AUD: '',
      ACCESS_JWT_HS256_SECRET: ''
    },
    goodToken: () => buildToken(),
    probeToken: () => buildToken({ exp: undefined }),
    expectedProbeStatus: 200
  },
  {
    name: 'exp-on-expired',
    description: 'exp过期时拒绝',
    vars: {
      ACCESS_AUTH_REQUIRED: '1',
      ACCESS_TRUST_CF_HEADERS: '0',
      ACCESS_JWT_ISS: '',
      ACCESS_JWT_AUD: '',
      ACCESS_JWT_HS256_SECRET: ''
    },
    goodToken: () => buildToken(),
    probeToken: () => buildToken({ exp: Math.floor(Date.now() / 1000) - 30 }),
    expectedProbeStatus: 401
  },
  {
    name: 'iss-off-mismatch',
    description: 'iss未配置时，iss不匹配不拒绝（路径可关闭）',
    vars: {
      ACCESS_AUTH_REQUIRED: '1',
      ACCESS_TRUST_CF_HEADERS: '0',
      ACCESS_JWT_ISS: '',
      ACCESS_JWT_AUD: '',
      ACCESS_JWT_HS256_SECRET: ''
    },
    goodToken: () => buildToken({ iss: 'trusted-issuer' }),
    probeToken: () => buildToken({ iss: 'mismatch-issuer' }),
    expectedProbeStatus: 200
  },
  {
    name: 'iss-on-mismatch',
    description: 'iss配置后，iss不匹配被拒绝',
    vars: {
      ACCESS_AUTH_REQUIRED: '1',
      ACCESS_TRUST_CF_HEADERS: '0',
      ACCESS_JWT_ISS: 'trusted-issuer',
      ACCESS_JWT_AUD: '',
      ACCESS_JWT_HS256_SECRET: ''
    },
    goodToken: () => buildToken({ iss: 'trusted-issuer' }),
    probeToken: () => buildToken({ iss: 'mismatch-issuer' }),
    expectedProbeStatus: 401
  },
  {
    name: 'aud-off-mismatch',
    description: 'aud未配置时，aud不匹配不拒绝（路径可关闭）',
    vars: {
      ACCESS_AUTH_REQUIRED: '1',
      ACCESS_TRUST_CF_HEADERS: '0',
      ACCESS_JWT_ISS: '',
      ACCESS_JWT_AUD: '',
      ACCESS_JWT_HS256_SECRET: ''
    },
    goodToken: () => buildToken({ aud: 'trusted-aud' }),
    probeToken: () => buildToken({ aud: 'mismatch-aud' }),
    expectedProbeStatus: 200
  },
  {
    name: 'aud-on-mismatch',
    description: 'aud配置后，aud不匹配被拒绝',
    vars: {
      ACCESS_AUTH_REQUIRED: '1',
      ACCESS_TRUST_CF_HEADERS: '0',
      ACCESS_JWT_ISS: '',
      ACCESS_JWT_AUD: 'trusted-aud',
      ACCESS_JWT_HS256_SECRET: ''
    },
    goodToken: () => buildToken({ aud: 'trusted-aud' }),
    probeToken: () => buildToken({ aud: 'mismatch-aud' }),
    expectedProbeStatus: 401
  },
  {
    name: 'hs256-off-wrong-signature',
    description: '未配置HS256 secret时，错误签名不拒绝（本地验签路径可关闭）',
    vars: {
      ACCESS_AUTH_REQUIRED: '1',
      ACCESS_TRUST_CF_HEADERS: '0',
      ACCESS_JWT_ISS: '',
      ACCESS_JWT_AUD: '',
      ACCESS_JWT_HS256_SECRET: ''
    },
    goodToken: () => buildToken({}, DEFAULT_SECRET),
    probeToken: () => buildToken({}, 'wrong-secret'),
    expectedProbeStatus: 200
  },
  {
    name: 'hs256-on-wrong-signature',
    description: '配置HS256 secret后，错误签名被拒绝',
    vars: {
      ACCESS_AUTH_REQUIRED: '1',
      ACCESS_TRUST_CF_HEADERS: '0',
      ACCESS_JWT_ISS: '',
      ACCESS_JWT_AUD: '',
      ACCESS_JWT_HS256_SECRET: DEFAULT_SECRET
    },
    goodToken: () => buildToken({}, DEFAULT_SECRET),
    probeToken: () => buildToken({}, 'wrong-secret'),
    expectedProbeStatus: 401
  }
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const results = [];
  for (let i = 0; i < scenarios.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runScenario(scenarios[i], i);
    results.push(result);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    endpoints: ENDPOINTS,
    scenarioCount: scenarios.length,
    passCount: results.filter((r) => r.pass).length,
    results
  };

  await writeFile(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, outFile: OUT_FILE, passCount: report.passCount, total: report.scenarioCount }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
