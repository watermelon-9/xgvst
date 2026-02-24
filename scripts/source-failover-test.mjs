#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_WS_URL = process.env.WS_URL || 'wss://xgvst-workers.viehh642.workers.dev/ws/quote';
const SYMBOL = process.env.SYMBOL || '000001';
const DEADLINE_MS = Number(process.env.FAILOVER_DEADLINE_MS || 3000);
const CONNECT_TIMEOUT_MS = Number(process.env.CONNECT_TIMEOUT_MS || 8000);
const STATUS_POLL_MS = Number(process.env.STATUS_POLL_MS || 200);

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function wsToStatusUrl(wsUrl) {
  return wsUrl.replace(/^wss?:\/\//, (m) => (m === 'wss://' ? 'https://' : 'http://')).replace(/\/ws\/quote$/, '/api/source/status');
}

async function fetchStatus(statusUrl) {
  const res = await fetch(statusUrl, { headers: { accept: 'application/json' } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`status ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

async function run() {
  const wsUrl = DEFAULT_WS_URL;
  const statusUrl = wsToStatusUrl(wsUrl);
  const report = {
    generatedAt: nowIso(),
    wsUrl,
    statusUrl,
    symbol: SYMBOL,
    deadlineMs: DEADLINE_MS,
    connectTimeoutMs: CONNECT_TIMEOUT_MS,
    statusPollMs: STATUS_POLL_MS,
    before: null,
    after: null,
    events: [],
    assertions: {
      switchedWithinDeadline: false,
      failoverCountIncreased: false,
      observedSourceChange: false,
    },
  };

  let ws;
  let beforeStatus;
  let initialSource = null;
  let switchedAt = null;
  let switchedTo = null;
  let failoverSentAt = null;

  try {
    beforeStatus = await fetchStatus(statusUrl);
    report.before = beforeStatus;
  } catch (error) {
    report.events.push({ ts: nowIso(), type: 'status_before_error', error: String(error?.message || error) });
  }

  await new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timer = setTimeout(() => fail(new Error(`WebSocket connect timeout after ${CONNECT_TIMEOUT_MS}ms`)), CONNECT_TIMEOUT_MS);

    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      clearTimeout(timer);
      report.events.push({ ts: nowIso(), type: 'ws_open' });
      done();
    };
    ws.onerror = (event) => {
      clearTimeout(timer);
      fail(new Error(`WebSocket error: ${String(event?.message || event?.type || 'unknown')}`));
    };
  });

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data));
      if (payload?.type === 'connected') {
        const src = payload?.sourceStatus?.activeSource;
        if (src) {
          initialSource = initialSource || src;
          report.events.push({ ts: nowIso(), type: 'connected', source: src });
        }
      }

      if (payload?.type === 'tick' && payload?.data?.source) {
        const src = payload.data.source;
        report.events.push({ ts: nowIso(), type: 'tick', source: src, symbol: payload?.data?.symbol });

        if (!initialSource) {
          initialSource = src;
        }

        if (failoverSentAt && src !== initialSource && !switchedAt) {
          switchedAt = Date.now();
          switchedTo = src;
        }
      }
    } catch {
      report.events.push({ ts: nowIso(), type: 'ws_non_json', raw: String(event.data).slice(0, 200) });
    }
  };

  ws.send(JSON.stringify({ type: 'subscribe', symbols: [SYMBOL] }));
  report.events.push({ ts: nowIso(), type: 'subscribe', symbol: SYMBOL });

  // allow one tick / status settle
  await sleep(1200);

  if (!initialSource && beforeStatus?.activeSource) {
    initialSource = beforeStatus.activeSource;
  }

  ws.send(JSON.stringify({ type: 'force_failover' }));
  failoverSentAt = Date.now();
  report.events.push({ ts: nowIso(), type: 'force_failover_sent' });

  const deadlineAt = failoverSentAt + DEADLINE_MS;
  let latestStatus = null;
  while (Date.now() < deadlineAt) {
    try {
      latestStatus = await fetchStatus(statusUrl);
      report.events.push({
        ts: nowIso(),
        type: 'status_poll',
        activeSource: latestStatus?.activeSource ?? null,
        failoverCount: latestStatus?.failoverCount ?? null,
      });

      if (!switchedAt && initialSource && latestStatus?.activeSource && latestStatus.activeSource !== initialSource) {
        switchedAt = Date.now();
        switchedTo = latestStatus.activeSource;
      }
    } catch (error) {
      report.events.push({ ts: nowIso(), type: 'status_poll_error', error: String(error?.message || error) });
    }

    if (switchedAt) break;
    await sleep(STATUS_POLL_MS);
  }

  try {
    report.after = await fetchStatus(statusUrl);
  } catch (error) {
    report.events.push({ ts: nowIso(), type: 'status_after_error', error: String(error?.message || error) });
  }

  const beforeFailoverCount = Number(report.before?.failoverCount ?? 0);
  const afterFailoverCount = Number(report.after?.failoverCount ?? latestStatus?.failoverCount ?? 0);
  const switchedMs = switchedAt && failoverSentAt ? switchedAt - failoverSentAt : null;

  report.result = {
    initialSource,
    switchedTo,
    switchedMs,
    beforeFailoverCount,
    afterFailoverCount,
  };

  report.assertions.failoverCountIncreased = afterFailoverCount > beforeFailoverCount;
  report.assertions.observedSourceChange = Boolean(initialSource && switchedTo && switchedTo !== initialSource);
  report.assertions.switchedWithinDeadline = switchedMs !== null && switchedMs <= DEADLINE_MS;

  // Cross-request status polling may hit a different isolate, so failoverCount is informational.
  // SLA check is based on observed tick source switch latency.
  report.pass = report.assertions.observedSourceChange && report.assertions.switchedWithinDeadline;

  try {
    ws?.close();
  } catch {}

  const outDir = path.resolve('reports/lighthouse/P2.1_A');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'source-failover-test.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));

  process.exit(report.pass ? 0 : 1);
}

run().catch(async (error) => {
  const outDir = path.resolve('reports/lighthouse/P2.1_A');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'source-failover-test.error.log');
  await fs.writeFile(outPath, `[${nowIso()}] ${String(error?.stack || error)}`);
  console.error(error);
  process.exit(1);
});
