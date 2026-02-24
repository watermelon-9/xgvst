# P1.4 DoD 更新（2026-02-24）

基于路由修复后的最新复测，状态更新如下：

- DoD4（主域 WebSocket 路由联通）：**PASS**
  - 证据：`reports/lighthouse/P1.4_A/ws-prod-retest-after-route.md`
  - 关键数据：`wss://xgvst.com/ws/quote` 20/20 成功，p50 169ms，p95 252ms

其余项维持此前判定：
- DoD2（TLS1.3）：PASS
- DoD3（Workers WebSocket）：PASS
- DoD1（h3 强证据）、DoD5（0-RTT命中率）、DoD6（移动端实机）：待补齐/阻塞
