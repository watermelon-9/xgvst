# P2.3 A / R4 — JSON residue closure（resync_ack.immediateData 清零）

## 结论
- ✅ 默认生产路径已移除 `resync_ack.immediateData` JSON 依赖（服务端不发送，前端不依赖）。
- ✅ 仅保留 **debug 开关** `QUOTE_DO_DEBUG_IMMEDIATE_DATA_JSON=1` 时可回放该字段；默认 `0`（关闭）。
- ✅ 严格口径复测通过：`textTick/json-fallback/immediateData` 残留均为 0。

## 改动说明

### 1) Workers / QuoteDO
文件：`packages/workers/src/durable/QuoteDO.ts`

- `SnapshotPlan` 去除 `immediateData`，恢复计划改为：
  - `targetSymbols`
  - `memoryRemainder`
  - `missingSymbols`
- `resync_ack` 默认不再携带 `immediateData`。
- 新增 debug 开关：
  - 环境变量：`QUOTE_DO_DEBUG_IMMEDIATE_DATA_JSON`
  - 默认关闭；仅为 `1` 时，`resync_ack` 才会携带：
    - `debugImmediateData: true`
    - `immediateData: [...]`
- debug 模式下避免重复下发：piggyback 的 `immediateData` 从后续 deferred snapshot 中扣除。

### 2) Web / 前端消费链路
文件：`apps/web/src/lib/api/useQuoteWebSocket.ts`

- `resync_ack` 类型扩展 `debugImmediateData?: boolean`。
- 前端消费 `immediateData` 增加双门禁：
  - `allowJsonTickFallback === true`
  - `payload.debugImmediateData === true`
- 因此默认生产路径（开关全关）不再消费任何 `immediateData`。

### 3) 复测脚本（严格口径）
文件：`scripts/p23-r3-json-residue-check.mjs`

- 增加严格检查项：
  - `noImmediateDataResidue`
- 增加计数器：
  - `resyncAckImmediateDataFrames`
  - `resyncAckImmediateDataTotal`

## 证据

### 执行命令
```bash
node scripts/p23-r3-json-residue-check.mjs
```

### 产物
- `reports/lighthouse/P2.3_A/raw/r3-json-residue-check-2026-02-24T18-48-13-366Z.json`

### 关键结果摘录
- `checks.noJsonTickFrames = true`
- `checks.noJsonFallbackTransportFrames = true`
- `checks.noImmediateDataResidue = true`
- `checks.gotBinaryFrames = true`
- `counters.textTickFrames = 0`
- `counters.textJsonFallbackTransportFrames = 0`
- `counters.resyncAckImmediateDataFrames = 0`
- `counters.resyncAckImmediateDataTotal = 0`

## 配置补充
文件：`.env.example`

新增：
```env
QUOTE_DO_DEBUG_IMMEDIATE_DATA_JSON=0
```
> 注：仅调试时设置为 `1`；严格口径/生产应保持 `0`。
