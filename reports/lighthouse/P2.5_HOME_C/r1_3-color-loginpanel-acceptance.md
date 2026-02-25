# P2.5_HOME_C / R1.3 验收报告（首页颜色 + 登录页面板）

- 执行时间：2026-02-25 15:55 (Asia/Shanghai)
- 环境：`http://127.0.0.1:4173`
- 证据目录：`reports/lighthouse/P2.5_HOME_C/raw/r1_3-color-loginpanel-acceptance/`

## 一、截图对比（Home vs Login，Desktop）

- 首页（desktop）：`raw/r1_3-color-loginpanel-acceptance/home-desktop.jpg`
- 登录页（desktop）：`raw/r1_3-color-loginpanel-acceptance/login-desktop.jpg`
- 判定：**PASS**

## 二、配色对齐校验（红->紫主渐变 / 按钮同系渐变 / 登录面板层次）

- 首页主渐变（`.app-header`）：
  - `linear-gradient(106deg, rgba(255, 78, 95, 0.88), rgba(155, 77, 255, 0.86))`
  - 判定：起点红系、终点紫系，**PASS**
- 登录按钮渐变（`.auth-submit`）：
  - `linear-gradient(90deg, rgb(255, 51, 110) 0%, rgb(186, 55, 255) 100%)`
  - 判定：与首页同为红->紫系，**PASS**
- 登录面板层次（`.auth-card`）：
  - background：`linear-gradient(150deg, rgba(52, 15, 70, 0.86), rgba(24, 17, 47, 0.84))`
  - border：`1px solid rgba(255, 255, 255, 0.2)`
  - shadow：`rgba(39, 9, 59, 0.42) 0px 20px 42px 0px`
  - backdrop：`blur(20px)`
  - 判定：渐变底 + 描边 + 阴影 + 模糊层次完整，**PASS**

**本段结论：PASS**

## 三、票2.5关键项回归（不回退）

- auth 无导航栏（`/auth/login`）：`navCount=0` → **PASS**
- 仅邮箱账号体系语义：
  - `emailInputs=1`
  - `telInputs=0`
  - `disallowedProviderNodes=0`
  - Sentinel 文案：`认证入口：仅邮箱（含密码凭证），不提供手机号/微信/三方登录。`
  - 判定：**PASS**
- 登录闭环：
  - 实测跳转：`/auth/login -> /market?authFlow=login-success&sync=degraded&uid=...&redirect=%2Fmarket`
  - 实际URL：`http://127.0.0.1:4173/market?authFlow=login-success&sync=degraded&uid=p25-home-r1_3%40example.com&redirect=%2Fmarket`
  - 判定：**PASS**

**本段结论：PASS**

## 四、Lighthouse关键路由（`/` 与 `/auth/login`）+ DoD判定

阈值：`Perf>=0.90`，`A11y>=0.90`，`CLS<=0.10`

| 路由 | 终端 | Perf | A11y | CLS | 结果 |
|---|---:|---:|---:|---:|---|
| `/` | desktop | 0.83 | 1.00 | 0.0000 | **FAIL** |
| `/auth/login` | desktop | 0.87 | 1.00 | 0.0000 | **FAIL** |

- Lighthouse 总判定：**FAIL**

| DoD | 验收项 | 判定 |
|---|---|---|
| DoD1 | 首页与登录页 desktop 截图对比完成 | **PASS** |
| DoD2 | 配色对齐（红->紫主渐变 + 按钮同系渐变 + 登录面板层次） | **PASS** |
| DoD3 | 票2.5关键项不回退（auth无导航栏 + 仅邮箱语义 + 登录闭环） | **PASS** |
| DoD4 | LH关键路由达阈值（`/`、`/auth/login`） | **FAIL** |

**FINAL：FAIL**（阻断项：Lighthouse Perf 未达 0.90）
