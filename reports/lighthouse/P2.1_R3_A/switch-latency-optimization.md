# P2.1 R3-A（Infra）DoD5 切换耗时优化报告

- 时间：2026-02-24
- 目标：将 DoD5 source switch latency 从 ~1.9s 降到 <200ms
- 结论：✅ 达成（P50=24ms，P95=108ms，10/10 pass）

## 1) 慢原因定位

### Root Cause A：Failover 固定等待 1000ms
`SourceManager.scheduleFailover()` 里原实现为 `setTimeout(..., 1000)` 后再执行 `ensureSourceReady()`。
这会直接引入 ~1s 的确定性延迟。

### Root Cause B：Mock source 首 tick 等待下一拍（900ms）
`BaseMockSource.startStreaming()` 原实现每轮 `sleep(900)` 后才发 tick。
切源后即使新源已连上，也要再等 ~900ms 才看到“新 source 的第一条 tick”。

### 合并效应
总切换耗时≈ `1000ms + 900ms + 事件循环/网络抖动`，实测约 1.9~2.0s。

---

## 2) 优化方案与代码改动

### A. SourceManager：去掉 1s failover 固定等待
文件：`packages/workers/src/sources/SourceManager.ts`

- 将 failover 调度从 `setTimeout(..., 1000)` 改为 `queueMicrotask(...)` 触发 `ensureSourceReady()`。
- 保留 `reconnecting` 防抖语义，避免并发重连抖动。

效果：切源连接阶段从“至少等 1s”变为“下一微任务即执行”。

### B. BaseMockSource：切换后立即首 tick + 提高周期
文件：`packages/workers/src/sources/BaseMockSource.ts`

- 新增 `emitSnapshotTicks()`，在 `connect()` 和 `subscribe()`（有新 symbol）后立即发送首 tick。
- 将流式周期从 900ms 下调到 200ms（`STREAM_TICK_MS=200`）。
- 抽离 `buildTick()` 统一构建，保持数据结构与稳定性。

效果：切源后可立即观察到新源 tick，无需等待下一拍。

---

## 3) 前后对比（同脚本、>=10 switch 样本）

脚本：`scripts/p21-reconnect-switch-sla.mjs`

### Before（优化前）
- 文件：`switch-latency-before.json`
- DoD5:
  - sampleCount: 10
  - p50: **1920ms**
  - p95: **2025ms**
  - passRate: **0%**

### After（优化后，已 deploy 后复测）
- 文件：`switch-latency-after.json`
- log：`switch-latency-after.log`
- DoD5:
  - sampleCount: 10
  - p50: **24ms**
  - p95: **108ms**
  - passRate: **100%**

### Delta
- p50: **-1896ms**
- p95: **-1917ms**
- passRate: **+100pp**

详见：`switch-latency-comparison.json`

---

## 4) 稳定性说明

- `reconnecting` 门控仍在，避免 failover 并发风暴。
- `source.close()` + `setSymbols()` 语义未改，订阅同步逻辑不变。
- 仅缩短 failover 调度窗口，并增加“首 tick 立即确认”能力。

---

## 5) 产物清单

- `reports/lighthouse/P2.1_R3_A/switch-latency-optimization.md`
- `reports/lighthouse/P2.1_R3_A/switch-latency-before.json`
- `reports/lighthouse/P2.1_R3_A/switch-latency-after.json`
- `reports/lighthouse/P2.1_R3_A/switch-latency-after.log`
- `reports/lighthouse/P2.1_R3_A/switch-latency-comparison.json`

