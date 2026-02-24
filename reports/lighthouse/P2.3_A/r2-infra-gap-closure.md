# P2.3_A / R2 Infra Gap Closure（Sub-A）

更新时间：2026-02-25（Asia/Shanghai）  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## ✅1详细步骤

### 1.1 index.ts / QuoteDO 路径复核与 JSON 残留清理

- 复核结果：
  - `index.ts` 主链路已为 `protobufCodec.encodeQuoteTick`。
  - `QuoteDO.ts` 主链路已为 protobuf（legacy）与 bundle(delta+压缩)二进制。
  - KV 快照路径为 `quote:${symbol}`（protobuf snapshot）。
- 本轮清理：
  - `QuoteDO` 移除 `transport='json'` 模式；`TransportMode` 收敛为 `legacy | bundle`。
  - `sendLegacyTick` 移除 JSON 行情 fallback；仅保留 `QT1_DEBUG_FALLBACK=1` 时的 QT1 调试二进制兜底。
  - 非调试下编码失败直接记 dropped（不再回退 JSON 行情）。

### 1.2 D1/KV 可观测埋点（延迟、错误码）

- 在 `QuoteDO` 接入 `StorageTelemetry`：
  - `kv snapshot.put`
  - `kv snapshot.get`
  - `kv snapshot.read_error`
- 暴露路径：
  - `GET /api/do/metrics`（含 `payload.stats.storage`）
- 日志输出：
  - 统一 `console.log(JSON.stringify({ tag: 'storage_observe', ... }))`

### 1.3 Self-select API 最小联调脚本（增删改查+history）

- 新增脚本：`scripts/p23-self-select-smoke.mjs`
- 覆盖步骤：
  - GET 列表（查）
  - PUT 全量替换（改）
  - POST 新增 symbol（增）
  - DELETE symbol（删）
  - GET history（历史）
  - GET `/api/infra/storage-metrics`（埋点可抓取验证）
- 迁移脚本修复：`scripts/p23-d1-migrate.sh` 改为 `corepack pnpm exec wrangler ...`，避免本机无全局 wrangler 时失败。

### 1.4 执行与证据

- workers 类型与 TS 检查：
  - `corepack pnpm workers:check`
  - 证据：`reports/lighthouse/P2.3_A/raw/r2-workers-check.log`
- self-select 联调：
  - 首次（未迁移 D1）失败：`self-select-smoke-2026-02-24T18-24-36-478Z.json`
  - 执行迁移后通过：`self-select-smoke-2026-02-24T18-25-00-147Z.json`
- 存储可观测接口抓取：
  - `r2-storage-metrics-index.json`
  - `r2-storage-metrics-do.json`

---

## ✅2注意事项

1. **行情链路禁止 JSON 主路径**：本轮已将 QuoteDO 的 JSON transport/fallback 移除，仅保留 debug 开关下 QT1 调试帧。  
2. **可观测必须可抓取**：除日志外，必须有 API 抓取面；本轮通过 `/api/do/metrics` + `/api/infra/storage-metrics`（已抓样本）。  
3. **D1 先迁移再联调**：联调脚本已体现“先失败后修复（迁移）再通过”的闭环。  
4. **不阻塞实时主链路**：KV 持久化仍在 DO 异步慢任务，不阻塞 flush/broadcast。

---

## ✅3工作安排

### 已完成（R2 Sub-A）

- [x] 清理 QuoteDO JSON 残留（保留 debug 开关语义）
- [x] 增补 D1/KV 存储埋点（延迟/错误码 + 日志）
- [x] 暴露可抓取指标接口并抓样
- [x] 增加 self-select 最小联调脚本（CRUD + history）
- [x] 修复迁移脚本的 wrangler 调用方式
- [x] 产出 R2 报告与 raw 证据

### 产物路径

- 代码：
  - `packages/workers/src/durable/QuoteDO.ts`
  - `scripts/p23-self-select-smoke.mjs`
  - `scripts/p23-d1-migrate.sh`
  - `package.json`
- 报告：
  - `reports/lighthouse/P2.3_A/r2-infra-gap-closure.md`
- 证据：
  - `reports/lighthouse/P2.3_A/raw/*`

---

## ✅4验收标准(DoD)

> 按 P2.3 总 DoD 映射（仅 Sub-A 本轮可覆盖部分给出明确状态）

1. **DoD1：Protobuf 全链路打通（含前端解析）**  
   - Sub-A 结论：**部分通过**（Workers/DO 已收敛二进制；前端端到端证据仍依赖 Sub-B）。

2. **DoD2：KV 快照写读成功（并可量化）**  
   - Sub-A 结论：**通过（功能+可观测）**。已在 DO 侧对 snapshot put/get 打点并可抓取。

3. **DoD3：D1 自选 CRUD + history 正常**  
   - Sub-A 结论：**通过（最小联调）**。脚本在迁移后全链路通过，含 history。

4. **DoD4：生产无 JSON 行情残留**  
   - Sub-A 结论：**通过（后端主链路层面）**。QuoteDO 已移除 JSON transport/fallback，仅保留 debug QT1 开关。

5. **DoD5：性能报告（含 D1/KV 指标）**  
   - Sub-A 结论：**部分通过**。已具备埋点与抓取面；完整压测报告仍需 Sub-C 汇总。

6. **DoD6：高压稳定性（5000 Tick/s）**  
   - Sub-A 结论：**未覆盖**（需专项压测）。

---

## Commit 建议信息

`feat(workers): close p2.3 r2 infra gaps with storage observability and self-select smoke`
