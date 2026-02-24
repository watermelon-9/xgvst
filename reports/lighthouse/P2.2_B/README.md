# P2.2-B Frontend 接入说明与证据

## 变更目标
前端完成“按需订阅链路接入”：
- 订阅只发送「当前个股 + 自选」
- 通过 `quoteStore` 承接 websocket 数据
- `market/detail` 最小联动，切换 symbol 可触发精准重订阅

## 代码变更清单
1. `apps/web/src/lib/api/useQuoteWebSocket.ts`
   - `subscribe(symbols)` 改为**精准集合**语义：
     - 规范化 symbols（trim + 去重）
     - 计算移除集合并发送 `unsubscribe`
     - 使用最新完整集合发送 `subscribe`
2. `apps/web/src/lib/runes/quote-store.svelte.ts`（新增）
   - 用 Svelte5 runes 管理 WS 行情状态
   - 暴露：
     - `mountQuoteStore()` 生命周期挂载/卸载
     - `setQuoteSubscriptionScope({ activeSymbol, watchlistSymbols })`
   - 组件不再直接触达 websocket
3. `apps/web/src/routes/market/+page.svelte`
   - 移除组件内 websocket 连接逻辑
   - 改为通过 `quoteStore` + `setQuoteSubscriptionScope(...)`
4. `apps/web/src/routes/detail/[symbol]/+page.svelte`
   - 新增最小行情联动
   - route symbol 变化时刷新订阅 scope，触发精准重订阅

## 验证结果
- `corepack pnpm check`：通过（0 errors / 0 warnings）
- `corepack pnpm build`：通过

日志文件：
- `reports/lighthouse/P2.2_B/pnpm-check.log`
- `reports/lighthouse/P2.2_B/pnpm-build.log`

代码证据：
- `reports/lighthouse/P2.2_B/code-evidence.txt`

## DoD 覆盖回报
- **DoD2（前端承接订阅数据，避免组件直连 websocket）**：已覆盖
  - 依据：`quote-store.svelte.ts` 统一承接 + 页面仅调用 store API
- **DoD4（market/detail 最小联动 + 切 symbol 触发精准重订阅）**：已覆盖
  - 依据：`detail/[symbol]/+page.svelte` 的 `$effect` 按 `params.symbol` 更新 scope；
    `useQuoteWebSocket.subscribe` 改为精准集合语义

## 未达项
- 未发现本次子任务范围内的未达项。
