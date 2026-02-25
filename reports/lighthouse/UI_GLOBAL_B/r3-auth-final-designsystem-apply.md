# UI_GLOBAL_B · R3 认证三页最终 Design System 落地（Sub-B）

- 时间：2026-02-25
- 范围：`/auth/login`、`/auth/register`、`/auth/forgot-password`
- 目标：基于主 Agent 确认的高端 Design System，完成三页最终一致化，不改后端联动逻辑。

## 1) 统一骨架与页面节奏（同容器逻辑）
- 新增统一骨架组件：`apps/web/src/lib/components/auth/AuthFrame.svelte`。
- 三页全部改为同一容器节奏：
  - `auth-shell`（外层氛围背景）
  - `auth-card`（双栏统一卡片容器）
  - `auth-side`（左侧品牌/说明）
  - `auth-main-panel`（右侧标题/说明/表单/底部导航）
- 标题、说明、表单、底部导航结构通过 `form` / `footer` snippet 注入，布局节奏保持同构，仅文案与字段差异化。

## 2) 统一 token 使用（颜色 / 字体 / 间距 / 圆角 / 阴影 / 按钮态）
- 将认证页关键样式集中到统一 auth 区块，确保三页共享同一套 token 驱动：
  - 字体：`--xg-font-display`
  - 间距：`--xg-space-*`
  - 圆角：`--xg-radius-*`
  - 阴影：`--xg-shadow-card` / `--xg-shadow-pop`
  - 表面色：`--xg-surface-auth` / `--xg-surface-auth-muted`
  - 文本色：`--xg-text-auth-primary` / `--xg-text-auth-subtle`
  - 按钮态：`--xg-button-primary` / `--xg-button-primary-hover` / `--xg-button-primary-active`
  - 焦点环：`--xg-focus-ring`
- 登录/注册/找回仅保留 tone 级差异（渐变起止色），其余交互与组件态共用。

## 3) 业务逻辑保持不变（不动后端联动）
- 未改动登录页的认证流程与联动：
  - `ensureAuthApi()`、`auth.signIn()`、`syncWatchlist()`、`sessionStorage` 持久化与 `goto(/market...)` 路径保持原逻辑。
- 未改动注册/找回的表单校验逻辑与跳转策略：
  - 校验规则、错误提示、loading 行为、`goto(/auth/login?email=...)` 保持不变。
- 本次仅做 UI 容器与样式体系统一，不涉及 API、鉴权协议、后端字段或联动协议调整。

## 4) 验证结果（check / build）
- `corepack pnpm check`：✅ 通过（`svelte-check found 0 errors and 0 warnings`）
- `corepack pnpm build`：✅ 通过（web 端生产构建成功）
- 构建告警：存在既有动态/静态混合导入提示（`toast.svelte.ts` chunk 提示），与本次认证页统一改造无直接功能性冲突。

---

## DoD
- [x] 登录/注册/忘记密码三页已使用同一骨架组件与容器逻辑
- [x] 标题/说明/表单/底部导航节奏一致化
- [x] 三页统一采用 Design System token（颜色/字体/间距/圆角/阴影/按钮态）
- [x] 业务逻辑与后端联动未改动
- [x] 报告已输出到 `reports/lighthouse/UI_GLOBAL_B/r3-auth-final-designsystem-apply.md`
- [x] `check` 与 `build` 已完成并通过
