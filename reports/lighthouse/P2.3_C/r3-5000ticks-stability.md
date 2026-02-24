# P2.3_C / R3 Sentinel：5000 tick/s 级高频稳定性补证（DoD6）

- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 执行时间：2026-02-25（Asia/Shanghai）
- 原始证据：`reports/lighthouse/P2.3_C/raw/r3-5000ticks-stability.json`
- 执行脚本：`scripts/p23-r3-5000ticks-stability.mjs`

---

## 1) 压测设计（可复现近似压力方案）

### 1.1 目标
在本地 wrangler 环境下，构造 **5000 tick/s 级别**广播压力，并与存储压测并行，补齐 DoD6 高频稳定性证据，同时满足 DoD5 的性能报告完整度。

### 1.2 压力模型
- WS 并发连接：`260`
- 每连接订阅：`5 symbols`
- 传输模式：`bundle + gzip`
- 压测时长：`35s`
- 近似模型依据：Mock Source 每 `200ms` 出一轮 symbol tick（见 `BaseMockSource`），通过多连接同订阅放大广播 fanout，形成 5000+ tick/s 级吞吐。

### 1.3 并行存储压力
- 端点：`POST /api/debug/storage/bench`
- 并行采样：每 `3s` 触发一次，单次 `120 iterations`、`valueSize=256`
- 与 WS 广播同时间窗并发执行，用于观察负载叠加下 D1/KV 稳定性。

---

## 2) 关键指标结果

## 2.1 广播吞吐 / 带宽
- 连接成功率：`260/260 (100%)`
- 总 tick：`179,830`
- 平均吞吐：`5,138 tick/s`
- 总帧：`44,510`（全部为 bundle 帧）
- 平均帧率：`1,271.71 frame/s`
- 原始带宽：
  - `79,976.29 bytes/s`（≈ `78.10 KiB/s`）
  - `15.57 bytes/tick`

## 2.2 D1/KV（平均 + p95）
并行存储采样 `11` 轮，成功 `11` 轮，错误率 `0%`。

- KV Write：mean(avg)=`0.539 ms`，p95(p95)=`3 ms`
- KV Read：mean(avg)=`0.215 ms`，p95(p95)=`1 ms`
- D1 Read：mean(avg)=`0.370 ms`，p95(p95)=`1 ms`
- D1 Write：mean(avg)=`0.471 ms`，p95(p95)=`2 ms`

## 2.3 错误率
- WS error：`0`
- decode failed：`0`
- WS 相关错误率：`0%`
- 存储 bench 错误率：`0%`

## 2.4 内存 / 延迟抖动趋势
- Node 压测器峰值内存：
  - Peak RSS：`240,533,504 bytes`（≈ `229.39 MiB`）
  - Peak HeapUsed：`72,377,952 bytes`（≈ `69.03 MiB`）
- 趋势斜率：
  - RSS slope：`3,068,498.98 bytes/s`（≈ `2.93 MiB/s`）
  - Heap slope：`675,612.75 bytes/s`（≈ `0.64 MiB/s`）
- 到达间隔抖动（抽样客户端）：
  - gap avg：`210.98 ms`
  - gap p95：`320 ms`
  - gap p99：`450 ms`
- tick/s 趋势：
  - 全窗口 avg：`4,860.27`，p95：`5,980`
  - 去除首尾扰动后 steady(30s) avg：`4,944.93`，p95：`5,980`

---

## 3) DoD5 / DoD6 严格判定建议

## DoD5（性能报告：含 D1/KV 指标）
**建议：PASS（严格口径）**

判定规则（本轮全部满足）：
1. D1/KV 核心指标齐全（mean + p95）✅
2. 并行存储采样错误率 ≤ 1%（实际 0%）✅
3. WS 解码/传输错误率 ≤ 0.1%（实际 0%）✅
4. 带宽指标可量化（bytes/s, bytes/tick）✅

## DoD6（5000 tick/s 高频稳定性）
**建议：FAIL（严格口径）**

当前严格规则：
1. 平均吞吐 ≥ 5000 tick/s（实际 5138）✅
2. 秒级吞吐 p95 ≥ 4500（实际 5980）✅
3. 关键错误率达标（WS + storage）✅
4. 内存斜率稳定阈值：`|rssSlope| <= 2 MiB/s`（实际 ≈ 2.93 MiB/s）❌

> 结论：吞吐与错误率达标，但内存增长斜率超出严格阈值，按“最严门禁”建议 DoD6 暂不通过。

---

## 4) 后续建议（面向 DoD6 过门槛）

1. 将压测延长到 `60s~120s`，区分 warmup 与 steady leak，避免短窗口斜率偏大。  
2. 增加 DO 侧内存可观测（当前主要是压测器进程口径），补 Worker 实例内存证据。  
3. 固化双门槛：
   - 吞吐门槛：`avg >= 5000 且 p95 >= 4500`
   - 稳定门槛：`errorRate=0 且 steady RSS slope <= 2 MiB/s`（建议按 60s 窗口复核）

---

## 5) 本轮产物

- 新增脚本：`scripts/p23-r3-5000ticks-stability.mjs`
- 原始数据：`reports/lighthouse/P2.3_C/raw/r3-5000ticks-stability.json`
- 报告：`reports/lighthouse/P2.3_C/r3-5000ticks-stability.md`
