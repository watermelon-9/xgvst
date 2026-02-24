# P2.2 R11 Sub-A — DoD4 恢复优化实现报告

## 变更范围
- `packages/workers/src/durable/QuoteDO.ts`
- `apps/web/src/lib/api/useQuoteWebSocket.ts`
- `apps/web/src/lib/runes/quote-store.svelte.ts`
- `apps/web/src/routes/market/+page.svelte`

## 对照硬要求

### 1) 服务端 DO 实现 `resync` 回放（KV 优先，内存 fallback）
已完成：
- 在 DO 的消息处理链路中保留 `type: 'resync'` 分支。
- `resync` 收到后会：
  1. 以请求 symbols 为准重建订阅集合；
  2. 立即回放对应 symbol 的最新快照。
- 快照读取顺序：
  1. `QUOTE_KV`（`quote:snapshot:<symbol>`）；
  2. 内存 `latestTickBySymbol` 兜底。

实现点：
- `resolveSnapshotBySymbol()`
- `readSnapshotFromKv()`
- `sendImmediateSnapshot()` 改为异步并行按 symbol 取快照后立即发送。

### 2) 每次 tick 更新维护快照（内存必做，KV 尽力写）
已完成：
- 在 `SourceManager` 回调中每个 tick 都更新内存快照 `latestTickBySymbol`。
- 同时执行 `persistSnapshot()` 对 `QUOTE_KV` 写入 JSON 快照。
- KV 写入失败被吞并，不阻塞主链路（符合“失败不影响主链路”）。

### 3) 前端 `onopen` 立即发送 `resync`，并展示“恢复中”直到补齐
已完成：
- `useQuoteWebSocket` 的 open 后不再仅做 subscribe flush，而是调用 `requestResync([...subscribedSymbols])`。
- 新增恢复状态：
  - `recovering: boolean`
  - `pendingRecoverySymbols: string[]`
- 收到补齐帧（binary/protobuf 或允许的 JSON tick）后按 symbol 逐个出队；全部补齐才从 recovering 切到 ready。
- 市场页增加“恢复补齐状态”展示（含待补齐 symbols）。

### 4) 心跳参数改为 30s sweep / 60s timeout 且可配置
已完成：
- DO 默认值：
  - `DEFAULT_HEARTBEAT_SWEEP_MS = 30000`
  - `DEFAULT_HEARTBEAT_TIMEOUT_MS = 60000`
- 保留 env 覆盖（`QUOTE_DO_HEARTBEAT_SWEEP_MS` / `QUOTE_DO_HEARTBEAT_TIMEOUT_MS`）并做边界保护。

### 5) 不破坏现有 bundle/protobuf 与 80% 带宽路径
已完成：
- 保留 bundle/protobuf 编解码主路径不变。
- `resync` 回放仍复用原有发送策略：
  - bundle 客户端走 bundle 帧；
  - legacy 客户端走 protobuf（仅失败时 fallback）。
- 未改动 bundle delta 编码结构与 protobuf schema。

### 6) 报告输出并提交
已完成本报告文件创建：
- `reports/lighthouse/P2.2_R11_A/dod4-resync-implementation.md`

---

## 风险评估
1. **KV 读写放大风险**
   - tick 高频时，KV 写 QPS 可能增大。
   - 当前策略为尽力写，失败不阻塞；可后续加采样/节流。

2. **恢复窗口内的“长尾 symbol”显示**
   - 若某 symbol KV 与内存均无快照，则会保持在 pending，直到首帧到达。
   - 这是预期行为（确保“补齐前仍显示恢复中”）。

3. **多端同 symbol 的快照一致性**
   - KV 为最近一次写入，跨 DO 实例恢复更稳定；但极短窗口仍可能出现新旧交错。
   - 对行情 UI 属可接受最终一致性。

## 回滚点
按最小粒度可回滚：
1. **仅回滚前端恢复状态逻辑**
   - 回退 `useQuoteWebSocket.ts` 与 `quote-store.svelte.ts`、`market/+page.svelte`。
2. **仅回滚 DO 的 KV 快照链路**
   - 移除 `persistSnapshot/readSnapshotFromKv/resolveSnapshotBySymbol`，恢复纯内存回放。
3. **完整回滚 R11 改造**
   - 将上述 4 个文件回退到本次提交前版本。

## 自检结果
- `corepack pnpm workers:check` ✅
- `corepack pnpm check` ✅
