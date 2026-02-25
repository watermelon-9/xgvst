# P2.5_C（Sub-C / Sentinel）R1.2.1 v2 严格复测报告（规则修正）

- 时间：2026-02-25（Asia/Shanghai）
- 执行仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 复测环境：`http://127.0.0.1:4173`（`pnpm --filter web build` + `pnpm --filter web preview`）
- 指定规则修正：**仅邮箱注册/登录 ≠ 禁止密码输入**；验收应为“禁止手机号/微信/第三方入口，必须含邮箱输入，可含密码”。

---

## 一、规则修订与复测脚本落地（含变更说明）

已新增并落地复测脚本（保留规则变更说明）：

1. `scripts/p25-r1_2_1-v2-strict-rescan-rulefix-ui.mjs`
   - 内置 `ruleChangelog`：
     - R1.2.1：仅邮箱注册/登录不等于禁止密码输入。
     - 认证页允许 `password` 输入，不再作为失败项。
     - 认证页继续强制：`navCount=0`、必须有邮箱输入、禁止手机号/微信/第三方入口。
   - 新增禁入项识别：手机号/SMS、微信、QQ、Google、GitHub、Apple、第三方/OAuth/SSO 等入口（输入框 + 按钮/链接双通道扫描）。

2. `scripts/p25-r1_2_1-v2-summarize-rulefix.mjs`
   - 汇总 `ui-scan.json + 8 份 LH JSON` 生成 `summary.json`。
   - DoD2 规则改为 R1.2.1 口径（允许密码，禁止手机号/微信/第三方，必须含邮箱输入）。

脚本产物目录：
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/`

---

## 二、路由重测结果（/auth/login /auth/register /auth/forgot-password /market，多端）

### 1) 多端覆盖
- 终端：Desktop + Mobile（iPhone 13）
- 路由：`/auth/login`、`/auth/register`、`/auth/forgot-password`、`/market`
- 覆盖：4 路由 × 2 终端 = **8 组 UI/LH 证据**

### 2) 认证页规则复测（R1.2.1）
- `/auth/login`：PASS（有邮箱输入 + 有密码输入；无手机号/微信/第三方入口；无导航）
- `/auth/register`：PASS（有邮箱输入 + 有密码输入；无手机号/微信/第三方入口；无导航）
- `/auth/forgot-password`：PASS（有邮箱输入；无手机号/微信/第三方入口；无导航）

### 3) 登录后 `/market` 跳转 + 同步 + 无闪烁验证
（Desktop 流程自动化）
- 邮箱输入：有
- 密码输入：有
- 提交动作：有
- 跳转 `/market`：**FAIL**（未跳转）
- 同步迹象（token/session key）：PASS（检测到）
- 无闪烁：**FAIL**（由于未完成跳转，不满足无闪烁判定）

对应证据：
- `.../raw/r1_2_1-v2-strict-rescan-rulefix/ui-scan.json` 的 `postLogin` 节点

---

## 三、Lighthouse 复测（按 DoD 阈值判定）

阈值口径（DoD3）：
- Performance >= 0.90
- Accessibility >= 0.90
- CLS <= 0.10

本轮结果（8/8）：
- Accessibility：0.95 ~ 1.00（全部达标）
- CLS：0 ~ 0.0002（全部达标）
- Performance：0.59 ~ 0.88（全部低于 0.90）

结论：**DoD3 = FAIL**（瓶颈在 Performance）

LH 原始文件：
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/lh/mobile-auth-login.json`
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/lh/desktop-auth-login.json`
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/lh/mobile-auth-register.json`
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/lh/desktop-auth-register.json`
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/lh/mobile-auth-forgot-password.json`
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/lh/desktop-auth-forgot-password.json`
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/lh/mobile-market.json`
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/lh/desktop-market.json`

汇总：
- `reports/lighthouse/P2.5_C/raw/r1_2_1-v2-strict-rescan-rulefix/summary.json`

---

## 四、DoD 逐条 PASS/FAIL（最终结论）

| DoD | 验收项 | 结果 | 说明 |
|---|---|---|---|
| DoD1 | 重测覆盖（4 路由 × 多端） | **PASS** | 8/8 样本完成并落盘（Desktop+Mobile）。 |
| DoD2 | 认证页规则（R1.2.1 修正版） | **PASS** | 三个认证页均满足：有邮箱、无手机号/微信/第三方入口、无导航；密码输入被允许。 |
| DoD3 | LH 阈值（Perf/A11y/CLS） | **FAIL** | A11y/CLS 全通过；Performance 全部 < 0.90。 |
| DoD4 | 登录后 `/market` 跳转 + 同步 + 无闪烁 | **FAIL** | 检测到同步迹象，但未跳转 `/market`，无闪烁条件不成立。 |

**FINAL：FAIL（当前不可签收）。**
