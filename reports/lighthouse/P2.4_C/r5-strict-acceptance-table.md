# P2.4 R5 Sub-C（Sentinel）严格验收表（基于 R4 最新修复重跑）

- 产出时间：2026-02-25（Asia/Shanghai）
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 口径：**仅按已落盘证据做严格 PASS/FAIL（缺证据即 FAIL）**
- 结论摘要：**P2.4 仍未通过严格验收（6 项 DoD 中 2 PASS / 4 FAIL）**

---

## 一、R5 重跑纳入证据（R4 CORS修复 + R3.1远端迁移 + R2 baseline + R5新增）

### A) R4 最新修复：CORS PUT/DELETE 预检放行（本轮关键新增）

- 修复报告：`reports/lighthouse/P2.4_A/r4-cors-put-fix.md`
- 关键原始证据：
  - `reports/lighthouse/P2.4_A/raw/r4-cors-options-put.txt`
  - `reports/lighthouse/P2.4_A/raw/r4-put-v2-self-selects.txt`
  - `reports/lighthouse/P2.4_A/raw/r4-get-v2-self-selects.txt`
- 关键事实：
  - OPTIONS 204 且 `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`
  - PUT `/api/v2/self-selects` 返回 200 且成功写入
  - 后续 GET 返回写入后的 symbols

> 说明：以上三份 CORS/PUT/GET 证据作为 **R5 新增纳入项**，用于确认 R3 中“syncError: Failed to fetch”阻塞已被关闭。

### B) R3.1 远端迁移复验（沿用）

- 目录：`reports/lighthouse/P2.4_C/raw/migration/r4-remote-2026-02-24T19-26-35Z/`
- 关键证据：
  - `01-remote-migration-execute.txt`（`Processed 9 queries`、`success: true`）
  - `02~04-remote-index-*.txt`（users/self_selects/quote_history 索引齐全）
  - `05-remote-table-counts.txt`（远端表计数快照）

### C) R2 baseline（沿用）

- `reports/lighthouse/P2.4_C/raw/p24-auth-baseline.json`
- 指标摘要（p95）：
  - 登录 `3.382ms`（目标 `<800ms`）
  - 迁移单用户 `15.444ms`（目标 `<3000ms`）
  - 同步延迟 `6.444ms`（秒级目标）
  - login/migration/sync successRate 全部 `100%`

### D) 前端真实 Auth API 闭环（沿用）

- `reports/lighthouse/P2.4_B/r3-real-auth-api-closure.md`
- `reports/lighthouse/P2.4_B/evidence/r3-real-auth-api/19-browser-snapshot-keypoints.txt`
- `reports/lighthouse/P2.4_B/evidence/r3-real-auth-api/14-market-real-auth-api.jpg`
- 关键事实：`authenticated`、`remote @ /api/v2/self-selects`、合并 symbols 可见。

---

## 二、P2.4 DoD 1~6 严格 PASS/FAIL（R5 重算）

| DoD | 要求 | 严格判定 | 证据与判定理由 |
|---|---|---|---|
| 1 | Cloudflare Access + JWT 登录流程全链路打通（支持至少 2 种登录方式） | **FAIL** | 现有证据覆盖 JWT 门禁与 API 通路（`P2.4_A/r2-auth-e2e.md`、`raw/r2-auth-e2e-matrix.json`），但仍缺“同账号至少 2 种登录方式”的可复核落盘证据。 |
| 2 | v2.039 自选股迁移脚本执行成功，数据 100% 正确导入新 D1/KV | **PASS（迁移+D1口径）** | 远端 `--remote` 迁移执行成功且索引齐全（`P2.4_C/raw/migration/r4-remote-*/01~04`）；baseline 中迁移样本 `10/10` 成功，`importedCount=expectedCount=200`。 |
| 3 | 前端通过 `$lib/auth` 登录后自选股自动同步并显示，无任何丢失 | **PASS（真实 API + CORS 闭环口径）** | R3 已证明真实 auth API 拉取/合并可见（`P2.4_B/r3-real-auth-api-closure.md`）；R4 最新修复补齐跨域 PUT 预检与写入闭环（`P2.4_A/raw/r4-cors-options-put.txt`、`r4-put-v2-self-selects.txt`、`r4-get-v2-self-selects.txt`）。 |
| 4 | 多设备（Web + PWA）切换后数据秒级一致 | **FAIL** | 有 API 级同步延迟证据（`p24-auth-baseline.json`，p95=6.444ms），但仍缺 **Web+PWA 同账号实机切换** 的端到端证据（跨端截图/日志/对账）。 |
| 5 | 性能报告已提交：登录 <800ms，迁移单用户 <3s，Lighthouse 无新下降 | **FAIL** | 登录/迁移指标已满足（`p24-auth-baseline.json`）；但 P2.4 口径下仍缺“auth 改动后 Lighthouse 无新下降”的同口径对比签收文件。 |
| 6 | 安全审计项（JWT 验证、无明文密码）全部通过 | **FAIL** | JWT 校验链路有证据（`P2.4_A/r2-auth-e2e.md`）；但“无明文密码 + 完整安全审计通过”缺正式审计报告/签收件。 |

---

## 三、R5 与 R4 的差异结论

- **DoD 通过数：2 → 2（不变）**
- 本轮新增价值：
  1. 明确验证 CORS 预检已放行 `PUT/DELETE`；
  2. 补齐了 DoD3 的“真实 API + 写入闭环”证据链完整性；
  3. 但 DoD1/4/5/6 仍受“缺关键验收证据”阻塞。

---

## 四、剩余阻塞（最小清单）

1. **DoD1**：补同账号“至少 2 种登录方式”全链路证据；
2. **DoD4**：补 Web + PWA 实机切换秒级一致性证据；
3. **DoD5**：补 P2.4 口径 Lighthouse 对比并签收“无新下降”；
4. **DoD6**：补安全审计签收（JWT + 无明文密码）。

满足以上 4 项后，可直接重开严格验收表做最终复判。