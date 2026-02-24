#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('reports/lighthouse/P2.1_R4_B');
const WS_URL = process.env.P21_E2E_WS_URL ?? 'wss://xgvst.com/ws/quote';
const STATUS_URL = process.env.P21_E2E_STATUS_URL ?? 'https://xgvst-workers.viehh642.workers.dev/api/source/status';
const SYMBOLS = (process.env.P21_E2E_SYMBOLS ?? '000001,600519').split(',').map((s) => s.trim()).filter(Boolean);
const SAMPLE_MS = Number(process.env.P21_E2E_SAMPLE_MS ?? 8000);
const MAX_BINARY_SAMPLES = Number(process.env.P21_E2E_MAX_BINARY_SAMPLES ?? 3);

const textDecoder = new TextDecoder();

function readProtoVarint(bytes, start) {
  let value = 0;
  let shift = 0;
  let offset = start;

  while (offset < bytes.length && shift <= 28) {
    const byte = bytes[offset];
    value |= (byte & 0x7f) << shift;
    offset += 1;

    if ((byte & 0x80) === 0) {
      return { value, next: offset };
    }

    shift += 7;
  }

  return null;
}

function decodeQuoteProto(bytes) {
  let offset = 0;
  const draft = { source: 'ws-protobuf', transport: 'ws-protobuf' };

  while (offset < bytes.length) {
    const tag = readProtoVarint(bytes, offset);
    if (!tag) return null;
    offset = tag.next;

    const field = tag.value >>> 3;
    const wireType = tag.value & 0x07;

    if (wireType === 2) {
      const length = readProtoVarint(bytes, offset);
      if (!length) return null;
      offset = length.next;
      const end = offset + length.value;
      if (end > bytes.length) return null;
      const text = textDecoder.decode(bytes.slice(offset, end));

      if (field === 1) draft.symbol = text;
      else if (field === 4) draft.ts = text;

      offset = end;
      continue;
    }

    if (wireType === 1) {
      const end = offset + 8;
      if (end > bytes.length) return null;
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
      const value = view.getFloat64(0, true);

      if (field === 2) draft.price = value;
      else if (field === 3) draft.changePct = value;

      offset = end;
      continue;
    }

    if (wireType === 0) {
      const varint = readProtoVarint(bytes, offset);
      if (!varint) return null;
      offset = varint.next;
      continue;
    }

    if (wireType === 5) {
      offset += 4;
      if (offset > bytes.length) return null;
      continue;
    }

    return null;
  }

  if (!draft.symbol || !draft.ts) return null;
  if (typeof draft.price !== 'number' || typeof draft.changePct !== 'number') return null;
  return draft;
}

function decodeCustomBinaryFrame(bytes) {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0x51 || bytes[1] !== 0x54 || bytes[2] !== 0x31) return null;

  let offset = 3;
  const symbolLength = bytes[offset];
  offset += 1;

  if (offset + symbolLength > bytes.length) return null;
  const symbol = textDecoder.decode(bytes.slice(offset, offset + symbolLength));
  offset += symbolLength;

  if (offset + 16 > bytes.length) return null;
  const valuesView = new DataView(bytes.buffer, bytes.byteOffset + offset, 16);
  const price = valuesView.getFloat64(0, true);
  const changePct = valuesView.getFloat64(8, true);
  offset += 16;

  if (offset + 2 > bytes.length) return null;
  const tsLength = new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
  offset += 2;

  if (offset + tsLength > bytes.length) return null;
  const ts = textDecoder.decode(bytes.slice(offset, offset + tsLength));
  offset += tsLength;

  if (offset >= bytes.length) return null;
  const sourceLength = bytes[offset];
  offset += 1;

  if (offset + sourceLength > bytes.length) return null;
  const source = textDecoder.decode(bytes.slice(offset, offset + sourceLength));

  return { symbol, price, changePct, ts, source, transport: 'ws-binary' };
}

