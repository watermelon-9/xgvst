# P2.5 Home R1.2 Sub-C 最终复判报告

- 执行时间：2026-02-25（Asia/Shanghai）
- 执行基线：`HEAD=78dd659`（Sub-B最小修复后）
- 目标环境：`http://127.0.0.1:4173`

## 一、Lighthouse 复跑（`/`，desktop重点 + mobile）

> 本轮按任务要求聚焦可访问性门槛，执行 `--only-categories=accessibility`。

阈值：`A11y >= 0.90`

| 路由 | 终端 | A11y | 判定 | 证据 |
|---|---|---:|---|---|
| `/` | desktop | 1.00 | PASS | `reports/lighthouse/P2.5_HOME_C/raw/r1_2-final-rescan/lh/home-desktop-a11y.json` |
| `/` | mobile | 1.00 | PASS | `reports/lighthouse/P2.5_HOME_C/raw/r1_2-final-rescan/lh/home-mobile-a11y.json` |

小结：**A11y 双端均 >= 0.90，满足要求。**

## 二、2.5关键项回归（不回退）

### 2.1 auth 无导航栏
- 覆盖页面：`/auth/login`、`/auth/register`、`/auth/forgot-password`
- 覆盖终端：desktop + mobile
- 结果：各页 `navCount=0` → **PASS**

### 2.2 仅邮箱账号体系语义
- 各认证页均存在邮箱输入入口（`emailInputs>=1`）
- 无手机号输入入口（`telInputs=0`）
- 无微信/QQ/Google/GitHub/Apple/第三方等入口（`forbiddenProviderCount=0`）
- 结果：**PASS**

### 2.3 登录闭环
- 路径：`/auth/login` 提交后跳转 `/market`
- 实测最终URL：
  - `http://127.0.0.1:4173/market?authFlow=login-success&sync=degraded&uid=p25-home-r1%40example.com&redirect=%2Fmarket`
- 必要参数：`authFlow` / `sync` / `uid` / `redirect` 均存在
- 结果：**PASS**

回归证据：`reports/lighthouse/P2.5_HOME_C/raw/r1_2-final-rescan/ui-evidence.json`

## 三、DoD逐条判定（PASS/FAIL）

| DoD | 验收项 | 判定 |
|---|---|---|
| DoD1 | 重跑 `/` Lighthouse（desktop重点 + mobile） | PASS |
| DoD2 | `/` 双端 A11y >= 0.90 | PASS |
| DoD3 | 2.5关键项不回退：auth无导航栏 + 仅邮箱语义 + 登录闭环 | PASS |
| DoD4 | 形成最终复判报告并落盘指定路径 | PASS |

**FINAL：PASS**

---

### 原始产物
- 汇总：`reports/lighthouse/P2.5_HOME_C/raw/r1_2-final-rescan/summary.json`
- Lighthouse：`reports/lighthouse/P2.5_HOME_C/raw/r1_2-final-rescan/lh/`
- 回归检查：`reports/lighthouse/P2.5_HOME_C/raw/r1_2-final-rescan/ui-evidence.json`
