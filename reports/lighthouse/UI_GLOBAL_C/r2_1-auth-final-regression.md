# UI_GLOBAL_C · R2.1 Auth 最终复判（Sub-C）

- 执行时间：2026-02-25
- 环境：`http://127.0.0.1:4173`（`corepack pnpm --filter web build` + `vite preview`）
- 范围：`/auth/login`、`/auth/register`、`/auth/forgot-password`（Desktop）
- 原始证据：`reports/lighthouse/UI_GLOBAL_C/raw/r2_1-auth-final-regression/`

---

## 1) 三页视觉一致性复测（配色 / 字体 / 间距 / 骨架 / 组件态）

### 1.1 配色（PASS）
- 三页均是同一红紫品牌轴渐变体系（`auth-shell-login/register/forgot`），色彩风格统一。
- 证据：`apps/web/src/app.css:885-906`。

### 1.2 字体（PASS）
- 标题/正文均沿用 `--xg-font-display` / `--xg-font-body` 统一字体栈，无跨页分叉。
- 证据：`apps/web/src/app.css`（全局字体变量 + auth 头部样式）。

### 1.3 间距与骨架（FAIL）
- `login` 仍是双栏骨架：`auth-card auth-card-login`（品牌侧 + 表单侧）。
- `register` / `forgot-password` 为单卡骨架：`auth-card-simple`。
- 容器宽度与内边距仍有两套：
  - 双栏：`width: min(100%, 980px)`；
  - 单卡：`width: min(100%, 760px)`。
- 证据：
  - 路由结构：
    - `apps/web/src/routes/auth/login/+page.svelte`
    - `apps/web/src/routes/auth/register/+page.svelte`
    - `apps/web/src/routes/auth/forgot-password/+page.svelte`
  - 样式：`apps/web/src/app.css:908-915, 980-995`
  - 截图：
    - `raw/r2_1-auth-final-regression/screenshots/pa11y-auth-login-desktop.png`
    - `raw/r2_1-auth-final-regression/screenshots/pa11y-auth-register-desktop.png`
    - `raw/r2_1-auth-final-regression/screenshots/pa11y-auth-forgot-password-desktop.png`

### 1.4 组件态（PASS）
- 输入框与按钮状态（focus/invalid/hover/active/disabled）规则完整，三页复用 `auth-field` / `auth-submit`。
- 证据：`apps/web/src/app.css:1127-1145, 1270-1323`。

> 视觉一致性结论：**FAIL**（骨架/间距体系未统一）。

---

## 2) 重跑 Lighthouse + Pa11y（Desktop）

| 路由 | Perf | A11y | BP | SEO | LH color-contrast | LH errors-in-console | Pa11y error/warn | 结果 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `/auth/login` | 100 | 100 | 96 | 100 | 1 | 0 | 0 / 0 | FAIL |
| `/auth/register` | 100 | 100 | 96 | 100 | 1 | 0 | 0 / 0 | FAIL |
| `/auth/forgot-password` | 100 | 100 | 96 | 100 | 1 | 0 | 0 / 0 | FAIL |

原始文件：
- LH：
  - `raw/r2_1-auth-final-regression/lh/lh-auth-login-desktop.json`
  - `raw/r2_1-auth-final-regression/lh/lh-auth-register-desktop.json`
  - `raw/r2_1-auth-final-regression/lh/lh-auth-forgot-password-desktop.json`
- Pa11y：
  - `raw/r2_1-auth-final-regression/pa11y/pa11y-auth-login-desktop.json`
  - `raw/r2_1-auth-final-regression/pa11y/pa11y-auth-register-desktop.json`
  - `raw/r2_1-auth-final-regression/pa11y/pa11y-auth-forgot-password-desktop.json`

### BP恢复与Console校验（重点）
- **BP 未恢复（FAIL）**：三页均为 `96`，未达到阻断项“恢复到 100”。
- **存在 Console 错误（FAIL）**：`errors-in-console` 审计分均为 `0`。
- 统一根因（3页一致）：
  - `[pwa] service worker register failed ... /auth/sw.js 404`
  - 来源：`errors-in-console.details.items`。

---

## 3) PASS / FAIL 汇总

- 视觉一致性（配色）：**PASS**
- 视觉一致性（字体）：**PASS**
- 视觉一致性（间距/骨架）：**FAIL**
- 视觉一致性（组件态）：**PASS**
- Lighthouse（Desktop，重点 BP）：**FAIL**
- Console 无报错：**FAIL**
- Pa11y（Desktop）：**PASS**（0 issue）

## FINAL

**FINAL: FAIL**

阻断项未清零：
1. 骨架/间距仍为双轨（login 双栏 vs register/forgot 单卡）；
2. BP 未恢复（均 96）；
3. Console 仍有 service worker 404 错误（`/auth/sw.js`）。
