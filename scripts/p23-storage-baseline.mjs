#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve(process.env.P23_OUT_DIR ?? 'reports/lighthouse/P2.3_C/raw');
const URL = process.env.P23_STORAGE_BENCH_URL ?? 'http://127.0.0.1:8787/api/debug/storage/bench';
const ITERATIONS = Number(process.env.P23_STORAGE_ITERATIONS ?? 30);
const VALUE_SIZE = Number(process.env.P23_STORAGE_VALUE_SIZE ?? 256);
const DEBUG_TOKEN = process.env.DEBUG_SOURCE_TOKEN ?? '';

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const startedAt = Date.now();
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(DEBUG_TOKEN ? { 'x-debug-token': DEBUG_TOKEN } : {})
    },
    body: JSON.stringify({ iterations: ITERATIONS, valueSize: VALUE_SIZE })
  });

  const rawText = await res.text();
  let body = null;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = null;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    url: URL,
    ok: Boolean(res.ok && body?.ok),
    httpStatus: res.status,
    body,
    rawText: body ? undefined : rawText
  };

  const file = path.join(OUT_DIR, 'p23-storage-baseline.json');
  await fs.writeFile(file, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: report.ok, file, httpStatus: report.httpStatus }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
