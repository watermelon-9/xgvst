# P2.1 Sub-C 第三轮（Sentinel验收采样）DoD4/DoD5 最新硬指标

- 采样时间（UTC）: 2026-02-24T10:41:48Z ~ 2026-02-24T10:42:18Z
- 环境（最新部署）: `wss://xgvst-workers.viehh642.workers.dev/ws/quote`
- 状态接口: `https://xgvst-workers.viehh642.workers.dev/api/source/status`
- 采样脚本: `scripts/p21-reconnect-switch-sla.mjs`
- 原始数据: `reports/lighthouse/P2.1_R3_C/dod4-dod5-latest-sampling.json`

## 1) 采样规模（满足门槛）

- reconnect 样本: **20**（要求 `>=20`）✅
- switch 样本: **10**（要求 `>=10`）✅

## 2) DoD4（WS reconnect open latency ≤ 3000ms）

- p50: **121 ms**
- p95: **206 ms**
- passRate: **100%**（20/20）
- 判定: **PASS**

## 3) DoD5（source switch latency < 200ms）

- p50: **1925 ms**
- p95: **2011 ms**
- passRate: **0%**（0/10）
- 判定: **FAIL**

## 4) DoD5差距（对目标 200ms）

- p50差距: **+1725 ms**（1925 - 200）
- p95差距: **+1811 ms**（2011 - 200）
- passRate差距: **-100 个百分点**（目标100%，当前0%）

## 5) 结论（硬指标）

- **DoD4: PASS**（reconnect稳定达标）
- **DoD5: FAIL**（switch 延迟显著超标，且通过率为 0%）

