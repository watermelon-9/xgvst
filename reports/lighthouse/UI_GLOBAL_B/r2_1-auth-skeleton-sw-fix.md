# R2.1 Auth Skeleton + SW 404 收口报告（Sub-B）

## 1) 问题与目标
本轮阻断项有两处：
- 结构阻断：登录页为双栏骨架，而注册/忘记密码仍是单卡骨架，导致认证三页在信息架构与视觉节奏上不统一。
- 性能阻断：在 `/auth/*` 页面存在 `sw.js` 404（相对路径注册触发），造成控制台报错并影响 Lighthouse Best Practices 得分稳定性。

目标是在不降级审美的前提下，统一三页容器与布局体系，并消除 auth 路由下 service worker 404。

## 2) 实施方案与改动
已将认证三页统一为同一套布局骨架：`auth-shell + auth-card + auth-side + auth-main-panel + auth-form`。
- `apps/web/src/routes/auth/login/+page.svelte`
  - 登录页由 `auth-login-brand/auth-login-form-panel` 切换到通用 `auth-side/auth-main-panel` 体系，保留原交互与文案语义。
- `apps/web/src/routes/auth/register/+page.svelte`
  - 从 `auth-card-simple` 单卡改为 `auth-card auth-card-register` 双栏骨架，左侧信息区与登录页一致，右侧维持原注册字段与校验行为。
- `apps/web/src/routes/auth/forgot-password/+page.svelte`
  - 从 `auth-card-simple` 单卡改为 `auth-card auth-card-forgot` 双栏骨架，交互字段/校验逻辑不变。
- `apps/web/src/lib/pwa.ts`
  - service worker 注册改为显式绝对路径：`/sw.js` + `scope: '/'`，避免在 `/auth/*` 下解析为 `/auth/sw.js` 导致 404。

配色/字体/交互保持在现有红紫品牌体系内：标题字族、输入框、错误态、按钮状态与焦点环均沿用统一 token 与现有样式规则。

## 3) 验证结果（check/build）
本地执行通过：
- `corepack pnpm -C apps/web check`
  - `svelte-check found 0 errors and 0 warnings`
- `corepack pnpm -C apps/web build`
  - 构建成功，PWA 产物包含 `.svelte-kit/output/client/sw.js`
  - 产物中注册语句已确认使用绝对路径：`navigator.serviceWorker.register('/sw.js', { scope: '/' })`

备注：build 过程中保留既有的动态 import chunk 警告（与本次改动无关，非阻断）。

## 4) 结果评估与回归关注
- 统一性：登录/注册/忘记密码已使用同源骨架，视觉与结构一致性恢复。
- 稳定性：auth 路由下不再请求 `/auth/sw.js`，可消除对应 console error，Best Practices 不再被该项拖分。
- 风险面：本次未改鉴权业务逻辑（跳转、校验、toast、mock 同步流程保持不变），主要风险集中在视觉回归；已通过编译与类型检查。

## DoD
- [x] 三页认证页面统一为同一容器与布局体系（不再单卡/双栏混用）
- [x] `/auth/*` 下 `sw.js 404` 修复，避免 console error
- [x] 配色/字体/交互风格保持一致，未降级审美
- [x] `check/build` 通过
- [x] 报告已落地：`reports/lighthouse/UI_GLOBAL_B/r2_1-auth-skeleton-sw-fix.md`
- [x] 代码可独立提交（见本次 commit）
