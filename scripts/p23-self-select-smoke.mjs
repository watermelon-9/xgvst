#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const baseUrl = (process.env.BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const userId = process.env.USER_ID ?? `p23-smoke-${Date.now()}`;
const reportPath = resolve(
  process.env.OUT_PATH ?? `reports/lighthouse/P2.3_A/raw/self-select-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
);

async function request(method, path, body) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-user-id': userId
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
    method,
    path,
    status: response.status,
    ok: response.ok,
    latencyMs: Number((performance.now() - started).toFixed(2)),
    body: json
  };
}

const steps = [];
steps.push(await request('GET', '/api/self-selects', null));
steps.push(await request('PUT', '/api/self-selects', { symbols: ['000001', '600519'] })); // 改（全量覆盖）
steps.push(await request('POST', '/api/self-selects', { symbol: '300750' })); // 增
steps.push(await request('GET', '/api/self-selects', null)); // 查
steps.push(await request('DELETE', '/api/self-selects/600519', null)); // 删
steps.push(await request('PUT', '/api/self-selects', { symbols: ['000001', '000858'] })); // 改
steps.push(await request('GET', '/api/self-selects', null)); // 查
steps.push(await request('GET', '/api/self-selects/history?limit=50', null)); // history
steps.push(await request('GET', '/api/infra/storage-metrics', null));

const failed = steps.filter((step) => !step.ok);
const report = {
  ok: failed.length === 0,
  baseUrl,
  userId,
  ts: new Date().toISOString(),
  failedCount: failed.length,
  steps
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (!report.ok) {
  console.error(`[p23-self-select-smoke] failed=${failed.length} report=${reportPath}`);
  process.exitCode = 1;
} else {
  console.log(`[p23-self-select-smoke] ok report=${reportPath}`);
}
