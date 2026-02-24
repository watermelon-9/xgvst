# P2.4_C / R2 Sentinel：带测试 Token 的有效 Baseline（四段 + DoD 映射）

- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 执行角色：Sub-C（Sentinel）
- 执行时间：2026-02-25
- 基线入口：`node scripts/p24-auth-baseline.mjs`
- 目标：在 R1 门禁打通后，输出可用于 DoD 判断的有效样本

---

## 第一段｜详细步骤（按任务书执行）

1. **确认认证门禁已可用（Token 可通）**
   - 使用本地可用测试 token 路径（Bearer JWT）执行冒烟验证。
   - 冒烟结果：`/api/v2/self-selects` 在带 token 场景返回 200（门禁已打通）。

2. **重跑 p24-auth-baseline（三项全量）**
   - 执行命令：
     - `P24_BASE_URL=http://127.0.0.1:8787 node scripts/p24-auth-baseline.mjs`
   - 认证模式：`generated-hs256`（脚本自动生成测试 JWT 并注入 `Authorization: Bearer ...`）
   - 样本规模：
     - login 30
     - migration 10（每用户 200 symbols）
     - sync 12（A 写入 / B 读取）

3. **本轮关键结果（有效业务样本）**
   - **Login latency**：p50 **1.846ms** / p95 **3.382ms**，successRate **100%**
   - **Migration latency**：p50 **12.738ms** / p95 **15.444ms**，successRate **100%**
   - **Cross-device sync lag**：p50 **3.686ms** / p95 **6.444ms**，successRate **100%**

---

## 第二段｜注意事项（口径与边界）

1. 本次基线已从 R1 的 401 阻塞切换为 **2xx 业务成功样本**，DoD 判断可直接使用。
2. 迁移口径为“单用户 200 symbols replace 写入完成耗时”；并已记录每用户耗时明细。
3. 多端同步口径为“A 端写入 marker 后，B 端首次可见 marker 的延迟”；已记录每轮 poll 次数。
4. 当前为本地 wrangler/dev + local D1/KV 口径，后续可按同脚本切到预发/线上网关复测。

---

## 第三段｜证据补齐回执（raw + manifest）

### 1) baseline 总证据
- `reports/lighthouse/P2.4_C/raw/p24-auth-baseline.json`

### 2) migration 单用户耗时证据（新增）
- `reports/lighthouse/P2.4_C/raw/migration/migration-latency-2026-02-24T19-08-14-884Z.json`
- 内容包含：每用户 latency / importedCount / expectedCount / status

### 3) 多端同步延迟证据（新增）
- `reports/lighthouse/P2.4_C/raw/sync/sync-latency-2026-02-24T19-08-14-884Z.json`
- 内容包含：每用户 syncLatency / syncObserved / pollCount / mutateStatus

### 4) manifest 更新（新增 evidenceFiles）
- `reports/lighthouse/P2.4_C/raw/p24-evidence-manifest.json`
- 已写入本轮产物：auth/migration/sync/logs 四类文件映射

---

## 第四段｜DoD 映射与判定（P2.4）

| P2.4 DoD | 要求 | 本轮判定 | 依据 |
|---|---|---|---|
| DoD1 | Access + JWT 登录链路打通（>=2 种登录） | **PARTIAL/PASS(基线门禁层面)** | 已可在 Bearer JWT 下稳定通过；另一路登录方式需 A/B 侧补证据 |
| DoD2 | v2.039 迁移脚本 100% 导入正确 | **PASS（基线口径）** | migration successRate 100%，每用户 importedCount=expectedCount |
| DoD3 | 登录后自选自动同步显示 | **PASS（基线口径）** | sync successRate 100%，A/B 延迟样本完整 |
| DoD4 | Web + PWA 秒级一致 | **PASS（延迟口径）** | sync p95=6.444ms（远低于 1s） |
| DoD5 | 登录<800ms、迁移<3s、Lighthouse无新下降 | **PASS(性能子项)** | login p95=3.382ms；migration p95=15.444ms；sync p95=6.444ms |
| DoD6 | 安全审计（JWT、无明文密码）通过 | **待安全侧最终签收** | 本轮仅证明 JWT 门禁可用 + 业务路径可压测 |

**结论**：R2 Sub-C 已完成“带 token 的有效 baseline 重跑 + migration/sync 证据补齐 + manifest 更新”，可进入主线验收汇总。