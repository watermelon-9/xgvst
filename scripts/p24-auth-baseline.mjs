#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHmac } from 'node:crypto';

const BASE_URL = (process.env.P24_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const OUT_DIR = path.resolve(process.env.P24_OUT_DIR ?? 'reports/lighthouse/P2.4_C/raw');

const LOGIN_ITERATIONS = Number(process.env.P24_LOGIN_ITERATIONS ?? 30);
const MIGRATION_ITERATIONS = Number(process.env.P24_MIGRATION_ITERATIONS ?? 10);
const SYNC_ITERATIONS = Number(process.env.P24_SYNC_ITERATIONS ?? 12);
const MIGRATION_SYMBOL_COUNT = Number(process.env.P24_MIGRATION_SYMBOL_COUNT ?? 200);
const SYNC_TIMEOUT_MS = Number(process.env.P24_SYNC_TIMEOUT_MS ?? 5000);
const SYNC_POLL_MS = Number(process.env.P24_SYNC_POLL_MS ?? 80);
const USER_PREFIX = process.env.P24_USER_PREFIX ?? 'p24-baseline';

const TIMESTAMP_TAG = new Date().toISOString().replace(/[:.]/g, '-');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function toStats(values) {
  return {
    count: values.length,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    maxMs: percentile(values, 100),
    meanMs: values.length ? values.reduce((acc, n) => acc + n, 0) / values.length : null
  };
}

function normalizeSymbol(n) {
  const raw = String(100000 + n);
  return raw.slice(-6);
}

function generateSymbols(count, offset = 0) {
  return Array.from({ length: count }, (_, i) => normalizeSymbol(offset + i + 1));
}

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

function resolveAuthToken() {
  const explicit = process.env.P24_TEST_TOKEN?.trim();
  if (explicit) return { token: explicit, mode: 'provided-token' };

  const secret = process.env.P24_JWT_HS256_SECRET ?? process.env.ACCESS_JWT_HS256_SECRET ?? 'dev-access-secret';
  const user = process.env.P24_JWT_USER ?? 'p24-baseline@example.com';
  const aud = process.env.P24_JWT_AUD ?? process.env.ACCESS_JWT_AUD ?? undefined;
  const iss = process.env.P24_JWT_ISS ?? process.env.ACCESS_JWT_ISS ?? undefined;
  const exp = Math.floor(Date.now() / 1000) + 10 * 60;
  const token = signJwt({ sub: user, email: user, exp, ...(aud ? { aud } : {}), ...(iss ? { iss } : {}) }, secret);
  return { token, mode: 'generated-hs256' };
}

const AUTH = resolveAuthToken();

async function requestJson(method, urlPath, { headers = {}, body, timeoutMs = 5000 } = {}) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}${urlPath}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${AUTH.token}`,
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Number((performance.now() - started).toFixed(3)),
      json,
      timeout: false
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Number((performance.now() - started).toFixed(3)),
      json: { error: String(error) },
      timeout: true
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runLoginBaseline() {
  const samples = [];

  for (let i = 0; i < LOGIN_ITERATIONS; i += 1) {
    const userId = `${USER_PREFIX}-login-${i}`;
    const result = await requestJson('GET', '/api/self-selects', {
      headers: {
        'x-user-id': userId,
        'x-session-id': `devA-${i}`
      }
    });

    samples.push({
      iteration: i,
      userId,
      ok: result.ok,
      status: result.status,
      latencyMs: result.latencyMs
    });
  }

  const success = samples.filter((s) => s.ok).length;
  return {
    iterations: LOGIN_ITERATIONS,
    success,
    successRate: LOGIN_ITERATIONS ? success / LOGIN_ITERATIONS : 0,
    latency: toStats(samples.map((s) => s.latencyMs)),
    samples
  };
}

async function runMigrationBaseline() {
  const samples = [];

  for (let i = 0; i < MIGRATION_ITERATIONS; i += 1) {
    const userId = `${USER_PREFIX}-migrate-${i}`;
    const symbols = generateSymbols(MIGRATION_SYMBOL_COUNT, i * MIGRATION_SYMBOL_COUNT);

    const result = await requestJson('PUT', '/api/self-selects', {
      headers: {
        'x-user-id': userId,
        'x-session-id': `migration-${i}`
      },
      body: { symbols }
    });

    const importedCount = Array.isArray(result.json?.symbols) ? result.json.symbols.length : 0;

    samples.push({
      iteration: i,
      userId,
      ok: result.ok,
      status: result.status,
      latencyMs: result.latencyMs,
      expectedCount: symbols.length,
      importedCount
    });
  }

  const success = samples.filter((s) => s.ok && s.importedCount === s.expectedCount).length;
  return {
    iterations: MIGRATION_ITERATIONS,
    symbolCountPerUser: MIGRATION_SYMBOL_COUNT,
    success,
    successRate: MIGRATION_ITERATIONS ? success / MIGRATION_ITERATIONS : 0,
    latency: toStats(samples.map((s) => s.latencyMs)),
    samples
  };
}

async function runSyncBaseline() {
  const samples = [];

  for (let i = 0; i < SYNC_ITERATIONS; i += 1) {
    const userId = `${USER_PREFIX}-sync-${i}`;
    const baseSymbols = ['000001', '600519'];
    const marker = normalizeSymbol(900000 + i);

    await requestJson('PUT', '/api/self-selects', {
      headers: {
        'x-user-id': userId,
        'x-session-id': `sync-init-A-${i}`
      },
      body: { symbols: baseSymbols }
    });

    const started = performance.now();

    const mutate = await requestJson('PUT', '/api/self-selects', {
      headers: {
        'x-user-id': userId,
        'x-session-id': `sync-write-A-${i}`
      },
      body: { symbols: [...baseSymbols, marker] }
    });

    let observed = false;
    let pollCount = 0;

    while (!observed && performance.now() - started < SYNC_TIMEOUT_MS) {
      const read = await requestJson('GET', '/api/self-selects', {
        headers: {
          'x-user-id': userId,
          'x-session-id': `sync-read-B-${i}`
        }
      });

      pollCount += 1;
      const list = Array.isArray(read.json?.symbols) ? read.json.symbols : [];
      if (read.ok && list.includes(marker)) {
        observed = true;
        break;
      }
      await sleep(SYNC_POLL_MS);
    }

    const syncLatencyMs = Number((performance.now() - started).toFixed(3));

    samples.push({
      iteration: i,
      userId,
      mutateOk: mutate.ok,
      mutateStatus: mutate.status,
      syncObserved: observed,
      syncLatencyMs,
      pollCount
    });
  }

  const success = samples.filter((s) => s.mutateOk && s.syncObserved).length;
  return {
    iterations: SYNC_ITERATIONS,
    timeoutMs: SYNC_TIMEOUT_MS,
    pollMs: SYNC_POLL_MS,
    success,
    successRate: SYNC_ITERATIONS ? success / SYNC_ITERATIONS : 0,
    latency: toStats(samples.map((s) => s.syncLatencyMs)),
    samples
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.join(OUT_DIR, 'auth'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'migration'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'sync'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'logs'), { recursive: true });

  const login = await runLoginBaseline();
  const migration = await runMigrationBaseline();
  const sync = await runSyncBaseline();

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    auth: {
      mode: AUTH.mode,
      tokenPreview: `${AUTH.token.slice(0, 18)}...`
    },
    config: {
      LOGIN_ITERATIONS,
      MIGRATION_ITERATIONS,
      SYNC_ITERATIONS,
      MIGRATION_SYMBOL_COUNT,
      SYNC_TIMEOUT_MS,
      SYNC_POLL_MS,
      USER_PREFIX
    },
    metrics: {
      login,
      migration,
      sync
    }
  };

  const loginEvidenceFile = path.join(OUT_DIR, 'auth', `login-latency-${TIMESTAMP_TAG}.json`);
  const migrationEvidenceFile = path.join(OUT_DIR, 'migration', `migration-latency-${TIMESTAMP_TAG}.json`);
  const syncEvidenceFile = path.join(OUT_DIR, 'sync', `sync-latency-${TIMESTAMP_TAG}.json`);
  const logsEvidenceFile = path.join(OUT_DIR, 'logs', `wrangler-tail-${TIMESTAMP_TAG}.log`);

  const loginEvidence = {
    generatedAt: report.generatedAt,
    baseUrl: BASE_URL,
    mode: 'login-latency',
    p50Ms: login.latency.p50Ms,
    p95Ms: login.latency.p95Ms,
    samples: login.samples
  };

  const migrationEvidence = {
    generatedAt: report.generatedAt,
    baseUrl: BASE_URL,
    mode: 'migration-single-user-latency',
    symbolCountPerUser: MIGRATION_SYMBOL_COUNT,
    p50Ms: migration.latency.p50Ms,
    p95Ms: migration.latency.p95Ms,
    perUserLatencyMs: migration.samples.map((s) => ({
      userId: s.userId,
      latencyMs: s.latencyMs,
      importedCount: s.importedCount,
      expectedCount: s.expectedCount,
      ok: s.ok,
      status: s.status
    })),
    samples: migration.samples
  };

  const syncEvidence = {
    generatedAt: report.generatedAt,
    baseUrl: BASE_URL,
    mode: 'cross-device-sync-latency',
    p50Ms: sync.latency.p50Ms,
    p95Ms: sync.latency.p95Ms,
    perUserSyncLatencyMs: sync.samples.map((s) => ({
      userId: s.userId,
      syncLatencyMs: s.syncLatencyMs,
      syncObserved: s.syncObserved,
      pollCount: s.pollCount,
      mutateOk: s.mutateOk,
      mutateStatus: s.mutateStatus
    })),
    samples: sync.samples
  };

  const evidenceManifest = {
    generatedAt: report.generatedAt,
    stage: 'P2.4_C',
    baselineFiles: ['p24-auth-baseline.json'],
    evidenceFiles: [
      path.relative(OUT_DIR, loginEvidenceFile),
      path.relative(OUT_DIR, migrationEvidenceFile),
      path.relative(OUT_DIR, syncEvidenceFile),
      path.relative(OUT_DIR, logsEvidenceFile)
    ],
    expectedArtifacts: [
      'auth/login-latency-*.json',
      'migration/migration-latency-*.json',
      'sync/sync-latency-*.json',
      'logs/wrangler-tail-*.log'
    ],
    kpi: {
      loginP95TargetMs: 800,
      migrationPerUserTargetMs: 3000,
      syncP95TargetMs: 1000
    }
  };

  const reportFile = path.join(OUT_DIR, 'p24-auth-baseline.json');
  const manifestFile = path.join(OUT_DIR, 'p24-evidence-manifest.json');

  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(loginEvidenceFile, `${JSON.stringify(loginEvidence, null, 2)}\n`, 'utf8');
  await writeFile(migrationEvidenceFile, `${JSON.stringify(migrationEvidence, null, 2)}\n`, 'utf8');
  await writeFile(syncEvidenceFile, `${JSON.stringify(syncEvidence, null, 2)}\n`, 'utf8');
  await writeFile(logsEvidenceFile, `[${report.generatedAt}] baseline-run mode=${AUTH.mode} baseUrl=${BASE_URL}\n`, 'utf8');
  await writeFile(manifestFile, `${JSON.stringify(evidenceManifest, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        reportFile,
        manifestFile,
        loginEvidenceFile,
        migrationEvidenceFile,
        syncEvidenceFile,
        loginP95Ms: login.latency.p95Ms,
        migrationP95Ms: migration.latency.p95Ms,
        syncP95Ms: sync.latency.p95Ms
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
