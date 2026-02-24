#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const BASE_HTTP = process.env.P21_BASE_HTTP ?? 'https://xgvst.com';
const BASE_WS = process.env.P21_BASE_WS ?? BASE_HTTP.replace(/^http/, 'ws');

const STATUS_URLS = (process.env.P21_STATUS_URLS
  ?? 'https://xgvst.com/api/source/status,https://xgvst-workers.viehh642.workers.dev/api/source/status')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const WS_URL = process.env.P21_WS_URL ?? `${BASE_WS.replace(/\/$/, '')}/ws/quote`;
const SYMBOLS = (process.env.P21_SYMBOLS ?? '000001,600519,300750').split(',').map((s) => s.trim()).filter(Boolean);

const DURATION_MS = Number(process.env.P21_DURATION_MS ?? 70_000);
const STATUS_INTERVAL_MS = Number(process.env.P21_STATUS_INTERVAL_MS ?? 5_000);
const WS_CYCLES = Number(process.env.P21_WS_CYCLES ?? 5);
const WS_SESSION_MS = Number(process.env.P21_WS_SESSION_MS ?? 12_000);
const WS_CONNECT_TIMEOUT_MS = Number(process.env.P21_WS_CONNECT_TIMEOUT_MS ?? 6_000);

const outDir = path.resolve('reports/lighthouse/P2.1_C');

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Number(sorted[Math.max(0, Math.min(idx, sorted.length - 1))].toFixed(1));
}

let selectedStatusUrl = null;

async function fetchStatusOnce() {
  const candidates = selectedStatusUrl ? [selectedStatusUrl] : STATUS_URLS;

  for (const url of candidates) {
    const startedAt = Date.now();
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      const body = await res.json().catch(() => ({}));
      const sample = {
        ts: new Date().toISOString(),
        endpoint: url,
        ok: res.ok,
        httpStatus: res.status,
        latencyMs: Date.now() - startedAt,
        body
      };
      if (res.ok) {
        selectedStatusUrl = url;
        return sample;
      }

      if (selectedStatusUrl) return sample;
    } catch (error) {
      if (!selectedStatusUrl) {
        return {
          ts: new Date().toISOString(), endpoint: url, ok: false, httpStatus: 0,
          latencyMs: Date.now() - startedAt, error: error?.message || String(error)
        };
      }
    }
  }

  return {
    ts: new Date().toISOString(), endpoint: selectedStatusUrl, ok: false, httpStatus: 0, latencyMs: 0,
    error: 'no_status_endpoint_available'
  };
}

async function pollStatus(untilAt) {
  const samples = [];
  while (Date.now() < untilAt) {
    samples.push(await fetchStatusOnce());
    await sleep(STATUS_INTERVAL_MS);
  }
  return samples;
}

async function runWsCycle(cycleNo) {
  return await new Promise((resolve) => {
    const cycleStartedAt = Date.now();
    const ticks = [];
    const events = [];
    let ws;
    let opened = false;
    let openLatencyMs = null;

    let connectTimer = null;
    let sessionTimer = null;

    const finish = (extra = {}) => {
      if (connectTimer) clearTimeout(connectTimer);
      if (sessionTimer) clearTimeout(sessionTimer);
      try { ws?.close(); } catch {}
      resolve({
        cycleNo,
        startedAt: new Date(cycleStartedAt).toISOString(),
        endedAt: new Date().toISOString(),
        opened,
        openLatencyMs,
        tickCount: ticks.length,
        ticks,
        events,
        ...extra
      });
    };

    connectTimer = setTimeout(() => {
      events.push({ type: 'connect_timeout', ts: new Date().toISOString() });
      finish({ ok: false, reason: 'connect_timeout' });
    }, WS_CONNECT_TIMEOUT_MS);

    try {
      ws = new WebSocket(WS_URL);
    } catch (error) {
      events.push({ type: 'construct_error', ts: new Date().toISOString(), error: error?.message || String(error) });
      finish({ ok: false, reason: 'construct_error' });
      return;
    }

    ws.onopen = () => {
      opened = true;
      openLatencyMs = Date.now() - cycleStartedAt;
      events.push({ type: 'open', ts: new Date().toISOString(), openLatencyMs });

      if (connectTimer) clearTimeout(connectTimer);

      ws.send(JSON.stringify({ type: 'subscribe', symbols: SYMBOLS }));
      sessionTimer = setTimeout(() => {
        events.push({ type: 'session_complete', ts: new Date().toISOString() });
        finish({ ok: true, reason: 'session_complete' });
      }, WS_SESSION_MS);
    };

    ws.onmessage = (ev) => {
      const receiveTs = Date.now();
      const text = typeof ev.data === 'string' ? ev.data : '';
      let parsed;
      try { parsed = JSON.parse(text); } catch { return; }

      if (parsed?.type === 'ping') {
        try { ws.send('pong'); } catch {}
        return;
      }

      if (parsed?.type === 'tick' && parsed?.data?.ts) {
        const serverTs = Date.parse(parsed.data.ts);
        const rawLatencyMs = Number.isFinite(serverTs) ? receiveTs - serverTs : null;
        ticks.push({
          symbol: parsed.data.symbol,
          source: parsed.data.source,
          serverTs: parsed.data.ts,
          receiveTs: new Date(receiveTs).toISOString(),
          rawLatencyMs
        });
      }
    };

    ws.onerror = (ev) => {
      const err = ev?.error;
      events.push({ type: 'error', ts: new Date().toISOString(), error: err?.message || String(err || 'websocket error') });
    };

    ws.onclose = (ev) => {
      events.push({ type: 'close', ts: new Date().toISOString(), code: ev.code, reason: ev.reason || '' });
    };
  });
}

