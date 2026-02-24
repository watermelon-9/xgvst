# P2.2 R7 Sub-C（Sentinel）DO 内存证据补齐报告

- 生成时间：2026-02-24 15:17 (Asia/Shanghai)
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 证据 JSON：`reports/lighthouse/P2.2_R7_C/do-memory-evidence.json`

## 1) 从现有 API/metrics 提取 DO 内存：尝试结果

### 1.1 API 实测（fresh sample）
- 接口：`GET /api/do/metrics?session=r7-audit-1771943847652`
- 返回字段包含：
  - `clients/subscriptions/pendingSymbols/flushCount`
  - `sentBinaryFrames/sentProtobufFrames/sentFallbackFrames/droppedFrames`
  - `lastFlushAt/source/limits`
- **未出现** `rssBytes/heapUsedBytes/memory*` 等 DO 内存字段。

### 1.2 代码口径审计（可审计）
- 文件：`packages/workers/src/durable/QuoteDO.ts`
- `QuoteDOStats` 类型字段仅覆盖连接、订阅、flush、frame、drop 等计数，**无内存字段**。

结论：当前可用 API + 代码定义均无法直接产出 **DO 单实例内存值**。

---

## 2) 1000 并发场景固定模板证据

采用现有 1000 并发有效样本（已落地证据）：
- 来源：`reports/lighthouse/P2.2_C/sentinel-load-evidence.json`
- 生成时间：`2026-02-24T14:20:35.970Z`

关键数据：
- 并发：`1000 / 1000`（缺口 0）
- 重连成功率：`100%`
- 订阅恢复成功率：`100%`
- 恢复延迟：`p50=269ms, p95=396ms`

内存相关（替代代理口径，仅审计旁证）：
- LoadRunner 峰值 RSS：`479,019,008 bytes`（`456.83 MiB`）
- LoadRunner 峰值 HeapUsed：`134,836,808 bytes`（`128.59 MiB`）
- 说明：该口径来自压测器进程，不等同 DO 单实例内存。

---

## 3) 不可得时的可审计替代口径与缺口

### 3.1 替代口径（可审计）
1. `LoadRunnerPeakRSS`（来自 `process.memoryUsage()` 采样）
2. `LoadRunnerPeakHeapUsed`（同上）
3. `DO droppedFrames`（来自 `/api/do/metrics`，用于稳定性旁证）

### 3.2 剩余缺口（量化）
- 必需指标：DO 单实例内存（如 `rssBytes`/`heapUsedBytes`）
- 当前可得：`0` 项
- 缺口：`1` 项（缺少可审计 DO 内存直接值）

---

## 4) 严格 DoD5 判定（本子任务口径）

严格 DoD5：**1000 并发场景下必须提供 DO 单实例内存可审计数值与采样链路。**

- 并发要求：`1000/1000` ✅
- DO 内存直接指标要求：`0/1` ❌

## 5) 结论

- **严格 DoD5 结论：FAIL**
- 量化缺口：
  - `concurrencyGap = 0`
  - `missingRequiredDoMemoryMetrics = 1`

> 通过条件（补齐后可转 PASS）：
> - 在同一 1000 并发压测窗口中，导出至少 1 个 DO 单实例内存指标（`rssBytes` 或 `heapUsedBytes`），并提供可复查的采样链路（API/日志/平台导出）。
