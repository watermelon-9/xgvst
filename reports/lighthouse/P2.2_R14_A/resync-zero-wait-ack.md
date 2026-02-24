# P2.2 R14 Sub-A — resync 零等待 ACK 改造报告

## 范围
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 目标：DoD4「resync 零等待」

## 完成项对照

### 1) QuoteDO resync 路径改为零等待 ack
- 文件：`packages/workers/src/durable/QuoteDO.ts`
- 变更：`resync` 分支改为同步路径只做订阅集合切换 + 立即返回轻量 ACK。
- ACK 结构：
  - `type: 'resync_ack'`
  - `pending: true`
  - `symbols: nextSymbols`
  - 保留 `transport/compression/dictVersion`（兼容现有协商）

### 2) 慢操作后台化（deferSlowTask）
- 在 `resync` ACK 之后，统一放入 `deferSlowTask`：
  - `syncUpstreamSubscriptions()`
  - memory snapshot 触发（`sendImmediateSnapshot`）
  - KV fallback（`scheduleKvFallbackSnapshot`）
- 结果：resync 主链路无等待上游同步/快照读取发送。

### 3) 前端 useQuoteWebSocket 支持 resync_ack + recovering 语义修正
- 文件：`apps/web/src/lib/api/useQuoteWebSocket.ts`
- 新增消息类型识别：`resync_ack`
- 行为：
  - 收到 `resync_ack` 后进入 `recovering`
  - 以 ACK symbols（或最后一次 resync 请求 symbols 兜底）作为待恢复集合
  - 收到首帧后按 symbol 逐步 `markRecoveredBySymbol` 退出 recovering
- 兼容旧服务端：若未发 `resync_ack`，收到 `resynced` 时可用最近一次 resync 请求进入 recovering。
- 防误判：不再因普通 `subscribed/unsubscribed` 控制消息直接改写 recovering 集合。

### 4) 快照发送改批量优先（50ms 节奏）
- 文件：`packages/workers/src/durable/QuoteDO.ts`
- 新增节奏参数：
  - `DEFAULT_SNAPSHOT_BATCH_INTERVAL_MS = 50`
  - `DEFAULT_SNAPSHOT_BATCH_SYMBOLS = 24`
- `sendSnapshotTicks` 改造：
  - bundle 路径：按批分块发送，每批之间 `await sleep(50ms)`
  - legacy/protobuf 路径：每批最多 24 symbol，批间 50ms
- 保持 bundle/protobuf 编码与 envelope 兼容，不改协议格式。

### 5) DoD5 路径不回退（100ms+deflate 保留）
- 未改动：
  - `DEFAULT_BATCH_FLUSH_MS = 100`（广播 flush 节奏保持）
  - 默认压缩策略 `deflate` 逻辑保持（仅显式 none 回退）

### 6) check 结果
已执行并通过：
```bash
corepack pnpm workers:check
corepack pnpm check
```
- workers: `wrangler types && tsc --noEmit` 通过
- web: `svelte-check` 0 errors / 0 warnings

## 变更文件
- `packages/workers/src/durable/QuoteDO.ts`
- `apps/web/src/lib/api/useQuoteWebSocket.ts`
- `reports/lighthouse/P2.2_R14_A/resync-zero-wait-ack.md`
