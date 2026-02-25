# P2.5_C（Sub-C / Sentinel）R1.2.2 最终严格签收复测报告

- 时间：2026-02-25（Asia/Shanghai）
- 执行仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 复测环境：`http://127.0.0.1:4173`（`corepack pnpm --filter web build` + `corepack pnpm --filter web preview`）
- 严格口径：**仅邮箱账号体系（允许邮箱+密码凭证）**；**禁止手机号/微信/第三方入口**；**auth 页无导航栏**。

---

## 一、复测范围与产物

### 1) 多端重测路由
- 路由：`/auth/login`、`/auth/register`、`/auth/forgot-password`、`/market`
- 终端：Desktop + Mobile（iPhone 13）
- 覆盖：4 路由 × 2 终端 = **8 组复测样本**

### 2) 原始证据
- UI 扫描：
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/ui-scan.json`
- LH 原始 JSON：
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/lh/mobile-auth-login.json`
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/lh/desktop-auth-login.json`
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/lh/mobile-auth-register.json`
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/lh/desktop-auth-register.json`
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/lh/mobile-auth-forgot-password.json`
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/lh/desktop-auth-forgot-password.json`
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/lh/mobile-market.json`
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/lh/desktop-market.json`
- 汇总：
  - `reports/lighthouse/P2.5_C/raw/r1_2_2-final-strict-signoff/summary.json`

---

## 二、关键验证结果

### A. 认证口径严格性（UI）
- `/auth/login`：有邮箱输入 + 有密码输入；无手机号/微信/第三方；无导航（PASS）
- `/auth/register`：有邮箱输入 + 有密码输入；无手机号/微信/第三方；无导航（PASS）
- `/auth/forgot-password`：有邮箱输入；无手机号/微信/第三方；无导航（PASS）

### B. 登录后跳转 + 同步 + 无闪烁（Desktop）
来自 `ui-scan.json` 的 `postLogin`：
- `redirectToMarket: true`
- `finalUrl: /market?authFlow=login-success&sync=degraded&uid=...`
- `tokenSyncDetected: true`
- `noFlicker: true`

结论：登录后 `/market` 跳转、生效同步迹象、无闪烁，均通过。

### C. Lighthouse 复测（DoD 阈值）
阈值：
- Performance >= 0.90
- Accessibility >= 0.90
- CLS <= 0.10

本轮 8/8 样本结果：
- Performance：`0.98 ~ 1.00`（全部达标）
- Accessibility：`0.95 ~ 1.00`（全部达标）
- CLS：`0 ~ 0.000043`（全部达标）

---

## 三、DoD1~DoD8 最终判定

| DoD | 验收项 | 结果 | 依据 |
|---|---|---|---|
| DoD1 | 多端重测覆盖（4路由×2端） | **PASS** | 8/8 样本完成并落盘。 |
| DoD2 | auth 页无导航栏 | **PASS** | 三个 auth 路由 `navCount=0`。 |
| DoD3 | 仅邮箱账号体系（必须邮箱输入） | **PASS** | auth 路由均检测到 `emailInputs>=1`。 |
| DoD4 | 禁止手机号/微信/第三方入口 | **PASS** | `phoneLikeInputs=0` 且 `forbiddenEntryHit=false`。 |
| DoD5 | 允许邮箱+密码凭证（login/register） | **PASS** | login/register 检测到 password 输入且不作为违规项。 |
| DoD6 | 登录后跳转到 `/market` | **PASS** | `postLogin.redirectToMarket=true`。 |
| DoD7 | 登录后同步可检测 + 无闪烁 | **PASS** | `tokenSyncDetected=true` 且 `noFlicker=true`。 |
| DoD8 | LH 达到阈值（Perf/A11y/CLS） | **PASS** | 8/8 样本全部满足阈值。 |

---

## 四、FINAL 结论

**FINAL：PASS（R1.2.2 最终严格签收通过）。**

当前版本满足“仅邮箱账号体系（允许邮箱+密码）+ 禁止手机号/微信/第三方 + auth 页无导航栏”全部硬约束，且登录后 `/market` 跳转/同步/无闪烁与 LH 阈值均通过。