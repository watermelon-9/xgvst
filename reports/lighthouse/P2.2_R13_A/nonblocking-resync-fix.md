# P2.2 R13 Sub-A — DoD4 恢复时延“去阻塞”改造

## 变更目标
按用户1526建议，将 QuoteDO 的 resync / snapshot / KV 持久化路径从主链路阻塞式 await 改造为后台异步执行（优先 `state.waitUntil`），确保：
- resync 控制消息尽快返回；
- 快照编码/压缩发送不阻塞主消息处理；
- KV 慢 I/O 不阻塞；
- bundle/protobuf 路径与 DoD5（100ms+deflate）不回退。

## 改前阻塞点（主链路 await）
文件：`packages/workers/src/durable/QuoteDO.ts`

1. `onClientMessage -> resync/subscribe/unsubscribe` 里 `await this.syncUpstreamSubscriptions()`。
2. `onClientMessage -> resync/subscribe` 里 `await this.sendImmediateSnapshot(...)`，其中 bundle+deflate/gzip 可能触发较重编码/压缩。
3. `persistSnapshot` 内部 `await QUOTE_KV.put(...)`（虽由 `void` 调用，但未统一纳入 `waitUntil` 生命周期管理）。
4. `scheduleKvFallbackSnapshot` 通过裸 `void (async()=>...)` 执行，未统一走 `waitUntil`，并且发送前未显式检查 ws OPEN。

## 改后机制

### 1) 统一慢任务调度：`deferSlowTask`
新增 `deferSlowTask(run)`：
- 优先 `this.state.waitUntil(task)`；
- 兜底 `queueMicrotask`；
- 任务内部错误吞掉，不回灌主链路。

### 2) resync 路径“去阻塞”
`subscribe/resync/unsubscribe` 中的上游订阅同步改为：
- `this.deferSlowTask(() => this.syncUpstreamSubscriptions())`
- 不再阻塞 `onClientMessage` 主处理。

### 3) `sendImmediateSnapshot` 去阻塞主消息
- `sendImmediateSnapshot` 改为**同步准备快照命中结果**（memory hits / pending symbols）；
- 真正的快照发送（尤其 bundle 编码压缩）改为后台：`deferSlowTask(() => sendSnapshotTicks(...))`；
- 新增 `isSocketOpen` 与 `this.clients.get(ws) === client` 双检查，确保发送前/压缩后 ws 仍可用。

### 4) KV 持久化与 KV 回补统一后台化
- `persistSnapshot` 改为同步入口，KV put 走 `deferSlowTask`；
- `scheduleKvFallbackSnapshot` 改为 `deferSlowTask`，并在发送前做 ws OPEN 与 client 仍在池内检查。

### 5) close 相关不阻塞
- `cleanupClient` 的 `syncUpstreamSubscriptions` 改为 `deferSlowTask`，避免 close 清理路径阻塞。

## 功能与兼容性说明
- bundle/protobuf 主路径未改协议字段，不影响现有前端解码。
- DoD5 默认压缩策略（bundle 默认 deflate）未改。
- 批量 flush 频率（100ms）与 delta 阈值逻辑未改。
- resync 仍会快速触发 memory snapshot + KV fallback，只是编码发送改为后台，减少控制面等待。

## 风险点
1. resync ACK 早于上游订阅完成：短窗口内可能先收到 ACK 再收到补齐帧（语义可接受，换取主链路低时延）。
2. 后台任务增加后，极端高并发下 `waitUntil` 队列增长；当前策略为失败吞掉并统计 dropped（不拖垮主链路）。
3. 快照发送前后加了 OPEN 检查，连接抖动时可能放弃发送该轮快照（由后续增量/下一轮补齐）。

## 回滚方案
若线上观察到补齐不稳定或恢复时延劣化，可回滚到本次提交前版本，或局部回滚：
1. 将 `deferSlowTask(() => syncUpstreamSubscriptions())` 恢复为阻塞 await（仅 resync 路径）；
2. 将 `sendImmediateSnapshot` 恢复为 await 同步发送；
3. 保留 `persistSnapshot` 的 waitUntil 改造（低风险高收益）。

## 校验
已执行：
- `corepack pnpm --filter workers check` ✅
- `corepack pnpm check` ✅

