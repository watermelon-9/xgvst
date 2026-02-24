# P2.4 R6.1 Sub-C（Sentinel）严格验收总表（纳入 R6 DoD5/DoD6，并按 R6 DoD1 真实 Access 状态复判）

- 产出时间：2026-02-25（Asia/Shanghai）
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 口径：**严格验收（仅按已落盘证据判定；缺关键证据即 FAIL）**
- 本轮范围：
  1. 纳入 **R6 Sub-C：DoD5 PASS 证据包**；
  2. 纳入 **R6 Sub-B：DoD6 安全审计证据**；
  3. 结合 **R6 Sub-A：DoD1 真实 Cloudflare Access 门户证据状态**，重算 DoD1~6。
- 结论摘要：**P2.4 严格验收当前为 5 PASS / 1 FAIL（未全量通过）**。

---

## 一、本轮纳入证据

### A) R6 Sub-A（DoD1 真实 Access 证据状态）

- `reports/lighthouse/P2.4_A/r6-dod1-real-access-evidence.md`
- `reports/lighthouse/P2.4_A/raw/r6-real-access/*`

关键结论：
- 已完成真实链路探测并落盘；
- 当前目标链路**未进入 Cloudflare Access 门户接管**，无可复核“门户交互登录（至少两种方式）”闭环证据；
- 因此 DoD1 在严格口径下仍不能判 PASS。

### B) R6 Sub-C（DoD5 证据包）

- `reports/lighthouse/P2.4_C/r6-dod5-evidence-pack.md`
- `reports/lighthouse/P2.4_C/raw/p24-auth-baseline.json`
- `reports/lighthouse/P2.4_C/raw/r6-lighthouse-compare-summary.json`
- `reports/lighthouse/P2.4_C/raw/r6-lh-guard-20260225-034613/*`
- `reports/lighthouse/P2.4_C/raw/r6-lh-desktop-smoke-20260225-034901/*`

关键结论：
- login p95=`2.932ms`（<800ms）；
- migration p95=`17.584ms`（<3s，且导入正确性 100%）；
- Lighthouse 四场景对比 `delta=0`、`noNewRegression=true`。

### C) R6 Sub-B（DoD6 安全审计）

- `reports/lighthouse/P2.4_B/r6-dod6-security-audit.md`
- `reports/lighthouse/P2.4_A/raw/r5-auth-dual-mode.json`（运行级复核引用）

关键结论：
- JWT 验证链路（路由挂载 + 验签 + claim 校验 + 拒绝路径）完整；
- 未见明文密码存储链路（schema/SQL/扫描）；
- 运行验证 4/4 场景通过。

---

## 二、P2.4 DoD1~6 严格重算（R6.1）

| DoD | 要求 | 严格判定 | 证据与判定理由 |
|---|---|---|---|
| 1 | Cloudflare Access + JWT 登录流程全链路打通（支持至少 2 种登录方式） | **FAIL** | `r6-dod1-real-access-evidence.md` 明确：当前探测链路未进入真实 Access 门户接管，缺“门户交互 + 同账号双方式”强审计闭环。虽有 `r5-auth-dual-mode.json` 的联调级双入口通过证据，但严格口径仍不足以判 PASS。 |
| 2 | v2.039 自选股迁移脚本执行成功，数据 100% 正确导入新 D1/KV | **PASS** | 远端迁移执行与索引证据已闭环（`P2.4_C/raw/migration/r4-remote-2026-02-24T19-26-35Z/*`）；`p24-auth-baseline.json` 显示迁移样本 `importedCount=expectedCount=200`。 |
| 3 | 前端通过 `$lib/auth` 登录后自选股自动同步并显示，无任何丢失 | **PASS** | 真实 auth API 闭环与写入读取证据已落盘（`P2.4_B/r3-real-auth-api-closure.md`、`P2.4_A/r4-cors-put-fix.md` 及对应 raw）。 |
| 4 | 多设备（Web + PWA）切换后数据秒级一致 | **PASS** | R5 Sub-B 证据已证明 Web->PWA 一致性：`12/12` 成功，`p95=33.689ms`（`P2.4_B/r5-web-pwa-consistency.md` + `web-pwa-sync-latency.json`）。 |
| 5 | 性能报告已提交：登录 <800ms，迁移单用户 <3s，Lighthouse 无新下降 | **PASS** | R6 DoD5 证据包已补齐并三项全通过：`r6-dod5-evidence-pack.md` + `p24-auth-baseline.json` + `r6-lighthouse-compare-summary.json`。 |
| 6 | 安全审计项（JWT 验证、无明文密码）全部通过 | **PASS** | R6 安全审计已落盘并给出代码级+运行级证据：`r6-dod6-security-audit.md`，结论为 DoD6 PASS。 |

---

## 三、与 R5.1 版本对比

- 通过数：**3/6 -> 5/6**
- 状态变化：
  - **DoD5：FAIL -> PASS**（R6 DoD5 证据包补齐）
  - **DoD6：FAIL -> PASS**（R6 安全审计证据补齐）
  - **DoD1：维持 FAIL**（R6 已证实真实 Access 门户链路尚未接管）

---

## 四、当前唯一阻塞（最终收口）

仅剩 **DoD1**：需在真实 Access 门户接管生效后，补齐“同账号至少两种登录方式”的交互与回证闭环（门户页证据 + 登录后受保护 API 200）。

> 结论：P2.4 已接近全量通过；在严格口径下，当前仍因 DoD1 单点未闭环而**暂未最终签收**。
