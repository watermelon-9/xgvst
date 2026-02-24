# P2.1 R3 Sub-B（Frontend稳定性）验收证明

## 目标对照

- ✅ 在 market 页 WS 面板新增可观测项：
  - 连接状态（`status`）
  - 重连次数（`reconnectCount`）
  - 最近重连耗时（`lastReconnectDurationMs`）
- ✅ 保持二进制优先路径，不回退 JSON：
  - `useQuoteWebSocket` 默认 `allowJsonTickFallback = false`
  - market 页显式 `useQuoteWebSocket({ allowJsonTickFallback: false })`
  - 解码链路仍为 `custom-binary -> protobuf`（均为二进制）
- ✅ check/build 通过

## 关键实现文件

1. `apps/web/src/lib/api/useQuoteWebSocket.ts`
   - 新增状态类型：`WsConnectionStatus`
   - 新增统计结构：`QuoteSocketStats`
   - 新增自动重连与观测：
     - `status` 状态流转
     - `reconnectCount` 统计
     - `lastReconnectDurationMs` 记录最近一次重连耗时
     - `onStats`/`getStats` 对外暴露
   - 保持二进制优先：`allowJsonTickFallback` 默认改为 `false`

2. `apps/web/src/routes/market/+page.svelte`
   - WS 面板新增三行观测信息展示：连接状态 / 重连次数 / 最近重连耗时
   - 注册 `quoteSocket.onStats(...)` 响应状态更新
   - 显式关闭 JSON fallback
   - 渲染链路文案更新为：`WS frame(binary/protobuf) -> ...`

3. `apps/web/src/lib/api/index.ts`
   - 导出新增类型：`QuoteSocketStats`、`WsConnectionStatus`

## 构建与检查日志

- check 日志：`reports/lighthouse/P2.1_R3_B/check.log`
- build 日志：`reports/lighthouse/P2.1_R3_B/build.log`

### 结果摘要

- `svelte-check found 0 errors and 0 warnings`
- `vite build` client/server 均成功
- `adapter-cloudflare done`

## 结论

本轮 Sub-B 前端稳定性目标已完成：market 页已具备 WS 稳定性可观测信息，且数据通路继续保持二进制优先，不做 JSON 回退。check/build 均通过，可用于 P2.1 R3 验收联调。
