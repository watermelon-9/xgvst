# P2.5_B R1 v2 前端交付报告（Auth仅邮箱 + Auth页无导航栏 + 红紫渐变）

- 执行人：Sub-B (Frontend)
- 执行时间：2026-02-25
- 版本口径：P2.5 v2（强约束）
- 代码范围：`apps/web`

---

## ✅ 详细步骤（逐条映射）

### 1) 实现/调整 auth 三页（仅邮箱流程）
已新增：
- `src/routes/auth/login/+page.svelte`
- `src/routes/auth/register/+page.svelte`
- `src/routes/auth/forgot-password/+page.svelte`

实现说明：
- 登录：邮箱 + 密码。
- 注册：邮箱 + 密码 + 确认密码。
- 找回密码：仅邮箱。
- 全部页面均无手机号/验证码入口，符合“仅邮箱流程”。

### 2) 在 `+layout.svelte` 做路由级控制：`/auth/*` 不渲染 AppHeader
已改造：
- `src/routes/+layout.svelte`

实现说明：
- 新增 `AppHeader` 全局组件。
- 通过 `page.url.pathname.startsWith('/auth')` 进行路由判定。
- `/auth/*` 路由不渲染 `AppHeader`。

### 3) 非认证页保留导航栏，认证页彻底隐藏导航栏
已实现：
- 非认证页（如 `/market`）显示 `AppHeader`。
- 认证页（`/auth/login|register|forgot-password`）不显示导航栏。

### 4) 视觉按 v2：红紫渐变、按钮/输入框尽量还原；禁止行内 style
已改造：
- `src/app.css` 增加 auth 样式体系：`auth-shell/auth-card/auth-field/auth-submit/...`
- 统一红紫渐变背景、玻璃拟态卡片、按钮/输入框样式。
- 未使用行内 `style`。

### 5) 表单实时校验 + loading + toast，禁用 alert
已实现：
- 实时校验：邮箱格式、密码长度、确认密码一致性（注册页）。
- Loading：提交按钮根据异步状态切换文案并禁用。
- Toast：新增全局 toast 机制（`useToast` + `ToastViewport`）。
- 全仓未新增 `alert`，认证流程提示均改为 toast。

新增文件：
- `src/lib/ui/toast.svelte.ts`
- `src/lib/components/ToastViewport.svelte`

### 6) 登录成功跳 `/market` + 自选同步
已实现（登录页）：
- `auth.signIn(email)`
- `auth.syncWatchlist(mockUniverse.watchlist.map(symbol))`
- 成功后 `goto('/market')`

说明：
- 同步结果通过 toast 提示（成功/异常）。

### 7) 多端截图证据（PC/平板/手机）
已产出截图（见证据目录）：
- `reports/lighthouse/P2.5_B/evidence/auth-login-pc.png`
- `reports/lighthouse/P2.5_B/evidence/auth-login-tablet.png`
- `reports/lighthouse/P2.5_B/evidence/auth-login-mobile.png`
- `reports/lighthouse/P2.5_B/evidence/auth-register-pc.png`
- `reports/lighthouse/P2.5_B/evidence/auth-register-tablet.png`
- `reports/lighthouse/P2.5_B/evidence/auth-register-mobile.png`
- `reports/lighthouse/P2.5_B/evidence/auth-forgot-password-pc.png`
- `reports/lighthouse/P2.5_B/evidence/auth-forgot-password-tablet.png`
- `reports/lighthouse/P2.5_B/evidence/auth-forgot-password-mobile.png`

补充（验证导航显示/隐藏）：
- `reports/lighthouse/P2.5_B/evidence/market-with-header-pc.png`
- `reports/lighthouse/P2.5_B/evidence/market-with-header-tablet.png`
- `reports/lighthouse/P2.5_B/evidence/market-with-header-mobile.png`

### 8) 输出报告
已输出本文件：
- `reports/lighthouse/P2.5_B/r1-v2-frontend-auth-no-header.md`

### 9) check/build 通过并 commit
本次执行结果：
- `pnpm check`：PASS
- `pnpm build`：PASS
- commit：已完成（见提交信息）

---

## ✅ 注意事项

1. 本次登录/注册/找回为前端演示流，登录态依赖既有 `useAuth` 本地状态与接口兜底逻辑。  
2. 自选同步在登录成功后即触发一次，市场页仍保留既有自动同步/合并逻辑。  
3. 导航栏隐藏是路由级控制，不依赖页面级手工隐藏，避免漏网页面。  
4. Toast 为全局挂载，认证页与非认证页统一可用。

---

## ✅ 工作安排（实际执行顺序）

1. 先改布局层（路由级 AppHeader 显示/隐藏）。
2. 再补通用能力（Toast store + Toast 容器 + AppHeader 组件）。
3. 实现 auth 三页（仅邮箱、实时校验、loading、toast）。
4. 登录串联“成功跳转 market + 自选同步”。
5. 运行 `check/build`。
6. 生成多端截图证据并归档。
7. 输出 DoD 报告并提交代码。

---

## ✅ DoD（PASS/FAIL）

| DoD项 | 结果 | 说明 |
|---|---|---|
| 1. `/auth/login /auth/register /auth/forgot-password` 仅邮箱流程 | PASS | 三页已落地，无手机号入口 |
| 2. `+layout.svelte` 路由级控制 `/auth/*` 不渲染 AppHeader | PASS | `startsWith('/auth')` 判定 |
| 3. 非认证页保留导航栏，认证页隐藏导航栏 | PASS | `/market` 有头部，`/auth/*` 无头部 |
| 4. v2 红紫渐变视觉还原，禁止行内style | PASS | 样式集中在 `app.css`，无 inline style |
| 5. 实时校验 + loading + toast，禁用 alert | PASS | 三页实时校验/加载态；toast替代 alert |
| 6. 登录成功跳 `/market` + 自选同步 | PASS | 登录后先 `syncWatchlist` 再 `goto('/market')` |
| 7. 多端截图证据（PC/平板/手机） | PASS | 12 张证据图已归档 |
| 8. 报告输出到指定路径 | PASS | 本文件已生成 |
| 9. check/build 通过并 commit | PASS | check/build 均通过，已提交 |

---

## 变更清单（关键文件）

- `apps/web/src/routes/+layout.svelte`
- `apps/web/src/app.css`
- `apps/web/src/lib/components/AppHeader.svelte`
- `apps/web/src/lib/components/ToastViewport.svelte`
- `apps/web/src/lib/ui/toast.svelte.ts`
- `apps/web/src/routes/auth/login/+page.svelte`
- `apps/web/src/routes/auth/register/+page.svelte`
- `apps/web/src/routes/auth/forgot-password/+page.svelte`
- `reports/lighthouse/P2.5_B/evidence/*`
- `reports/lighthouse/P2.5_B/r1-v2-frontend-auth-no-header.md`
