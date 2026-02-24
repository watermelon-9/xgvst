# P1.4_A WS 主域复测（路由修复后）

时间：2026-02-24

## 变更
- 在 `packages/workers/wrangler.toml` 增加路由：
  - `xgvst.com/ws/* -> xgvst-workers`
- 执行部署：`npx wrangler deploy`
- 部署回执含触发器：`xgvst.com/ws/* (zone name: xgvst.com)`

## 复测结果（20次）
- `wss://xgvst.com/ws/quote`
  - 成功率：20/20（100%）
  - p50：169ms
  - p95：252ms
- 对照 `wss://xgvst-workers.viehh642.workers.dev/ws/quote`
  - 成功率：20/20（100%）
  - p50：162ms
  - p95：233ms

## 结论
- 主域 WebSocket 已打通，P1.4 的 DoD4（主域 WS 链路）由 FAIL 转为 PASS。
