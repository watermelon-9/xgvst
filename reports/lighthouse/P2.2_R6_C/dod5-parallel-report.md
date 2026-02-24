# P2.2 Sub-C（Sentinel）R6 并行补证报告（DoD5 + DoD4建议）

- 时间：2026-02-24
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 证据汇总：`reports/lighthouse/P2.2_R6_C/dod5-parallel-evidence.json`

## 1) 1000 并发压测（protobuf/二进制下发链路）

基于现有 Sentinel 压测脚本重跑：

```bash
ulimit -n 4096
P22_ACTUAL_CONCURRENCY=1000 P22_TARGET_CONCURRENCY=1000 P22_TEST_DURATION_MS=30000 \
node scripts/p22-sentinel-load-test.mjs
```

主证据：`reports/lighthouse/P2.2_C/sentinel-load-evidence.json`（本轮生成时间 `2026-02-24T14:20:35.970Z`）

关键结果：
- 并发：`1000/1000`（DoD4 并发门槛已达到）
- 重连成功率：`100%`（600/600）
- 订阅恢复成功率：`100%`（600/600）
- 恢复延迟：`p50=269ms`，`p95=396ms`
- 带宽节省率（相对 JSON 等价字节）：`51.72%`
  - rawBytes: `15,185,160`
  - jsonEquivalentBytes: `31,449,700`

结论（按本轮目标“冲 80%+”）：
- **DoD5（80%+口径）未达标**，当前为 **51.72%**，缺口 **28.28pct**。
- 若按旧门槛（>=30%）则已通过，但本轮更高目标未达成。

## 2) DO 内存口径采集

优先 API 采集：
- `GET https://xgvst-workers.viehh642.workers.dev/api/do/metrics`

本轮可得：
- `flushCount=392`
- `sentBinaryFrames=254832`
- `droppedFrames=0`
- 仅有连接/flush/frame 等业务计数

缺口说明：
- **现有 DO 指标不含实例内存（RSS/Heap）字段**。
- 在当前权限与接口下，无法从 Dashboard/API 直接拉取 DO 峰值内存。

替代证据（明确是代理口径）：
- 压测器进程峰值 RSS：`479,019,008 bytes`（约 `456.83 MiB`）
- 压测器峰值 HeapUsed：`134,836,808 bytes`（约 `128.59 MiB`）
- DO droppedFrames 为 0，可作为“高压下未出现明显丢帧/退化”的旁证，但**不能替代 DO 内存峰值**。

## 3) 移动端 Lighthouse（首页 + market）

执行：
- `npx -y lighthouse https://xgvst.com ... --output-path=reports/lighthouse/P2.2_R6_C/lh-mobile-home.json`
- `npx -y lighthouse https://xgvst.com/market ... --output-path=reports/lighthouse/P2.2_R6_C/lh-mobile-market.json`

结果（`reports/lighthouse/P2.2_R6_C/lighthouse-mobile-summary.json`）：
- Home: score `82`，LCP `2265.9ms`，TBT `583ms`
- Market: score `96`，LCP `1132.9ms`，TBT `235ms`

是否下降：
- 以历史基线 `P1.3_RESCUE_C_DoD5_2026-02-24/summary.json` 中 home 移动端中位数 `92` 对比，
  - Home 本轮 `82`，**下降 10 分**（有回退）
- Market 缺少同口径历史专项基线，本轮 `96`，暂未观察到明显下降信号。

## 4) DoD5 达标判定（本轮目标）

- 目标：带宽节省率 `>=80%`
- 实际：`51.72%`
- 结论：**未达标**

## 5) DoD4 当前恢复延迟与可选小修建议

当前恢复指标（1000 并发重跑）：
- 恢复成功率：`100%`
- 恢复延迟：`p50=269ms`，`p95=396ms`

可选小修（低风险、可并行）：
1. **重连后首帧旁路合包**：首帧即时下发，后续再回到 100ms flush，压低恢复 p95。
2. **重连首跳 backoff 微调**：保持抖动策略，首跳延迟可下探到 `80~120ms`，削峰后尾延迟更稳。
3. **恢复暖包**：重连确认后主动推送最近一帧缓存（warm tick），减少“等下一次源推送”造成的尾部等待。

---

## 附：本轮新增文件

- `reports/lighthouse/P2.2_R6_C/dod5-parallel-report.md`
- `reports/lighthouse/P2.2_R6_C/dod5-parallel-evidence.json`
- `reports/lighthouse/P2.2_R6_C/lh-mobile-home.json`
- `reports/lighthouse/P2.2_R6_C/lh-mobile-market.json`
- `reports/lighthouse/P2.2_R6_C/lighthouse-mobile-summary.json`
