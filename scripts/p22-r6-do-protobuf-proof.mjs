#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('reports/lighthouse/P2.2_R6_A');
const WS_URL = process.env.P22_R6_WS_URL ?? 'wss://xgvst.com/ws/quote?session=p22-r6-a';
const DO_METRICS_URL = process.env.P22_R6_DO_METRICS_URL ?? 'https://xgvst.com/api/do/metrics?session=p22-r6-a';
const SYMBOLS = (process.env.P22_R6_SYMBOLS ?? '000001,600519').split(',').map((s) => s.trim()).filter(Boolean);
const SAMPLE_MS = Number(process.env.P22_R6_SAMPLE_MS ?? 8000);

const textDecoder = new TextDecoder();

function readVarint(bytes, start) {
  let value = 0;
  let shift = 0;
  let offset = start;
  while (offset < bytes.length && shift <= 28) {
    const b = bytes[offset];
    value |= (b & 0x7f) << shift;
    offset += 1;
    if ((b & 0x80) === 0) return { value, next: offset };
    shift += 7;
  }
  return null;
}

function decodeQuoteProto(bytes) {
  let offset = 0;
  const out = {};

  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    if (!tag) return null;
    offset = tag.next;

    const field = tag.value >>> 3;
    const wt = tag.value & 0x07;

    if (wt === 2) {
      const len = readVarint(bytes, offset);
      if (!len) return null;
      offset = len.next;
      const end = offset + len.value;
      if (end > bytes.length) return null;
      const v = textDecoder.decode(bytes.slice(offset, end));
      if (field === 1) out.symbol = v;
      if (field === 4) out.ts = v;
      offset = end;
      continue;
    }

    if (wt === 1) {
      if (offset + 8 > bytes.length) return null;
      const v = new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getFloat64(0, true);
      if (field === 2) out.price = v;
      if (field === 3) out.changePct = v;
      offset += 8;
      continue;
    }

    if (wt === 0) {
      const v = readVarint(bytes, offset);
      if (!v) return null;
      offset = v.next;
      continue;
    }

    if (wt === 5) {
      offset += 4;
      if (offset > bytes.length) return null;
      continue;
    }

    return null;
  }

  if (!out.symbol || !out.ts) return null;
  if (typeof out.price !== 'number' || typeof out.changePct !== 'number') return null;
  return out;
}

function decodeQt1(bytes) {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0x51 || bytes[1] !== 0x54 || bytes[2] !== 0x31) return null;
  return { transport: 'qt1-debug-fallback' };
}

async function getDoMetrics() {
  const res = await fetch(DO_METRICS_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(6000)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`do metrics ${res.status}`);
  return body;
}

async function sampleWs() {
  return await new Promise((resolve, reject) => {
    const counters = {
      binaryFrames: 0,
      protobufFrames: 0,
      qt1FallbackFrames: 0,
      jsonFallbackFrames: 0,
      controlFrames: 0,
      decodeFailedFrames: 0
    };

    let ws;
    let ended = false;
    let timer;

    const finish = (reason) => {
      if (ended) return;
      ended = true;
      if (timer) clearTimeout(timer);
      try { ws?.close(); } catch {}
      resolve({ reason, counters });
    };

    try {
      ws = new WebSocket(WS_URL);
    } catch (error) {
      reject(error);
      return;
    }

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', symbols: SYMBOLS }));
      timer = setTimeout(() => finish('sample_complete'), SAMPLE_MS);
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        let parsed = null;
        try { parsed = JSON.parse(event.data); } catch {}

        if (parsed?.type === 'tick') {
          counters.jsonFallbackFrames += 1;
          return;
        }

        if (parsed?.type === 'ping') {
          try { ws.send('pong'); } catch {}
        }
        counters.controlFrames += 1;
        return;
      }

      const buffer = event.data instanceof ArrayBuffer
        ? event.data
        : event.data instanceof Blob
          ? await event.data.arrayBuffer()
          : null;

      if (!buffer) {
        counters.decodeFailedFrames += 1;
        return;
      }

      const bytes = new Uint8Array(buffer);
      counters.binaryFrames += 1;

      if (decodeQuoteProto(bytes)) {
        counters.protobufFrames += 1;
        return;
      }

      if (decodeQt1(bytes)) {
        counters.qt1FallbackFrames += 1;
        return;
      }

      counters.decodeFailedFrames += 1;
    };

    ws.onerror = () => finish('ws_error');
    ws.onclose = () => !ended && finish('ws_close');
  });
}

function diffStats(before = {}, after = {}) {
  return {
    sentBinaryFrames: (after.sentBinaryFrames ?? 0) - (before.sentBinaryFrames ?? 0),
    sentProtobufFrames: (after.sentProtobufFrames ?? 0) - (before.sentProtobufFrames ?? 0),
    sentFallbackFrames: (after.sentFallbackFrames ?? 0) - (before.sentFallbackFrames ?? 0)
  };
}

function buildReadme(report) {
  const d = report.doDiff;
  const c = report.ws.counters;
  const ok = report.ok ? '✅ 达标' : '❌ 未达标';
  return `# P2.2 R6-A DoD3 Protobuf 下发验证\n\n- 结果：${ok}\n- 时间：${report.generatedAt}\n- WS：\`${WS_URL}\`\n- DO Metrics：\`${DO_METRICS_URL}\`\n\n## 关键指标\n\n- DO 计数增量：\n  - sentBinaryFrames: **+${d.sentBinaryFrames}**\n  - sentProtobufFrames: **+${d.sentProtobufFrames}**\n  - sentFallbackFrames: **+${d.sentFallbackFrames}**\n- 抓包计数：\n  - binaryFrames: **${c.binaryFrames}**\n  - protobufFrames: **${c.protobufFrames}**\n  - qt1FallbackFrames: **${c.qt1FallbackFrames}**\n  - jsonFallbackFrames: **${c.jsonFallbackFrames}**\n  - decodeFailedFrames: **${c.decodeFailedFrames}**\n\n## 判定规则\n\n1. binaryFrames > 0\n2. protobufFrames > 0\n3. qt1FallbackFrames == 0\n4. jsonFallbackFrames == 0\n5. DO sentProtobufFrames 增量 > 0\n\n`;}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const doBefore = await getDoMetrics();
  const ws = await sampleWs();
  const doAfter = await getDoMetrics();

  const beforeStats = doBefore?.payload?.stats ?? {};
  const afterStats = doAfter?.payload?.stats ?? {};
  const doDiff = diffStats(beforeStats, afterStats);

  const counters = ws.counters;
  const ok = counters.binaryFrames > 0
    && counters.protobufFrames > 0
    && counters.qt1FallbackFrames === 0
    && counters.jsonFallbackFrames === 0
    && doDiff.sentProtobufFrames > 0;

  const report = {
    generatedAt,
    ok,
    ws,
    doBefore,
    doAfter,
    doDiff
  };

  await fs.writeFile(path.join(OUT_DIR, 'p22-r6-do-protobuf-proof.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'README.md'), buildReadme(report));

  console.log(JSON.stringify({ ok, doDiff, ws: ws.counters, outDir: OUT_DIR }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
