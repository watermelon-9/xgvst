# P2.1_B Frontend WS 接入说明

## 变更范围

### 1) 新增 composable：`useQuoteWebSocket`
- 文件：`apps/web/src/lib/api/useQuoteWebSocket.ts`
- 提供能力：
  - `connect()`：建立 `/ws/quote` WebSocket 连接（默认路径可通过 options 覆盖）
  - `subscribe(symbols)`：订阅 symbols，连接已建立时会立即发送订阅指令
  - `unsubscribe(symbols)`：取消订阅 symbols
  - `close()`：关闭连接并清理 heartbeat
  - `onTick(handler)`：注册 tick 回调，返回解除函数
- Heartbeat 处理：
  - 客户端每 `15s` 发送 `{ type: 'ping' }`
  - 收到服务端 `ping`（字符串或 JSON）时自动回复 `pong`
  - 连接关闭/错误时停止 heartbeat 定时器

### 2) market 页面最小接入
- 文件：`apps/web/src/routes/market/+page.svelte`
- 接入方式：
  - 页面 mount 时建立 WS 连接并订阅示例 symbols：`000001`, `600519`
  - 在页面新增「实时 Tick（WS）」面板，显示每个 symbol 的最近 `price / changePct / source`
  - footer 增加「最新 WS Tick」摘要（symbol + source）
  - 页面 unmount 时执行 `unsubscribe + close`，防止泄漏

### 3) API 导出补充
- 文件：`apps/web/src/lib/api/index.ts`
- 导出：
  - `useQuoteWebSocket`
  - `type QuoteTick`

## 本地验证

### `check`
```bash
corepack pnpm check
```
结果：`svelte-check found 0 errors and 0 warnings`

### `build`
```bash
corepack pnpm build
```
结果：构建成功（web client + server + PWA 产物输出完成）

## 截图 / 日志要点

- 页面截图：`reports/lighthouse/P2.1_B/evidence/market-ws-panel.jpg`
- 截图要点：
  - market 页已出现「实时 Tick（WS）」模块
  - 已渲染示例 symbols（000001 / 600519）
  - 在无后端实时流输入时显示 `waiting...` 与占位值，未破坏原页面结构
