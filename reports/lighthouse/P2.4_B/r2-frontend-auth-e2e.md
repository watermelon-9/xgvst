# P2.4_B R2 前端 Auth 流程 E2E 验收报告（Sub-B）

日期：2026-02-25  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 第一段｜范围与执行口径（按任务书严格推进）

本轮仅聚焦 P2.4 R2 Sub-B（Frontend）验收目标：
1) 完成 `useAuth` 在页面层可见状态流（`anonymous/authenticated`）并提供“自选同步”可见证据；
2) 验证登录后自动拉取并合并自选（至少本地模拟链路）；
3) 输出可复核的截图/快照与 DoD 对应结论。

执行环境为本地 `apps/web` 开发服务（`http://127.0.0.1:4173/market`），后端 auth 接口不可用时，按“本地模拟链路”完成闭环验证（localStorage fallback + 页面合并展示 + 订阅范围联动）。

---

## 第二段｜实现变更（useAuth 状态流 + 自动拉取/合并链路）

本轮完成以下前端实现并落地在可视化页面：

- `apps/web/src/lib/auth/useAuth.svelte.ts`
  - 新增拉取状态字段：`lastSelfSelectPullAt / lastSelfSelectPullError / lastSelfSelectPullSource / lastSelfSelectPullEndpoint`；
  - 新增 `pullWatchlistSymbols()`：优先尝试 `/v2/self-selects`，再尝试 `/api/self-selects`，失败时 fallback 本地 `localStorage`；
  - 新增 `mergeWatchlist(localWatchlist)`：将拉取到的 symbols 去重后合并到页面自选列表，补齐占位条目；
  - `syncWatchlist()` 保持非阻塞 side-effect，失败仅记录状态，不阻断页面。

- `apps/web/src/routes/market/+page.svelte`
  - 新增“Auth 状态流（P2.4 R2 证据）”面板，直接展示 anonymous/authenticated、拉取时间、同步时间、合并 symbols、错误状态；
  - 新增本地演示登录控件（`signIn/signOut`）用于切换状态流；
  - onMount 拉取 universe 时增加 `mockUniverse` 兜底，确保无后端时页面可演示；
  - 登录后自动触发 `mergeWatchlist`，并与 `setQuoteSubscriptionScope` 联动验证“当前个股+合并后自选”订阅范围。

- `apps/web/src/routes/detail/[symbol]/+page.svelte`
  - 对齐 market 页链路：登录后自动拉取并合并自选，再执行同步 side-effect（不阻塞渲染链路）。

- `apps/web/src/app.css`
  - 增补 `auth-input` 样式，确保演示面板可读。

静态检查结果：`npm run check --prefix apps/web` 通过（0 error / 0 warning）。

---

## 第三段｜E2E 验证与证据（页面可见 + 本地模拟链路）

### A. 匿名态可见证据
- 截图：`reports/lighthouse/P2.4_B/evidence/r2-frontend-auth-e2e/01-anonymous-state.jpg`
- 关键观测：
  - 当前状态 `anonymous`
  - 当前用户 `--`
  - 最近自动拉取 `--`
  - 合并结果 `none`

### B. 登录后自动拉取并合并（本地模拟链路）
- 预置模拟数据：
  - `localStorage['xgvst.auth.selfSelectSymbols.demo-user-a'] = ["000001","600519","688001","002594"]`
- 登录动作：输入 `demo-user-a` 并触发登录按钮；
- 截图：`reports/lighthouse/P2.4_B/evidence/r2-frontend-auth-e2e/02-authenticated-merge.jpg`
- 快照要点：`reports/lighthouse/P2.4_B/evidence/r2-frontend-auth-e2e/03-snapshot-key-points.txt`
- 关键观测：
  - 状态切换为 `authenticated`
  - 自动拉取记录出现（source=`localStorage`）
  - 合并结果显示新增 symbols：`002594, 688001`
  - 自选列表出现新增条目“自选 002594 / 自选 688001”
  - 当前订阅 symbols 扩展为：`000001, 600519, 300750, 002594, 688001`

结论：即使后端接口不可达，前端仍完成“登录→自动拉取→合并展示→订阅联动”的本地可验收链路。

---

## 第四段｜DoD 映射与判定

| DoD | 要求 | 本轮证据 | 判定 |
|---|---|---|---|
| DoD-3（前端侧） | 前端通过 `$lib/auth` 登录后自选自动同步并显示 | `02-authenticated-merge.jpg` + `03-snapshot-key-points.txt`，可见新增 symbols 与列表合并 | ✅ PASS（本地模拟链路） |
| DoD-4（前端可演示） | 多端一致目标前置：Web 侧状态流与同步证据可见、可复核 | `01-anonymous-state.jpg` 与 `02-authenticated-merge.jpg` 对照可见状态流切换 | ✅ PASS（Web 演示达成） |
| DoD-5（前端变更不破链路） | 不引入新的渲染/类型错误，保留行情链路稳定 | `npm run check --prefix apps/web` 0 error；订阅 symbols 随合并扩展 | ✅ PASS |

收口结论：P2.4 R2 Sub-B 前端任务已达成“可演示、可验收”。后续联调建议：接入真实 Access/JWT 后补一组 remote-source=API 的同口径截图，作为 DoD-1/DoD-6 的前端配套证据。
