#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const endpoint = process.env.WS_URL ?? 'wss://xgvst-workers.viehh642.workers.dev/ws/quote';
const metricsEndpoint = process.env.METRICS_URL ?? 'https://xgvst-workers.viehh642.workers.dev/api/do/metrics';
const session = process.env.SESSION ?? `p22-min-${Date.now()}`;
const clients = Number(process.env.CLIENTS ?? 40);
const durationMs = Number(process.env.DURATION_MS ?? 8000);

const symbols = ['000001', '600519', '300750', '000858', '601318'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOne(index) {
  const symbol = symbols[index % symbols.length];
  const url = `${endpoint}?session=${encodeURIComponent(session)}`;

  return await new Promise((resolve) => {
    const stat = {
      index,
      symbol,
      opened: false,
      binaryFrames: 0,
      controlFrames: 0,
      errors: 0,
      closed: false,
      timeout: false
    };

    let ws;
    let settled = false;

    const finalize = () => {
      if (settled) return;
      settled = true;
      clearTimeout(closeTimer);
      clearTimeout(hardTimeout);
      resolve(stat);
    };

    try {
      ws = new WebSocket(url);
    } catch (error) {
      stat.errors += 1;
      resolve({ ...stat, error: String(error) });
      return;
    }

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      stat.opened = true;
      ws.send(JSON.stringify({ type: 'subscribe', symbols: [symbol] }));
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        stat.controlFrames += 1;
        return;
      }
      stat.binaryFrames += 1;
    };

    ws.onerror = () => {
      stat.errors += 1;
    };

    ws.onclose = () => {
      stat.closed = true;
      finalize();
    };

    const closeTimer = setTimeout(() => {
      try {
        ws.close(1000, 'done');
      } catch {
        finalize();
      }
    }, durationMs);

    const hardTimeout = setTimeout(() => {
      stat.timeout = true;
      try {
        ws.close(1001, 'hard-timeout');
      } catch {}
      finalize();
    }, durationMs + 4000);
  });
}

async function fetchMetrics() {
  const url = `${metricsEndpoint}?session=${encodeURIComponent(session)}`;
  const response = await fetch(url);
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, raw: text };
  }
}

async function main() {
  const outDir = path.resolve('reports/lighthouse/P2.2_A');
  await fs.mkdir(outDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const jobs = Array.from({ length: clients }, (_, i) => runOne(i));
  const results = await Promise.all(jobs);
  await sleep(600);

  const metrics = await fetchMetrics();
  const completedAt = new Date().toISOString();

  const summary = {
    startedAt,
    completedAt,
    endpoint,
    metricsEndpoint,
    session,
    clients,
    durationMs,
    opened: results.filter((item) => item.opened).length,
    closed: results.filter((item) => item.closed).length,
    errors: results.reduce((sum, item) => sum + item.errors, 0),
    binaryFrames: results.reduce((sum, item) => sum + item.binaryFrames, 0),
    controlFrames: results.reduce((sum, item) => sum + item.controlFrames, 0),
    doMetrics: metrics
  };

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  await fs.writeFile(path.join(outDir, `p22-do-min-load-${stamp}.json`), JSON.stringify({ summary, results }, null, 2));
  await fs.writeFile(path.join(outDir, 'p22-do-min-load-latest.json'), JSON.stringify({ summary, results }, null, 2));

  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});