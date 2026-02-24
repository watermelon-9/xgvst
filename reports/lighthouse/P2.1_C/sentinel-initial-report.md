# P2.1 Sentinel 初版监测报告（Sub-C）

- 时间（UTC）: 2026-02-24T10:15:05Z
- 脚本: `scripts/p21-sentinel-smoke.mjs`
- 原始样本: `reports/lighthouse/P2.1_C/sentinel-sample-20260224T101433Z.json`
- latest: `reports/lighthouse/P2.1_C/sentinel-latest.json`

## 1) 监测范围与方法

围绕 P2.1 新接口做连续采样：

1. `GET /api/source/status`
   - 周期轮询，记录 `activeSource`、`reconnecting`、`failoverCount` 与可用性。
2. `WS /ws/quote`
   - 连续连接多个 session cycle，订阅 `000001,600519,300750`。
   - 记录 open 延迟、tick 到达时间、重连成功情况。

> 说明：`/api/source/status` 在 `xgvst.com` 主域当前返回 404，本次自动切换到 workers 域 `xgvst-workers.viehh642.workers.dev` 完成采样。

## 2) 核心指标（初版最小样本）

### A. Source 状态

- 轮询次数: **6**
- 成功次数: **6**（成功率 **100%**）
- activeSource 分布:
  - `alltick`: **6/6**
- reconnecting=true 样本: **0**
- failoverCount 变化量: **0**（采样窗口内无切换）

### B. Tick 到达延迟分布（WS）

- tick 样本数: **48**
- 原始延迟（`receiveTs - serverTs`）:
  - p50: **-36 ms**
  - p95: **270 ms**
- 时钟偏移修正（+37ms）后:
  - p50: **1 ms**
  - p90: **45 ms**
  - p95: **307 ms**
  - max: **308 ms**

> 解释：出现负延迟主要由客户端/服务端时钟偏差导致，故报告同时给出修正后分布用于阈值建议。

### C. 重连成功率（客户端连续重连）

- WS cycles: **3**
- 重连尝试: **2**
- 重连成功: **2**
- 重连成功率: **100%**
- 有 tick 的 cycle: **2/3**（存在 1 个周期连上但未收到 tick）

## 3) 初步风险判断

1. **域名路由一致性风险（中）**
   - 主域 `xgvst.com/api/source/status` 404，监控与业务观测需依赖 workers 子域。
2. **尾延迟波动风险（中）**
   - 修正后 p95 达 307ms，说明有明显尾部抖动。
3. **“连通但无tick”风险（中）**
   - 1/3 周期出现 open 成功但无 tick，需要继续验证是短暂源侧空窗还是订阅同步时序问题。

## 4) 下一步监控阈值建议（先行版）

建议先以“告警分级”落地，后续再用更大样本收敛：

1. **Source 可用性**
   - `/api/source/status` 成功率 < 99%（5分钟窗口）=> Warning
   - 成功率 < 95% => Critical
2. **Source 健康**
   - `reconnecting=true` 连续 > 30s => Warning
   - `failoverCount` 5分钟内增量 >= 3 => Warning；>=5 => Critical
3. **Tick 延迟（修正后）**
   - p95 > 400ms（5分钟）=> Warning
   - p95 > 800ms（持续2个窗口）=> Critical
4. **WS 重连质量**
   - 重连成功率 < 98%（30分钟）=> Warning
   - 重连成功率 < 95% => Critical
   - open 成功但 10s 内无 tick 比例 > 5% => Warning

## 5) 已完成交付

- 新增连续监测脚本：`scripts/p21-sentinel-smoke.mjs`
- 产出初版监测样本：`reports/lighthouse/P2.1_C/sentinel-sample-20260224T101433Z.json`
- 产出初版报告：`reports/lighthouse/P2.1_C/sentinel-initial-report.md`
