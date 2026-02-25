# P2.5_C（Sub-C / Sentinel）R1 v2 严格复测报告

- 时间：2026-02-25（Asia/Shanghai）
- 执行人：Sub-C（Sentinel）
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 目标口径：按“最新口径”执行 **P2.5 v2 严格复测**，并逐条映射：
  - ✅ 详细步骤
  - ✅ 注意事项
  - ✅ 工作安排
  - ✅ DoD（逐条 PASS/FAIL）

---

## 一、详细步骤（逐条执行记录）

### Step 1) 多端扫描 `/auth/login` `/auth/register` `/auth/forgot-password` `/market`

1. 本地构建并启动预览站点：`http://127.0.0.1:4173`
   - `corepack pnpm --filter web build`
   - `corepack pnpm --filter web preview -- --host 127.0.0.1 --port 4173`
2. 通过 Playwright 进行多端扫描（Desktop + Mobile）：
   - 脚本：`scripts/p25-r1-v2-strict-rescan-ui.mjs`
   - 产物：`reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/ui-scan.json`
3. 路由覆盖结果：4 路由 × 2 终端 = 8 组扫描，全部已落盘。

---

### Step 2) 严格验证认证页：不显示导航栏；仅邮箱文案与入口

按严格口径校验认证路由：
- 规则：
  - `navCount === 0`
  - `emailInputs >= 1`
  - `passwordInputs === 0`
  - `nonEmailInputs === 0`
  - `emailTextHit === true`

结果（Desktop/Mobile 一致）：
- `/auth/login`：**FAIL**（存在 password 输入）
- `/auth/register`：**FAIL**（存在 password 输入）
- `/auth/forgot-password`：**PASS**（仅邮箱入口）

证据：`reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/ui-scan.json`

---

### Step 3) Lighthouse（Perf / A11y / CLS）并判 DoD

1. 对四个路由分别执行 Mobile + Desktop Lighthouse。
2. 产物目录：
   - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/lh/*.json`
3. 汇总脚本：`scripts/p25-r1-v2-summarize.mjs`
4. 汇总文件：`reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/summary.json`

本轮阈值（严格判定）：
- Performance >= 0.90
- Accessibility >= 0.90
- CLS <= 0.10

结论：
- A11y：全部 >= 0.95（通过）
- CLS：全部 <= 0.0135（通过）
- Performance：多数移动端和部分桌面端未达 0.90（失败）

---

### Step 4) 验证登录后跳转 / 同步 / 无闪烁

通过 Playwright 桌面流程对 `/auth/login` 做可操作验证：
- 发现邮箱输入 + 可点击提交控件
- 触发提交后：
  - 未跳转 `/market`
  - 未检测到 token/session 同步迹象
  - 不满足“无闪烁”判定

证据：
- `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/ui-scan.json`（`postLogin` 节点）
- `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/summary.json`

---

## 二、注意事项（严格口径声明）

1. **本次为严格复测**：仅以落盘证据判定，未落盘视为无效。
2. **认证页规则按你给定口径执行**：login/register 出现 password 字段即判 FAIL。
3. **DoD3 阈值在本报告中显式固定**（Perf/A11y/CLS）。若后续阈值口径调整，需重跑并重判。
4. 本轮验证环境为本地 preview（`127.0.0.1:4173`），结论适用于该复测环境。

---

## 三、工作安排（执行排程回放）

- W1：准备环境（build + preview）
- W2：多端页面结构扫描（UI 严格规则）
- W3：Lighthouse 8 组合采集（4 路由 × 2 终端）
- W4：登录后流程验证（跳转/同步/无闪烁）
- W5：汇总脚本生成 `summary.json` 并 DoD 逐条判定
- W6：输出本报告并提交 commit

---

## 四、DoD 逐条判定（PASS/FAIL）

> 口径：`reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/summary.json`

| DoD | 验收项 | 结果 | 说明 |
|---|---|---|---|
| DoD1 | 多端扫描 4 路由完成 | **PASS** | 8/8 样本完成（Desktop+Mobile）。 |
| DoD2 | 认证页无导航 + 仅邮箱文案与入口 | **FAIL** | `/auth/login`、`/auth/register` 在双端均存在 password/非邮箱输入。 |
| DoD3 | LH（Perf/A11y/CLS）达标 | **FAIL** | A11y/CLS 通过，Perf 多项不达标（移动端显著不足）。 |
| DoD4 | 登录后跳转/同步/无闪烁 | **FAIL** | 提交流程未跳转 `/market`，未检测到 token 同步，闪烁判定不通过。 |

**总判定：P2.5 v2 严格复测未通过（FINAL = FAIL）。**

---

## 五、关键证据索引

- UI 扫描：
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/ui-scan.json`
- Lighthouse 原始文件：
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/lh/mobile-auth-login.json`
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/lh/desktop-auth-login.json`
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/lh/mobile-auth-register.json`
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/lh/desktop-auth-register.json`
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/lh/mobile-auth-forgot-password.json`
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/lh/desktop-auth-forgot-password.json`
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/lh/mobile-market.json`
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/lh/desktop-market.json`
- 汇总判定：
  - `reports/lighthouse/P2.5_C/raw/r1-v2-strict-rescan/summary.json`

---

## 六、结论（供主控直接引用）

- 本轮 P2.5 v2 严格复测已按要求完成并落盘。
- 当前阻塞：
  1) 认证页结构不满足“仅邮箱入口”
  2) Lighthouse Perf 未达标
  3) 登录后跳转/同步/无闪烁链路未闭环
- 因此 **DoD 未全通过，当前不可签收**。
