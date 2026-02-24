#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const BASE_URL = (process.env.P24_BASE_URL ?? 'http://127.0.0.1:8791').replace(/\/$/, '');
const OUT_DIR = path.resolve(process.env.P24_OUT_DIR ?? 'reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency');
const ITERATIONS = Number(process.env.P24_R5_ITERATIONS ?? 12);
const TIMEOUT_MS = Number(process.env.P24_R5_TIMEOUT_MS ?? 5000);
const POLL_MS = Number(process.env.P24_R5_POLL_MS ?? 100);
const USER_PREFIX = process.env.P24_R5_USER_PREFIX ?? 'r5-webpwa';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))] ?? null;
}

async function requestJson(method, urlPath, { body, headers = {} } = {}) {
  const started = performance.now();
  const response = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
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
    json
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const samples = [];
  const runLogs = [];

  for (let i = 0; i < ITERATIONS; i += 1) {
    const userId = `${USER_PREFIX}-${i}`;
    const marker = String(910000 + i).slice(-6);

    await requestJson('PUT', `/api/v2/self-selects?userId=${userId}`, {
      headers: { 'x-session-id': `web-init-${i}` },
      body: { symbols: ['000001', '600519'] }
    });

    const started = performance.now();
    const writeResult = await requestJson('PUT', `/api/v2/self-selects?userId=${userId}`, {
      headers: { 'x-session-id': `web-write-${i}` },
      body: { symbols: ['000001', '600519', marker] }
    });

    let syncObserved = false;
    let pollCount = 0;
    let readStatus = 0;

    while (!syncObserved && performance.now() - started < TIMEOUT_MS) {
      const readResult = await requestJson('GET', `/api/v2/self-selects?userId=${userId}`, {
        headers: { 'x-session-id': `pwa-read-${i}` }
      });
      pollCount += 1;
      readStatus = readResult.status;

      const symbols = Array.isArray(readResult.json?.symbols) ? readResult.json.symbols : [];
      if (readResult.ok && symbols.includes(marker)) {
        syncObserved = true;
        break;
      }

      await sleep(POLL_MS);
    }

    const syncLatencyMs = Number((performance.now() - started).toFixed(3));

    const row = {
      iteration: i,
      userId,
      marker,
      writeOk: writeResult.ok,
      writeStatus: writeResult.status,
      readStatus,
      syncObserved,
      syncLatencyMs,
      pollCount
    };
    samples.push(row);
    runLogs.push(
      `[${new Date().toISOString()}] i=${i} web-write -> pwa-read observed=${syncObserved} latencyMs=${syncLatencyMs} polls=${pollCount}`
    );
  }

  const latencies = samples.map((item) => item.syncLatencyMs);
  const success = samples.filter((item) => item.writeOk && item.syncObserved).length;

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    scenario: 'web-write-to-pwa-visible-latency',
    iterations: ITERATIONS,
    pollMs: POLL_MS,
    timeoutMs: TIMEOUT_MS,
    success,
    successRate: ITERATIONS ? success / ITERATIONS : 0,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    maxMs: percentile(latencies, 100),
    samples
  };

  const jsonFile = path.join(OUT_DIR, 'web-pwa-sync-latency.json');
  const logFile = path.join(OUT_DIR, 'web-pwa-sync-latency.log');
  const csvFile = path.join(OUT_DIR, 'sync-latency-samples.csv');

  const csvRows = [
    'iteration,userId,marker,writeOk,writeStatus,readStatus,syncObserved,syncLatencyMs,pollCount',
    ...samples.map((item) =>
      [
        item.iteration,
        item.userId,
        item.marker,
        item.writeOk,
        item.writeStatus,
        item.readStatus,
        item.syncObserved,
        item.syncLatencyMs,
        item.pollCount
      ].join(',')
    )
  ];

  await writeFile(jsonFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(logFile, `${runLogs.join('\n')}\n`, 'utf8');
  await writeFile(csvFile, `${csvRows.join('\n')}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        jsonFile,
        logFile,
        csvFile,
        success,
        iterations: ITERATIONS,
        p95Ms: summary.p95Ms
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
