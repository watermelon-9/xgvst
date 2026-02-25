# UI_GLOBAL_C · R1.1 对比度修复复判（Sub-C）

- 执行时间：2026-02-25
- 环境：`http://127.0.0.1:4173`（`pnpm --filter web build` + `vite preview`）
- 目标：复判 `/auth/login` 对比度修复，并回归 `/auth/register`、`/auth/forgot-password` 一致性与阈值
- 原始证据目录：`reports/lighthouse/UI_GLOBAL_C/raw/r1_1-contrast-rescan/`

## 1) `/auth/login` A11y/LH 复测（desktop + mobile）

| 路由 | 终端 | Perf | A11y | BP | SEO | LH color-contrast | Pa11y error/warn |
|---|---|---:|---:|---:|---:|---:|---:|
| `/auth/login` | desktop | 81 | 100 | 100 | 100 | 1 (PASS) | 0 / 0 |
| `/auth/login` | mobile | 59 | 100 | 100 | 100 | 1 (PASS) | best-effort：Pa11y CLI 无 viewport 参数，未单独产出移动 Pa11y |

结论（login）：
- **对比度问题已修复**：Lighthouse `color-contrast`=PASS，Pa11y（desktop）0 错误。
- mobile 端已完成 Lighthouse 复测，A11y 100。

## 2) `/auth/register`、`/auth/forgot-password` 回归（一致性与阈值）

本轮统一阈值（面向对比度修复回归）：
- `Lighthouse Accessibility >= 95`
- `Lighthouse color-contrast = PASS`
- `Pa11y error = 0`

| 路由 | 终端 | Perf | A11y | BP | SEO | LH color-contrast | Pa11y error/warn | 阈值判定 |
|---|---|---:|---:|---:|---:|---:|---:|---|
| `/auth/register` | desktop | 100 | 100 | 96 | 100 | 1 (PASS) | 0 / 0 | PASS |
| `/auth/register` | mobile | 100 | 100 | 96 | 100 | 1 (PASS) | - | PASS |
| `/auth/forgot-password` | desktop | 82 | 100 | 100 | 100 | 1 (PASS) | 0 / 0 | PASS |
| `/auth/forgot-password` | mobile | 60 | 100 | 100 | 100 | 1 (PASS) | - | PASS |

一致性结论：
- 三个 Auth 路由在可访问性与对比度口径上表现一致：**A11y 均 100，color-contrast 均 PASS，desktop Pa11y 均 0 error**。
- 本次任务聚焦对比度修复复判，相关阈值均满足。

## 3) 证据文件清单

- Lighthouse：
  - `lh-auth-login-desktop.json`
  - `lh-auth-login-mobile.json`
  - `lh-auth-register-desktop.json`
  - `lh-auth-register-mobile.json`
  - `lh-auth-forgot-password-desktop.json`
  - `lh-auth-forgot-password-mobile.json`
- Pa11y：
  - `pa11y-auth-login-desktop.json`
  - `pa11y-auth-register-desktop.json`
  - `pa11y-auth-forgot-password-desktop.json`
- 汇总：
  - `summary.json`

## PASS/FAIL + FINAL

- `/auth/login` 对比度复判：**PASS**
- `/auth/register` 回归：**PASS**
- `/auth/forgot-password` 回归：**PASS**

**FINAL：PASS**
