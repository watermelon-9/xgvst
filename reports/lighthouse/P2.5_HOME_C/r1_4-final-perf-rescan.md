# P2.5 Home R1.4 Sub-C 最终性能复判报告

- 执行时间：2026-02-25 16:06（Asia/Shanghai）
- 环境：`http://127.0.0.1:4173`
- 证据目录：`reports/lighthouse/P2.5_HOME_C/raw/r1_4-final-perf-rescan/`

## 一、Lighthouse 重跑（`/` 与 `/auth/login`，desktop至少，含mobile）

阈值：`Perf>=0.90`，`A11y>=0.90`，`CLS<=0.10`

| 路由 | 终端 | Perf | A11y | CLS | 结果 |
|---|---:|---:|---:|---:|---|
| `/` | desktop | 0.99 | 1.00 | 0.0000 | **PASS** |
| `/auth/login` | desktop | 1.00 | 1.00 | 0.0000 | **PASS** |
| `/` | mobile | 0.99 | 1.00 | 0.0000 | **PASS** |
| `/auth/login` | mobile | 0.99 | 1.00 | 0.0000 | **PASS** |

- Lighthouse 总判定：**PASS**

## 二、已通过项回归（R1.4）

### 2.1 配色 / 登录面板
- 首页头部渐变：`linear-gradient(106deg, rgba(255, 78, 95, 0.88), rgba(155, 77, 255, 0.86))`
- 涨跌色：`up=rgb(239, 68, 68)`，`down=rgb(34, 197, 94)`
- 毛玻璃：`blur(20px)`
- 登录面板：
  - background：`linear-gradient(150deg, rgba(52, 15, 70, 0.86), rgba(24, 17, 47, 0.84))`
  - border：`1px solid rgba(255, 255, 255, 0.2)`
  - shadow：`rgba(39, 9, 59, 0.42) 0px 20px 42px 0px`
  - backdrop：`blur(20px)`
  - submit：`linear-gradient(90deg, rgb(255, 51, 110), rgb(186, 55, 255))`
- 判定：**PASS**

### 2.2 auth 无导航栏
- 覆盖：`/auth/login`、`/auth/register`、`/auth/forgot-password`
- 结果：各页 `navCount=0`
- 判定：**PASS**

### 2.3 仅邮箱语义
- 规则：`emailInputs>=1`，`telInputs=0`，且无手机号/微信/三方**可操作入口**
- 结果：三页均满足（`forbiddenActionHit=false`）
- 判定：**PASS**

### 2.4 登录闭环
- 实测：`/auth/login` 提交后进入 `http://127.0.0.1:4173/market`
- 判定：**PASS**

## 三、DoD 复判（PASS/FAIL）

| DoD | 验收项 | 判定 |
|---|---|---|
| DoD1 | 重跑 `/` 与 `/auth/login` 的LH（desktop至少，若可加mobile） | **PASS** |
| DoD2 | 阈值验证：Perf>=0.90, A11y>=0.90, CLS<=0.10 | **PASS** |
| DoD3 | 回归：配色/登录面板 | **PASS** |
| DoD4 | 回归：auth无导航栏 + 仅邮箱语义 | **PASS** |
| DoD5 | 回归：登录闭环 | **PASS** |

**FINAL：PASS**

---

### 原始产物
- LH JSON：`reports/lighthouse/P2.5_HOME_C/raw/r1_4-final-perf-rescan/lh/`
- 汇总：`reports/lighthouse/P2.5_HOME_C/raw/r1_4-final-perf-rescan/summary.json`
