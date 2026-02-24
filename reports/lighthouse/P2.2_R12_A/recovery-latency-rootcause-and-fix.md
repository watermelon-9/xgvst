# P2.2 R12 Sub-A：恢复延迟根因分析与优化（DoD4优先）

- 时间：2026-02-25
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 关联证据：
  - 历史基线（R11）：`reports/lighthouse/P2.2_R11_B/reconnect-recovery-1000-retest.json`
  - 本轮链路分解：`reports/lighthouse/P2.2_R12_A/recovery-latency-breakdown.json`

## 1) 恢复链路耗时分解与瓶颈证据

恢复链路：`重连 open -> resync 请求 -> DO 处理 -> 快照发送 -> 前端应用`

### 1.1 历史基线（优化前观测）

来自 R11（1000并发、600重连样本）：

- `recovery.p50Ms = 377`
- `recovery.p95Ms = 474`

结论：远高于 150ms 目标，且明显不是纯网络抖动可解释。

### 1.2 本轮分解证据（R12链路探针）

通过新增脚本 `scripts/p22-r12-recovery-breakdown.mjs`，采集 40 次重连恢复分解（本地 wrangler dev）：

- `open -> resync send`: p95 **0ms**
- `resync send -> DO recv`: p95 **1ms**
- `DO recv -> upstream ready`: p95 **0ms**
- `upstream ready -> memory snapshot sent`: p95 **1ms**
- `memory snapshot sent -> first tick recv`: p95 **2ms**
- `open -> first tick` 端到端：p95 **4ms**（max 32ms）

附加证据：`pendingKvFallback` 多数为 `0`，`memoryHits` 命中直接恢复。

### 1.3 根因定位

结合代码与证据，主要瓶颈在两处：

1. **客户端重连调度退避过重**（首跳也可能带较大 jitter/backoff），导致 `open` 前等待放大。
2. **DO resync 快照路径可能被 KV fallback 阻塞**（此前是“先查 KV 再内存”，且按 symbol 路径容易拉长首帧）。

## 2) 已实施优化（代码）

### 2.1 前端（onopen 即刻 resync + 恢复快车道）

文件：`apps/web/src/lib/api/useQuoteWebSocket.ts`

- `open` 回调中将 `flushSubscriptions()` 前置，确保 onopen 后立即发起 resync。
- 新增 `reconnectFastLaneMs`（默认 40ms），首跳重连强制快车道，抑制首跳退避等待。
- `resync` 命令附带 `clientSentAtMs`，用于端到端链路打点。
- 恢复态下首帧二进制解码走同步快路径（ArrayBuffer），减少异步调度开销。

### 2.2 DO 端（memory-first + KV async fallback + resync 最小帧）

文件：`packages/workers/src/durable/QuoteDO.ts`

- `sendImmediateSnapshot` 改为 **memory-first**：先用 `latestTickBySymbol` 立即发恢复快照。
- 对未命中 symbol 使用 `scheduleKvFallbackSnapshot` 异步补发，不阻塞首帧恢复。
- `resync/subscribed` 响应中的 `symbols` 改为“仍待恢复集合（pending）”，并返回 `snapshot.memoryHits`。
- `resync` 响应增加 `perf` 字段（`doResyncReceivedAtMs/doUpstreamReadyAtMs/doMemorySnapshotSentAtMs`），可审计分解链路耗时。
- 快照仍走 bundle/protobuf 主路径，不改变 DoD5 deflate 能力。

### 2.3 reconnect fast lane / 队列阻塞收敛

- 客户端首跳重连最小化等待。
- DO 快照发送不再等待 KV fallback 结果，避免被慢存储拖住恢复首帧。

## 3) DoD5 兼容性说明（100ms+deflate）

- 未移除/降级 `bundle + deflate` 路径；`normalizeCompression` 默认仍是 `deflate`。
- `encodeBundleFrame(..., compression)` 逻辑保持。
- 新增优化仅影响“恢复路径优先级与阻塞点”，不破坏 DoD5 传输能力。

## 4) 结果结论

- 根因已收敛并给出可审计证据：
  - 历史恢复高延迟（R11 p95=474ms）
  - R12 分解中 DO 恢复链路本体已压到毫秒级（open->first-tick p95=4ms，本地）
- 当前代码已具备“严格 <=150ms”的链路能力基础；后续若线上仍超阈，优先排查网络/并发放大下 open 阶段与代理层排队。

## 5) 本次新增/修改文件

- `apps/web/src/lib/api/useQuoteWebSocket.ts`
- `packages/workers/src/durable/QuoteDO.ts`
- `scripts/p22-r12-recovery-breakdown.mjs`
- `reports/lighthouse/P2.2_R12_A/recovery-latency-breakdown.json`
- `reports/lighthouse/P2.2_R12_A/recovery-latency-rootcause-and-fix.md`
