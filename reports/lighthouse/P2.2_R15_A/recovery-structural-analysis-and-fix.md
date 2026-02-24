# P2.2 R15 Sub-A：恢复时延“结构性、针对性”优化（DoD4）

## 1) 耗时分层诊断（reconnect / resync / first-frame）

### 分层
1. **Reconnect 握手耗时（连接层）**
   - 发生在客户端 `WebSocket CONNECTING -> OPEN`。
   - 受网络抖动、退避延迟、服务端 accept 影响。
   - 这段结束后，链路可收发，但**业务恢复尚未完成**。

2. **Resync 控制面耗时（协议层）**
   - 客户端发送 `resync(symbols)`，服务端处理订阅集并回 `resync_ack`。
   - 影响因素：控制消息排队、订阅集合重建、上游订阅同步触发时机。

3. **首帧数据面耗时（数据层）**
   - 从 `resync_ack` 到“第一个目标 symbol tick 到达并可渲染”。
   - 原瓶颈集中在：
     - 快照发送被放进异步慢任务；
     - 快照按批次+间隔（50ms）节奏发，首帧可能等到批处理；
     - bundle 模式首帧即走 bundle+compression（编码/压缩成本偏高）。

### 简洁因果链
`重连成功` 仅代表通道恢复 → `resync_ack` 仅代表控制面确认 → 若首帧仍等待批处理/压缩，则 UI `recovering` 不能及时退出。

---

## 2) 针对性改动（结构化落地）

### A. 恢复首帧 fast-path（最小首帧，立即解锁）
**改动点**：`packages/workers/src/durable/QuoteDO.ts`

- 新增 `sendRecoveryFastPathTick(...)`。
- `sendImmediateSnapshot(...)` 先从目标 symbols 中取**首个有内存快照** symbol，立即发送单 symbol tick（不走批量）。
- 其余 symbol 才进入后续异步批量发送。

**效果**：重连后首个可用 symbol 的 tick 不再等待批次调度，首帧显著前置。

### B. 分层发送策略（首帧同步快发 + 其余异步批量）
**改动点**：`packages/workers/src/durable/QuoteDO.ts`

- `resync` 路径调整为：
  1) 先回 `resync_ack`；
  2) 立即执行 `sendImmediateSnapshot`（含 fast-path 首帧）；
  3) 其余 symbols 通过 `sendSnapshotTicks` 异步批量发送；
  4) 上游 `syncUpstreamSubscriptions` 放到慢任务，不阻塞首帧。
- 维持原有快照批量节奏用于“剩余 symbols”，避免抢占首恢复路径。

**效果**：把“首恢复”与“全量补齐”解耦，避免 50ms 批次节奏拖慢首帧。

### C. 降低恢复期首帧编码/压缩开销（轻量通道）
**改动点**：`packages/workers/src/durable/QuoteDO.ts`

- fast-path 首帧统一走 `sendLegacyTick`（单 symbol protobuf/轻量二进制路径）。
- 不让首帧先进入 bundle+deflate 压缩路径。
- 后续 remainder 仍按客户端 transport/compression 走原 bundle + compression。

**效果**：把 CPU 成本（bundle 编码 + 压缩）从“首帧关键路径”挪到“后续补齐路径”。

### D. 避免控制消息误判，recovering 按 symbol 精准退出
**改动点**：`apps/web/src/lib/api/useQuoteWebSocket.ts`

- recovering 进入仅由 `resync_ack` 驱动；移除旧 `resynced` 控制消息兜底触发，避免误判。
- `resync_ack.pending === false` 时直接清空 recovering。
- recovering 退出继续按 `markRecoveredBySymbol(symbol)` 精准扣减 `pendingRecoverySymbols`。

**效果**：控制面不再错误触发恢复态；恢复退出严格由目标 symbol 数据到达驱动。

---

## 3) DoD5 主路径回归保护（100ms + deflate 保留）

本次未回退 DoD5 主路径能力：
- `DEFAULT_BATCH_FLUSH_MS = 100` 保持不变；
- `normalizeCompression()` 默认仍为 `deflate`；
- bundle + compression 主链路仍在（仅首帧恢复走轻量 fast-path）。

---

## 4) 变更文件

- `packages/workers/src/durable/QuoteDO.ts`
- `apps/web/src/lib/api/useQuoteWebSocket.ts`

---

## 5) Check 结果

已执行：
- `corepack pnpm --filter workers check` ✅
- `corepack pnpm --filter web check` ✅

---

## 6) 预期收益（原因 → 改动 → 收益）

1. **首帧被批处理/压缩阻塞** → 引入 fast-path 最小首帧 + 轻量编码 → `resync_ack -> first tick` 显著缩短。  
2. **全量补齐与首恢复耦合** → 分层发送（首帧同步，余量异步） → 首恢复稳定，长订阅集下抖动降低。  
3. **控制消息可误触 recovering** → recovering 仅由 `resync_ack` + symbol 级数据到达驱动 → 状态机更可预测，UI 不再“假恢复/晚恢复”。
