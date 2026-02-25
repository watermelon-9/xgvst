# P2.5_HOME_C / R1.1 严格验收（强制回传）

- 执行时间：2026-02-25 15:42 (Asia/Shanghai)
- 执行基线：`HEAD=51b5dc3`，且包含 `81d60b6`（ancestor check=0）
- 硬约束声明：仅按 **v2.039效果** 做比对验收；本报告不复用v2源码实现。
- 环境：`http://127.0.0.1:4173`

## 一、首页 1:1 还原差异矩阵（结构 / 配色 / 字号 / 间距 / 交互态）

> v2.039参考来自 `reports/lighthouse/P2.5_HOME_A/r1-v2039-home-source-mapping.md`（结构+token+交互映射）。

| 维度 | v2.039 目标效果 | v3 实测（R1.1） | 判定 |
|---|---|---|---|
| 结构 | 三栏主区 + 移动Tab三按钮 + 右侧K线周期按钮≥4 | `pane=3`，`mobileTab=3`，`klineBtn=4` | PASS |
| 配色 | 深色主题；涨红`#ef4444`、跌绿`#22c55e`；玻璃模糊 | `theme=dark`；`up=rgb(239,68,68)`；`down=rgb(34,197,94)`；`blur=blur(20px)` | PASS |
| 字号 | 标题/面板/表格层级接近v2（映射基线24/14/clamp10~14） | `toolbarLeft=16px`，`sectionTitle=13.28px`，`quoteRow=13.12px`，`klineBtn=11.84px` | PASS |
| 间距 | 页面/栅格/面板间距节奏接近v2（基线 page14 / gap10 / panel10） | `pagePadding=36x24`，`gridGap=12`，`panePadding=11.2`，`paneRadius=14` | FAIL（页面外边距偏大） |
| 交互态 | 左/中点击驱动右侧联动；移动Tab可切换 | `board: AI算力→半导体`；`symbol: 平安银行→宁德时代`；`tab: 行情表→个股K线` | PASS |

## 二、票2.5关键项回归（不回退）

### 2.1 auth页无导航栏
- `/auth/login`：desktop/mobile 均 `navCount=0` → PASS
- `/auth/register`：desktop/mobile 均 `navCount=0` → PASS
- `/auth/forgot-password`：desktop/mobile 均 `navCount=0` → PASS

### 2.2 仅邮箱账号体系语义
- 三页均检测到邮箱输入：`emailInputs=1`
- 三页均无手机号输入：`telInputs=0`
- 三页均无第三方provider入口：`disallowedProviderCount=0`
- 判定：PASS

### 2.3 登录跳转闭环
- 实测登录后URL：
  `http://127.0.0.1:4173/market?authFlow=login-success&sync=degraded&uid=p25-home-r1%40example.com&redirect=%2Fmarket`
- 闭环条件：`/auth/login -> /market` 且携带 `authFlow/sync/uid/redirect` 参数
- 判定：PASS

## 三、Lighthouse（/ + /auth/login + /auth/register + /auth/forgot-password + /market）

阈值：`Perf>=0.90`，`A11y>=0.90`，`CLS<=0.10`

| 路由 | 终端 | Perf | A11y | CLS | 结果 |
|---|---|---:|---:|---:|---|
| / | mobile | 0.98 | 0.95 | 0.0000 | PASS |
| / | desktop | 1.00 | 0.89 | 0.0000 | FAIL |
| /auth/login | mobile | 0.99 | 1.00 | 0.0000 | PASS |
| /auth/login | desktop | 1.00 | 1.00 | 0.0000 | PASS |
| /auth/register | mobile | 0.99 | 1.00 | 0.0000 | PASS |
| /auth/register | desktop | 1.00 | 1.00 | 0.0000 | PASS |
| /auth/forgot-password | mobile | 0.99 | 1.00 | 0.0000 | PASS |
| /auth/forgot-password | desktop | 1.00 | 1.00 | 0.0000 | PASS |
| /market | mobile | 0.98 | 0.95 | 0.0002 | PASS |
| /market | desktop | 1.00 | 0.95 | 0.0000 | PASS |

Lighthouse 总判定：**FAIL**（仅首页 desktop A11y=0.89 未达线）

## 四、DoD逐条判定 + FINAL

| DoD | 验收项 | 判定 |
|---|---|---|
| DoD1 | 基于最新代码执行（含 `51b5dc3`,`81d60b6`） | PASS |
| DoD2 | 完成首页1:1还原差异矩阵（结构/配色/字号/间距/交互态） | PASS |
| DoD3 | 票2.5关键项不回退（auth无导航/仅邮箱语义/登录闭环） | PASS |
| DoD4 | LH覆盖5路由（`/`,`/auth/login`,`/auth/register`,`/auth/forgot-password`,`/market`） | PASS |
| DoD5 | LH阈值全量达标（Perf/A11y/CLS） | FAIL |

**FINAL：FAIL（阻断项：`/` desktop A11y=0.89 < 0.90）**

---

### 证据路径
- UI验收原始：`reports/lighthouse/P2.5_HOME_C/raw/r1_1-strict-acceptance-force-return/ui-evidence.json`
- Lighthouse原始：`reports/lighthouse/P2.5_HOME_C/raw/r1_1-strict-acceptance-force-return/lh/*.json`
