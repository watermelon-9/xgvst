# P2.4_B R1 前端认证与 v2 迁移（Sub-B）

日期：2026-02-25  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 第一段｜执行范围与约束（按任务书）

本轮仅处理 Frontend 子任务，目标聚焦三件事：

1. 落地 `$lib/auth/useAuth` 最小可用骨架（Svelte5 runes）。
2. 接入“自选股同步”调用点，优先走 v2 路径并兼容现网旧路径。
3. 不改动现有行情主链路（`useQuoteWebSocket -> quoteStore -> 页面`）行为。

实现边界：
- 不引入新的登录 UI 流程，仅提供 composable 能力与最小状态机；
- 同步调用采用“非阻塞 side-effect”，不得阻塞订阅与渲染；
- 失败仅记录状态，不抛出中断异常，确保行情链路稳定。

---

## 第二段｜`$lib/auth/useAuth` 设计与实现（Svelte5 runes）

新增文件：
- `apps/web/src/lib/auth/useAuth.svelte.ts`

核心设计：
- 单例 runes 状态：`status/user/lastSelfSelectSync*`；
- `bootstrap()`：从 `?authUserId=` 与 `localStorage(xgvst.auth.userId)`恢复身份；
- `signIn()/signOut()`：最小会话控制；
- `syncWatchlist(symbols)`：内部去重（fingerprint），避免重复写入；
- 兼容迁移：自选同步接口按顺序尝试：
  - `PUT {base}/v2/self-selects`
  - 404 时回退 `PUT {base}/api/self-selects`

实现要点：
- `normalizeSymbols + sort` 保证去重与稳定签名；
- `lastSelfSelectSyncFingerprint` 防抖重复同步；
- 同步失败写入 `lastSelfSelectSyncError`，不抛出到页面层。

---

## 第三段｜自选股同步调用点接入与链路保护

接入文件：
- `apps/web/src/routes/market/+page.svelte`
- `apps/web/src/routes/detail/[symbol]/+page.svelte`

改动方式：
- 页面 `onMount` 执行 `auth.bootstrap()`；
- 保留原有订阅作用域逻辑（`setQuoteSubscriptionScope`）不变；
- 新增独立 `$effect` 监听 `marketState.watchlist`，非阻塞触发：
  - `void auth.syncWatchlist(watchlistSymbols)`

为何不破坏行情链路：
- 同步调用与 WS 订阅完全解耦（独立 effect）；
- 不 await 同步请求，不影响 `mountQuoteStore()/resync` 时序；
- 即使接口失败，仅更新 auth 内部错误状态，不触发页面异常。

验证：
- 执行 `npm run check --prefix apps/web`
- 结果：`svelte-check found 0 errors and 0 warnings`

---

## 第四段｜DoD 映射与收口结论

| DoD | 交付项 | 证据 | 判定 |
|---|---|---|---|
| DoD-1 | `$lib/auth/useAuth` 最小骨架（runes） | `apps/web/src/lib/auth/useAuth.svelte.ts` | ✅ PASS |
| DoD-2 | 自选股同步调用点接入（不破坏行情链路） | `routes/market/+page.svelte`、`routes/detail/[symbol]/+page.svelte` | ✅ PASS |
| DoD-3 | v2 迁移兼容策略 | `syncWatchlist`: `/v2/self-selects` 优先 + `/api/self-selects` 回退 | ✅ PASS |
| DoD-4 | 可构建可检查 | `npm run check --prefix apps/web` 通过 | ✅ PASS |

结论：P2.4_B R1 前端任务已完成，可进入下一轮联调（后端真实 v2 接口上线后可移除 legacy 回退路径）。