function summarize(statusSamples, wsCycles) {
  const statusOk = statusSamples.filter((s) => s.ok);
  const activeSourceCounts = {};
  let reconnectingTrue = 0;
  let minFailover = null;
  let maxFailover = null;

  for (const s of statusOk) {
    const active = s.body?.activeSource ?? 'null';
    activeSourceCounts[active] = (activeSourceCounts[active] || 0) + 1;
    if (s.body?.reconnecting) reconnectingTrue += 1;
    const f = s.body?.failoverCount;
    if (typeof f === 'number') {
      minFailover = minFailover === null ? f : Math.min(minFailover, f);
      maxFailover = maxFailover === null ? f : Math.max(maxFailover, f);
    }
  }

  const allTicks = wsCycles.flatMap((c) => c.ticks);
  const rawVals = allTicks.map((t) => t.rawLatencyMs).filter((v) => typeof v === 'number' && Number.isFinite(v));

  const negRate = rawVals.length ? rawVals.filter((v) => v < 0).length / rawVals.length : 0;
  const skewAdjustMs = negRate > 0.2 ? Math.abs(percentile(rawVals, 5) ?? 0) : 0;
  const adjustedVals = rawVals.map((v) => Number((v + skewAdjustMs).toFixed(1))).filter((v) => v >= 0);

  const reconnectAttempts = Math.max(0, wsCycles.length - 1);
  const successfulReconnects = wsCycles.slice(1).filter((c) => c.opened).length;

  return {
    sourceStatus: {
      totalPolls: statusSamples.length,
      successfulPolls: statusOk.length,
      successRate: statusSamples.length ? Number(((statusOk.length / statusSamples.length) * 100).toFixed(1)) : 0,
      activeSourceCounts,
      reconnectingTrueSamples: reconnectingTrue,
      failoverDelta: minFailover !== null && maxFailover !== null ? maxFailover - minFailover : null,
      selectedEndpoint: selectedStatusUrl
    },
    tickLatency: {
      totalTicks: allTicks.length,
      clockSkewAdjustMs: Number(skewAdjustMs.toFixed(1)),
      rawP50Ms: percentile(rawVals, 50),
      rawP95Ms: percentile(rawVals, 95),
      p50Ms: percentile(adjustedVals, 50),
      p90Ms: percentile(adjustedVals, 90),
      p95Ms: percentile(adjustedVals, 95),
      maxMs: adjustedVals.length ? Number(Math.max(...adjustedVals).toFixed(1)) : null,
      minMs: adjustedVals.length ? Number(Math.min(...adjustedVals).toFixed(1)) : null
    },
    reconnect: {
      cycles: wsCycles.length,
      reconnectAttempts,
      successfulReconnects,
      successRate: reconnectAttempts ? Number(((successfulReconnects / reconnectAttempts) * 100).toFixed(1)) : 100,
      openedCycles: wsCycles.filter((c) => c.opened).length,
      cyclesWithTick: wsCycles.filter((c) => c.tickCount > 0).length
    }
  };
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const startedAt = Date.now();
  const untilAt = startedAt + DURATION_MS;

  const statusTask = pollStatus(untilAt);

  const wsCycles = [];
  for (let i = 0; i < WS_CYCLES; i += 1) {
    wsCycles.push(await runWsCycle(i + 1));
    await sleep(500);
  }

  const statusSamples = await statusTask;
  const summary = summarize(statusSamples, wsCycles);

  const payload = {
    generatedAt: new Date().toISOString(),
    config: {
      STATUS_URLS,
      WS_URL,
      SYMBOLS,
      DURATION_MS,
      STATUS_INTERVAL_MS,
      WS_CYCLES,
      WS_SESSION_MS,
      WS_CONNECT_TIMEOUT_MS
    },
    summary,
    statusSamples,
    wsCycles
  };

  const jsonPath = path.join(outDir, `sentinel-sample-${stamp}.json`);
  const latestPath = path.join(outDir, 'sentinel-latest.json');
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2));
  await fs.writeFile(latestPath, JSON.stringify(payload, null, 2));

  console.log(JSON.stringify({ ok: true, jsonPath, summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
