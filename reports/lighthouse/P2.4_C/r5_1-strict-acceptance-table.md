# P2.4 R5.1 Sub-C（Sentinel）严格验收总表（纳入 R5 Sub-B DoD4 新证据）

- 产出时间：2026-02-25（Asia/Shanghai）
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 口径：**严格验收（仅按已落盘证据判定；缺关键证据即 FAIL）**
- 本轮范围：合并 **R5 Sub-A**（DoD1/5 证据包）与 **R5 Sub-B**（DoD4 Web+PWA 复验）并重算 DoD1~6
- 结论摘要：**P2.4 严格验收仍未全量通过（6 项中 3 PASS / 3 FAIL）**

---

## 一、本轮纳入证据

## A) R5 Sub-A（既有）

- `reports/lighthouse/P2.4_A/r5-dod1-dod5-evidence-pack.md`
- `reports/lighthouse/P2.4_A/raw/r5-auth-dual-mode.json`
- `reports/lighthouse/P2.4_A/raw/r2-auth-e2e-matrix.json`
- `reports/lighthouse/P2.4_A/raw/p24-auth-smoke.json`
- `reports/lighthouse/P2.4_C/raw/p24-auth-baseline.json`
- `reports/lighthouse/P2.4_C/raw/migration/r4-remote-2026-02-24T19-26-35Z/*`

关键增量：补齐 DoD1 的“JWT + Access Header 最小双入口验证”、DoD5 的登录/迁移性能口径整理。

## B) R5 Sub-B（最新新增，DoD4）

- `reports/lighthouse/P2.4_B/r5-web-pwa-consistency.md`
- `reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/web-pwa-sync-latency.json`
- `reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/sync-latency-samples.csv`
- `reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/web-pwa-sync-latency-chart.png`
- `reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/p24-auth-baseline.json`

关键结论（Sub-B）：
- Web 写入 -> PWA 可见专项样本：**12/12 成功**
- `p95 = 33.689ms`，显著低于 DoD4 秒级阈值（1000ms）

---

## 二、P2.4 DoD1~6 严格重算（R5.1）

| DoD | 要求 | 严格判定 | 证据与判定理由 |
|---|---|---|---|
| 1 | Cloudflare Access + JWT 登录流程全链路打通（支持至少 2 种登录方式） | **FAIL** | Sub-A 已给出 JWT + Access Header 双入口可执行验证（`r5-auth-dual-mode.json`），但仍缺“真实 Cloudflare Access 门户交互登录 + 同账号双方式切换”的强审计闭环证据；按严格口径仍记 FAIL。 |
| 2 | v2.039 自选股迁移脚本执行成功，数据 100% 正确导入新 D1/KV | **PASS** | 远端 `--remote` 迁移执行成功且索引齐全（`r4-remote-*/01~04`），并有迁移样本 `importedCount=expectedCount=200`（`P2.4_C/raw/p24-auth-baseline.json`）。 |
| 3 | 前端通过 `$lib/auth` 登录后自选股自动同步并显示，无任何丢失 | **PASS** | 真实 auth API 拉取/合并证据链已闭环（`P2.4_B/r3-real-auth-api-closure.md` + 关键截图/快照），且 CORS PUT/GET 闭环在 `P2.4_A/r4-cors-put-fix.md` 已落盘。 |
| 4 | 多设备（Web + PWA）切换后数据秒级一致 | **PASS** | R5 Sub-B 新证据显示双端会话仿真下写入到另一端可见延迟 `p95=33.689ms`，`12/12` 成功（`web-pwa-sync-latency.json`、CSV、图像证据）。 |
| 5 | 性能报告已提交：登录 <800ms，迁移单用户 <3s，Lighthouse 无新下降 | **FAIL** | 登录/迁移指标已达标（`p24-auth-baseline.json`）；但仍缺“P2.4 auth 变更后 Lighthouse 无新下降”的同口径对比签收件。 |
| 6 | 安全审计项（JWT 验证、无明文密码）全部通过 | **FAIL** | JWT 验证证据存在（`r2-auth-e2e*`），但“无明文密码 + 完整安全审计通过”仍无正式审计报告/签收文件。 |

---

## 三、与 R5（上一版严格表）的变化

- 通过项从 **2/6 提升到 3/6**。
- 唯一状态变化：**DoD4：FAIL -> PASS**（由 R5 Sub-B 新增 Web/PWA 一致性证据驱动）。
- DoD1/5/6 仍受“强审计证据缺口”阻塞。

---

## 四、当前最小阻塞清单

1. **DoD1**：补真实 Cloudflare Access 门户交互登录 + 同账号双方式切换证据；
2. **DoD5**：补 P2.4 口径 Lighthouse 对比并签收“无新下降”；
3. **DoD6**：补完整安全审计签收（含无明文密码检查结果）。

> 以上 3 项补齐后，可再次重开严格验收总表进行最终复判。
