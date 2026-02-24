# P2.2 R16 A — Adaptive Snapshot + resync_ack Piggyback 修复说明

## 目标
按用户1552建议完成结构化优化，降低恢复时延（优先改善恢复 p50/p95）：
1. QuoteDO `sendSnapshotTicks` 自适应批发送（首批 microtask yield、后续动态 delay、`ws.bufferedAmount` 背压让出）
2. `resync_ack` piggyback `immediateData`
3. 前端 `useQuoteWebSocket` 处理 `resync_ack.immediateData` 并沿用现有 tick 恢复逻辑
4. 剩余快照异步后台继续，不阻塞主链路
5. 不破坏 DoD5（`batchFlushMs=100ms` + `deflate` 默认保留）

## 代码改动

### 1) Workers / QuoteDO：恢复主链路瘦身 + 自适应快照分批
文件：`packages/workers/src/durable/QuoteDO.ts`

- 新增快照控制参数（可 env 覆盖）：
  - `QUOTE_DO_SNAPSHOT_BATCH_SYMBOLS`（默认 24）
  - `QUOTE_DO_SNAPSHOT_IMMEDIATE_SYMBOLS`（默认 8）
  - `QUOTE_DO_SNAPSHOT_BACKPRESSURE_BYTES`（默认 512KB）
  - `QUOTE_DO_SNAPSHOT_BACKPRESSURE_YIELD_MS`（默认 8ms）
- 新增 `buildSnapshotPlan()`：按目标 symbols 生成
  - `immediateData`（前 N 个内存快照）
  - `memoryRemainder`
  - `missingSymbols`（需 KV 补齐）
- `resync` 流程：
  - ACK 立即返回 `resync_ack`，并携带 `immediateData`
  - `pending` 根据剩余任务（memoryRemainder + missing）动态计算
  - 后续 `syncUpstreamSubscriptions + dictionary + 剩余快照` 放入异步慢任务
- `sendSnapshotTicks()` 自适应批发送：
  - 首批后只做 `await Promise.resolve()`（microtask yield，无硬等待）
  - 后续批次按 `bufferedAmount` + batchIndex 动态 delay
  - 发送前检测 `ws.bufferedAmount`，超过阈值短暂让出（最多 3 次）

### 2) Web / useQuoteWebSocket：处理 resync_ack.immediateData
文件：`apps/web/src/lib/api/useQuoteWebSocket.ts`

- 扩展 `resync_ack` 消息类型支持 `immediateData?: unknown[]`
- 收到 `resync_ack` 时：
  - 先按 `symbols`（或最近请求）进入 recovering 集合
  - 将 `immediateData` 按既有 `normalizeTick` 流程注入
  - 对每个注入 tick 复用原 `markRecoveredBySymbol`，确保按 symbol 精准退出 recovering
- 抽出 `dispatchTickAndRecover()`，统一二进制 tick / JSON tick / piggyback tick 的恢复路径

## DoD5 兼容性确认
- `DEFAULT_BATCH_FLUSH_MS = 100` 未改（实时批刷新路径保留）
- 默认压缩策略 `deflate` 未改（bundle 默认仍走 `normalizeCompression -> deflate`）
- 仅对恢复补齐路径进行链路瘦身和调度优化，不影响 DoD5 主发送节流策略

## 风险点
1. **ACK 包体增大**：`immediateData` 会增加 ACK 大小；若 symbols 过多可能影响控制帧传输时延（已通过 `snapshotImmediateSymbols` 限流）。
2. **背压参数敏感**：不同网络下 `bufferedAmount` 阈值/让出时间可能需微调。
3. **恢复顺序差异**：前端先渲染 piggyback，随后再收到剩余批次，可能改变极端情况下的首屏 symbol 更新先后。

## 回滚点
1. 回滚前端 piggyback 注入：
   - `apps/web/src/lib/api/useQuoteWebSocket.ts` 中 `resync_ack.immediateData` 处理逻辑。
2. 回滚后端 piggyback：
   - `packages/workers/src/durable/QuoteDO.ts` 中 `buildSnapshotPlan()` + `resync_ack.immediateData` 字段。
3. 回滚自适应批发送：
   - 同文件 `sendSnapshotTicks()` 恢复固定批次 + 固定 sleep 策略。

## 检查结果
已执行：
- `corepack pnpm --filter workers check` ✅
- `corepack pnpm --filter web check` ✅