function toHex(bytes, max = 96) {
  const view = bytes.slice(0, Math.min(bytes.length, max));
  return Array.from(view).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

async function fetchStatus() {
  const response = await fetch(STATUS_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5000)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`status ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }

  return body;
}

async function sampleWs() {
  const counters = {
    binaryFrames: 0,
    jsonTickFrames: 0,
    controlStringFrames: 0,
    binaryDecodedTicks: 0,
    fallbackDecodedTicks: 0,
    decodeFailedFrames: 0
  };

  const binaryFrameSamples = [];
  const jsonFrameSamples = [];
  const tickSamples = [];

  const startedAt = Date.now();

  return await new Promise((resolve, reject) => {
    let ws;
    let ended = false;
    let sampleTimer = null;

    const finish = (reason) => {
      if (ended) return;
      ended = true;
      if (sampleTimer) clearTimeout(sampleTimer);
      try { ws?.close(); } catch {}

      resolve({
        reason,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        counters,
        binaryFrameSamples,
        jsonFrameSamples,
        tickSamples
      });
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
      sampleTimer = setTimeout(() => finish('sample_complete'), SAMPLE_MS);
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        if (event.data === 'ping') {
          try { ws.send('pong'); } catch {}
          counters.controlStringFrames += 1;
          return;
        }

        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          counters.controlStringFrames += 1;
          return;
        }

        if (payload?.type === 'ping') {
          counters.controlStringFrames += 1;
          try { ws.send('pong'); } catch {}
          return;
        }

        if (payload?.type === 'tick') {
          counters.jsonTickFrames += 1;
          counters.fallbackDecodedTicks += 1;
          if (jsonFrameSamples.length < 5) {
            jsonFrameSamples.push(payload);
          }
          return;
        }

        counters.controlStringFrames += 1;
        return;
      }

      let buffer;
      if (event.data instanceof ArrayBuffer) {
        buffer = event.data;
      } else if (event.data instanceof Blob) {
        buffer = await event.data.arrayBuffer();
      } else {
        counters.decodeFailedFrames += 1;
        return;
      }

      const bytes = new Uint8Array(buffer);
      counters.binaryFrames += 1;

      if (binaryFrameSamples.length < MAX_BINARY_SAMPLES) {
        binaryFrameSamples.push({
          bytes: bytes.length,
          headHex: toHex(bytes)
        });
      }

      const customDecoded = decodeCustomBinaryFrame(bytes);
      if (customDecoded) {
        counters.binaryDecodedTicks += 1;
        if (tickSamples.length < 8) tickSamples.push(customDecoded);
        return;
      }

      const protoDecoded = decodeQuoteProto(bytes);
      if (protoDecoded) {
        counters.binaryDecodedTicks += 1;
        if (tickSamples.length < 8) tickSamples.push(protoDecoded);
        return;
      }

      counters.decodeFailedFrames += 1;
    };

    ws.onerror = () => {
      finish('ws_error');
    };

    ws.onclose = () => {
      if (!ended) finish('ws_close');
    };
  });
}

function buildMarkdown({ generatedAt, wsResult, statusBefore, statusAfter }) {
  const before = statusBefore?.wsFrameStats ?? {};
  const after = statusAfter?.wsFrameStats ?? {};
  const diffBinary = (after.sentBinaryFrames ?? 0) - (before.sentBinaryFrames ?? 0);
  const diffFallback = (after.sentFallbackFrames ?? 0) - (before.sentFallbackFrames ?? 0);

  const lines = [
    '# P2.1 R4-B 服务端到前端 Binary 端到端证明',
    '',
    `- 生成时间：${generatedAt}`,
    `- WS 采样地址：\`${WS_URL}\``,
    `- Status 地址：\`${STATUS_URL}\``,
    `- 订阅标的：${SYMBOLS.join(', ')}`,
    '',
    '## 结论',
    '',
    `- 服务端帧增量：binary **+${diffBinary}** / fallback **+${diffFallback}**`,
    `- 前端侧抓包：binary frames **${wsResult.counters.binaryFrames}** / JSON tick frames **${wsResult.counters.jsonTickFrames}**`,
    `- 前端解码：binary decoded ticks **${wsResult.counters.binaryDecodedTicks}** / fallback decoded ticks **${wsResult.counters.fallbackDecodedTicks}**`,
    `- 判定：${wsResult.counters.binaryFrames > 0 && wsResult.counters.jsonTickFrames === 0 ? '✅ 主路径为 binary，非 JSON 字符串依赖' : '❌ 仍存在 JSON tick 主路径风险'}`,
    '',
    '## 证据链（server -> wire -> frontend decode）',
    '',
    '1. **server 计数（/api/source/status）**：记录 `wsFrameStats.sentBinaryFrames/sentFallbackFrames` 前后差值。',
    '2. **wire 抓包（WS onmessage）**：按 `event.data` 类型统计 binary/string。',
    '3. **frontend decode 等价验证**：按与 `useQuoteWebSocket` 同逻辑尝试 `QT1 -> protobuf` 解码并计数。',
    '',
    '## 样本（binary frame head hex）',
    ''
  ];

  for (const sample of wsResult.binaryFrameSamples) {
    lines.push(`- bytes=${sample.bytes} | ${sample.headHex}`);
  }

  if (!wsResult.binaryFrameSamples.length) {
    lines.push('- (无 binary 样本)');
  }

  lines.push('', '## 备注', '', '- 本报告由 `scripts/p21-e2e-binary-proof.mjs` 自动生成。');
  return `${lines.join('\n')}\n`;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const statusBefore = await fetchStatus();
  const wsResult = await sampleWs();
  const statusAfter = await fetchStatus();

  const payload = {
    generatedAt,
    wsUrl: WS_URL,
    statusUrl: STATUS_URL,
    symbols: SYMBOLS,
    sampleMs: SAMPLE_MS,
    statusBefore,
    wsResult,
    statusAfter
  };

  await fs.writeFile(path.join(OUT_DIR, 'e2e-binary-proof.json'), JSON.stringify(payload, null, 2));
  const markdown = buildMarkdown(payload);
  await fs.writeFile(path.join(OUT_DIR, 'e2e-binary-proof.md'), markdown);

  const ok = wsResult.counters.binaryFrames > 0 && wsResult.counters.jsonTickFrames === 0;
  console.log(JSON.stringify({ ok, outDir: OUT_DIR, counters: wsResult.counters }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
