# UI_GLOBAL_B · R1.1 /auth/login 对比度最小修复

## 1) 问题定位（审计 4 条）
依据 `reports/lighthouse/UI_GLOBAL_C/raw/r1-lh-auth-login.json` 的 `color-contrast` 结果，`/auth/login` 共 4 条 WCAG2AA 对比度问题：
1. 登录头部辅助文案（`header.auth-head > p`）前景色偏浅（原约 `#80879d`）。
2. 错误文案（`p.auth-error`）对比度略低（同类命中 2 次，原 `#d63d6f`）。
3. “记住账号”辅助文本（`label.auth-check > span`）对比度略低（原 `#707792`）。

## 2) 最小改动说明（仅必要样式）
本次仅在 `apps/web/src/app.css` 增加 **login 专属覆盖**，不改布局、不改结构、不改交互逻辑：
- `auth-login-form-panel .auth-head p`：`#80879d -> #67708a`（提升辅助文案可读性）。
- `auth-card-login .auth-error`：`#d63d6f -> #cb2f63`（修复错误文案临界对比）。
- `auth-card-login .auth-check`：`#707792 -> #6b7288`（修复“记住账号”文字对比）。
- `auth-card-login .auth-field::placeholder`：新增 `#626b85`，补强输入提示文字可读性（不改变红紫主题，仅提高文本可见度）。

## 3) 视觉一致性与影响评估
- 保持原有红紫主题、渐变按钮、卡片层级、页面布局与组件结构不变。
- 仅下沉到 `auth-card-login` / `auth-login-form-panel` 范围，避免波及 register/forgot 页面。
- 属于“颜色值微调”级别，不涉及 token 体系重构与业务逻辑变更。

## 4) 校验结果（check/build）
- `corepack pnpm check`：通过（`svelte-check found 0 errors and 0 warnings`）。
- `corepack pnpm build`：通过（SvelteKit + adapter-cloudflare 构建完成）。
- 构建期间仅有既存动态导入提示（toast chunk），与本次对比度修复无关。

## DoD
- [x] 已针对 `/auth/login` 审计 4 条对比度问题完成最小修复。
- [x] 仅修改必要文本/placeholder/辅助文案样式，不破坏当前红紫视觉风格与布局。
- [x] `check` 与 `build` 均已通过。
- [x] 已输出报告：`reports/lighthouse/UI_GLOBAL_B/r1_1-login-contrast-fix.md`。
- [x] 变更可独立提交并回传 commit 号。
