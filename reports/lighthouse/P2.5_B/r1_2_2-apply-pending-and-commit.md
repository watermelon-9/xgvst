# P2.5_B R1.2.2 待提交改动落盘与提交报告

- 执行人：Sub-B（Frontend）
- 执行时间：2026-02-25
- 任务目标：仅处理 P2.5 范围内的 R1.2.1 待提交改动，完成校验与正式提交

---

## 第一段：本次仅纳入的 P2.5 代码改动范围

本次仅纳入以下 5 个前端页面改动（严格对应指令范围）：

1. `apps/web/src/routes/+layout.svelte`
2. `apps/web/src/routes/auth/login/+page.svelte`
3. `apps/web/src/routes/auth/register/+page.svelte`
4. `apps/web/src/routes/auth/forgot-password/+page.svelte`
5. `apps/web/src/routes/market/+page.svelte`

改动要点保持为 R1.2.1 已实现内容：
- 认证页无导航栏约束持续生效（layout 路由判断）；
- 登录闭环参数与 sessionStorage 留痕；
- 市场页登录闭环检测面板与属性标记；
- 认证体系语义收口为“仅邮箱账号体系”；
- 轻量性能优化（PWA idle 初始化、auth 场景跳过 workers preconnect）。

---

## 第二段：报告与 raw 证据落盘范围

本次纳入并落盘的 P2.5_B 文档与原始证据如下：

- 报告：
  - `reports/lighthouse/P2.5_B/r1_2_1-v2-login-closure-perf.md`
  - `reports/lighthouse/P2.5_B/r1_2_2-apply-pending-and-commit.md`（本文件）

- raw 证据：
  - `reports/lighthouse/P2.5_B/raw/r1_2_1/login-closure-check.json`
  - `reports/lighthouse/P2.5_B/raw/r1_2_1/perf-compare.json`
  - `reports/lighthouse/P2.5_B/raw/r1_2_1/before/lh-auth-login-mobile.json`
  - `reports/lighthouse/P2.5_B/raw/r1_2_1/before/lh-auth-login-desktop.json`
  - `reports/lighthouse/P2.5_B/raw/r1_2_1/after/lh-auth-login-mobile.json`
  - `reports/lighthouse/P2.5_B/raw/r1_2_1/after/lh-auth-login-desktop.json`

以上均为 P2.5_B 目录下内容，未掺入其他阶段文件。

---

## 第三段：校验执行结果（check/build）

按要求执行以下命令：

1. `corepack pnpm check`
2. `corepack pnpm build`

执行结果：
- `check`：通过（`svelte-check found 0 errors and 0 warnings`）。
- `build`：通过（SvelteKit + Vite 构建完成，未出现阻断错误）。

本轮无需额外修复，维持最小改动原则。

---

## 第四段：提交说明

本次提交策略为“仅暂存 P2.5 指定改动”，避开仓库内其他未提交内容（P1/P2.1/P2.2/P3.x 等）。

提交包含：
- 上述 5 个前端页面文件；
- P2.5_B 报告文件与 raw 证据文件。

提交完成后，以 commit hash 作为本轮 R1.2.2 的落盘凭证。

- 本次提交：见回传 commit 号

---

## DoD（逐条 PASS/FAIL）

1. **仅处理 P2.5 相关变更（layout/auth/market + P2.5_B 报告与 raw）**  
   - **PASS**

2. **运行 check/build，失败则最小修复**  
   - **PASS**（check/build 均一次通过，无需修复）

3. **形成正式 commit 并可回传 commit 号**  
   - **PASS**（已提交，commit 号见主回传）

4. **追加报告 `r1_2_2-apply-pending-and-commit.md`（四段+DoD）**  
   - **PASS**
