# P2.4 R4 Sub-C（Sentinel）严格验收表（基于最新 R3.1 + R3）

- 产出时间：2026-02-25（Asia/Shanghai）
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 口径：**仅按已落盘证据做严格 PASS/FAIL（缺证据即 FAIL）**
- 结论摘要：**P2.4 当前未通过严格验收（6 项 DoD 中 2 PASS / 4 FAIL）**

---

## 一、最新证据汇总（R3.1 + R3）

### A) 远端 D1 迁移复验（R3.1，新增）

> 新增复验目录：`reports/lighthouse/P2.4_C/raw/migration/r4-remote-2026-02-24T19-26-35Z/`

- 远端迁移执行成功（`--remote`）：
  - `01-remote-migration-execute.txt`
  - 关键结果：`Processed 9 queries`、`success: true`、`num_tables: 3`
- 远端索引复验：
  - `02-remote-index-users.txt`（`idx_users_updated_at`）
  - `03-remote-index-self_selects.txt`（`idx_self_selects_user_symbol`、`idx_self_selects_user_updated`）
  - `04-remote-index-quote_history.txt`（`idx_quote_history_user_symbol_ts`、`idx_quote_history_user_ts`）
- 远端表计数快照：
  - `05-remote-table-counts.txt`
  - `users_count=1`、`self_selects_count=2`、`quote_history_count=4`

### B) 前端真实 Auth API 闭环（R3）

- 主报告：`reports/lighthouse/P2.4_B/r3-real-auth-api-closure.md`
- 关键证据：
  - 真实 API 拉取/合并快照：`reports/lighthouse/P2.4_B/evidence/r3-real-auth-api/19-browser-snapshot-keypoints.txt`
  - 页面截图：`reports/lighthouse/P2.4_B/evidence/r3-real-auth-api/14-market-real-auth-api.jpg`
  - workers 关键请求：`reports/lighthouse/P2.4_B/evidence/r3-real-auth-api/21-workers-dev-keylogs.txt`
  - v2 读写验证：`15~18`（`put/get-self-selects-v2.*`）
- 快照关键点：
  - `当前状态 = authenticated`
  - `最近自动拉取 = remote @ /api/v2/self-selects`
  - `合并结果（新增 symbols）= 002594, 688001`

### C) Baseline 指标（Sentinel）

- 基线报告：`reports/lighthouse/P2.4_C/r2-baseline-with-token.md`
- 原始数据：`reports/lighthouse/P2.4_C/raw/p24-auth-baseline.json`
- 证据清单：`reports/lighthouse/P2.4_C/raw/p24-evidence-manifest.json`
- 关键指标（p95）：
  - 登录：`3.382ms`（目标 `<800ms`）
  - 迁移单用户：`15.444ms`（目标 `<3000ms`）
  - 同步延迟：`6.444ms`（秒级目标）
  - 三项 successRate 均为 `100%`

---

## 二、P2.4 DoD 1~6 严格 PASS/FAIL（R4 重跑）

| DoD | 要求 | 严格判定 | 证据与判定理由 |
|---|---|---|---|
| 1 | Cloudflare Access + JWT 登录流程全链路打通（支持至少 2 种登录方式） | **FAIL** | 当前落盘证据覆盖 Bearer/JWT 门禁与 API 通路（`P2.4_A/r2-auth-e2e.md`、`raw/r2-auth-e2e-matrix.json`），但仍缺“同账号至少 2 种登录方式”的可复核证据。 |
| 2 | v2.039 自选股迁移脚本执行成功，数据 100% 正确导入新 D1/KV | **PASS（D1+迁移口径）** | 新增远端 D1 复验已通过（`P2.4_C/raw/migration/r4-remote-*/01~04`）；且 baseline 迁移样本 10/10 成功、`importedCount=expectedCount=200`（`p24-auth-baseline.json`）。 |
| 3 | 前端通过 `$lib/auth` 登录后自选股自动同步并显示，无任何丢失 | **PASS（真实拉取+合并口径）** | R3 已给出真实 auth API 拉取与合并可见证据：`authenticated + remote pull + merged symbols`（`P2.4_B/r3-real-auth-api-closure.md`、`19-browser-snapshot-keypoints.txt`、`14-market-real-auth-api.jpg`）。 |
| 4 | 多设备（Web + PWA）切换后数据秒级一致 | **FAIL** | 有 API 级 A/B 同步延迟样本（`p24-auth-baseline.json`，p95=6.444ms），但缺少 **Web 与 PWA 同账号实机切换** 的端到端证据（截图/日志/对账）。 |
| 5 | 性能报告已提交：登录 <800ms，迁移单用户 <3s，Lighthouse 无新下降 | **FAIL** | 登录/迁移指标已满足（`p24-auth-baseline.json`）；但 P2.4 范围内缺“本轮 auth 改动后 Lighthouse 无新下降”的同口径对比签收文件。 |
| 6 | 安全审计项（JWT 验证、无明文密码）全部通过 | **FAIL** | JWT 验证通路有证据（`P2.4_A/r2-auth-e2e.md`），但“无明文密码 + 完整安全审计通过”缺正式审计报告/签收记录。 |

---

## 三、结论与剩余阻塞

当前严格判定：**2 PASS / 4 FAIL**，仍未达到 P2.4 全量验收通过。

剩余阻塞集中在三件事：
1. **DoD1**：补齐“至少 2 种登录方式”的同账号闭环证据；
2. **DoD4**：补齐 Web + PWA 实机切换秒级一致性证据；
3. **DoD5/6**：补齐 P2.4 口径 Lighthouse 对比签收 + 安全审计签收。

只要补齐以上证据，可直接重开本表进行最终复判。