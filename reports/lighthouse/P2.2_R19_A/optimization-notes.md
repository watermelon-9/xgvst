# P2.2 R19 Sub-A 优化说明（基于 R17 最优点）

目标：在保持 DoD5 主路径（`batchFlushMs=100` + 默认 `deflate`）不回退的前提下，做少量高收益改动，优先改善恢复首帧与重连恢复尾延迟。

## 本次改动

### 1) 恢复首帧路径提速（workers / QuoteDO）
- `resync` 的 `immediateData` 上限改为按订阅规模自适应提升：
  - 新策略：`max(snapshotImmediateSymbols, ceil(symbolCount*0.25), 12)`，上限 24。
  - 目的：重连后更早返回可用数据，降低“首帧可见”时间。
- `buildSnapshotPlan` 优先读取 `pendingBySymbol`，其次 `latestTickBySymbol`。
  - 目的：优先发送最新尚未 flush 的内存快照，减少等待 100ms flush 窗口带来的恢复空窗。

### 2) 恢复期不必要排序/调度开销收敛（workers / QuoteDO）
- `sendSnapshotTicks` 移除恢复发送前的全量 `symbol` 排序。
  - 目的：降低 1000 并发重连阶段 CPU 开销与首包等待。
- bundle 恢复发送新增“首块直发”快路径：
  - 首块（`max(8, snapshotImmediateSymbols)`）直接编码发送，不先等待 backpressure。
  - 剩余批次继续沿用动态 batch/delay/backpressure 机制。
  - 目的：首帧优先，后续仍保留稳定性保护。

### 3) 重连节流参数细化（web / useQuoteWebSocket）
- 在原 `reconnectFastLaneMs=40` 基础上，新增第 2/3 次重连上限：
  - 第 2 次 ≤ 180ms
  - 第 3 次 ≤ 420ms
- 目的：避免首次快速重连失败后立即退化到较大指数退避，改善恢复 p95。

## DoD5 主路径检查
- 未修改 `QUOTE_DO_BATCH_FLUSH_MS` 默认值（仍是 `100`）。
- 未修改默认压缩归一化逻辑（bundle 默认仍 `deflate`）。

## 涉及文件
- `packages/workers/src/durable/QuoteDO.ts`
- `apps/web/src/lib/api/useQuoteWebSocket.ts`
