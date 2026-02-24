# P2.4_C / R1 Sentinel：用户认证与 v2 迁移压测方案（按任务书四段）

- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 执行角色：Sub-C（Sentinel）
- 产出时间：2026-02-25
- 对齐依据：`西瓜说股_v3.0_详细任务安排_修订版_2026-02-23.md` 第 **2.4** 节

---

## 第一段｜详细步骤（压测方案设计 + baseline 执行）

### 1) 三项关键链路压测口径（本轮定义）

1. **登录耗时（Login Latency）**
   - 指标：登录后首个受保护接口请求耗时（p50/p95）
   - 成功条件：HTTP 2xx 且拿到用户上下文
   - 阈值（DoD）：`p95 < 800ms`

2. **迁移耗时（Migration Latency）**
   - 指标：单用户 v2 自选批量导入耗时（p50/p95）
   - 成功条件：导入数 = 输入数，且幂等重放不重复
   - 阈值（DoD）：`单用户 < 3s`

3. **多端同步延迟（Cross-device Sync Lag）**
   - 指标：A 端写入后 B 端可见延迟（p50/p95）
   - 成功条件：目标 symbol 在超时窗口内可见
   - 阈值（本轮收口）：`p95 <= 1s`（任务书多设备“秒级一致”）

### 2) baseline 脚本落地

新增脚本：`scripts/p24-auth-baseline.mjs`

- 功能：一键产出三项基线（login/migration/sync）
- 默认输出：`reports/lighthouse/P2.4_C/raw/p24-auth-baseline.json`
- 证据清单：`reports/lighthouse/P2.4_C/raw/p24-evidence-manifest.json`

运行方式：

```bash
node scripts/p24-auth-baseline.mjs
# 或
pnpm workers:p24-auth-baseline
```

本轮实际执行（缩样本）：

```bash
P24_LOGIN_ITERATIONS=5 P24_MIGRATION_ITERATIONS=3 P24_SYNC_ITERATIONS=3 node scripts/p24-auth-baseline.mjs
```

得到结果（节选）：
- login p95: `25.214ms`
- migration p95: `2.621ms`
- sync p95: `5057.618ms`
- 但三项成功率均为 `0`，状态码为 `401`（认证门禁未放行，见第二段）

---

## 第二段｜注意事项（风险与门禁）

1. **当前主要阻塞不是性能，而是认证门禁**
   - 基线请求均返回 `401`，导致迁移与同步无法进入有效样本。
   - 需先完成 Access/JWT 本地联调（或提供测试 token 注入方式）。

2. **压测必须区分两层结果**
   - 层 A：接口时延（即使 401 也能测到 RTT）
   - 层 B：业务成功时延（必须 2xx 且数据正确）
   - DoD 判定以层 B 为准。

3. **迁移场景需强制幂等复放**
   - 同一用户同一批 symbols 至少重放 2 次，验证无重复写入、无丢失。

4. **多端同步测试必须模拟 A/B 端独立会话**
   - A 端写入、B 端轮询验证，保留 poll 次数与超时日志。

---

## 第三段｜工作安排执行回执（Sub-A / Sub-B / Sub-C）

### Sub-C（本轮已完成）
- [x] 设计并固化 P2.4 三项压测方案（登录/迁移/同步）
- [x] 新增 baseline 脚本：`scripts/p24-auth-baseline.mjs`
- [x] 准备证据目录：
  - `reports/lighthouse/P2.4_C/raw/auth/`
  - `reports/lighthouse/P2.4_C/raw/migration/`
  - `reports/lighthouse/P2.4_C/raw/sync/`
  - `reports/lighthouse/P2.4_C/raw/logs/`
- [x] 产出证据说明：`reports/lighthouse/P2.4_C/raw/README.md`
- [x] 执行一次 baseline 试跑并落盘 JSON 证据

### 需 Sub-A 配合
- [ ] 提供 Access/JWT 测试联调方案（本地/预发）
- [ ] 明确受保护接口白名单与 token 注入方式

### 需 Sub-B 配合
- [ ] 对齐 `$lib/auth/useAuth` 的登录后首跳路径，给出前端可复现压测入口
- [ ] 提供“迁移完成后自动拉取并合并自选”的可观测标志位/日志点

---

## 第四段｜DoD 映射与当前判定（P2.4）

> 说明：本报告是 **Sentinel 方案与基线阶段**，不宣称功能已全量验收通过。

| P2.4 DoD | 要求 | 当前状态 | 证据 |
|---|---|---|---|
| DoD1 | Access + JWT 登录链路打通（>=2种登录） | BLOCKED（401 门禁） | `raw/p24-auth-baseline.json` |
| DoD2 | v2.039 迁移脚本 100% 导入正确 | PLAN_READY（脚本口径就绪，待 token） | `scripts/p24-auth-baseline.mjs` |
| DoD3 | 登录后自选自动同步显示 | PLAN_READY（同步延迟口径就绪） | `raw/p24-evidence-manifest.json` |
| DoD4 | Web + PWA 秒级一致 | BLOCKED（认证未放行） | `raw/p24-auth-baseline.json` |
| DoD5 | 登录<800ms、迁移<3s、Lighthouse无新下降 | PARTIAL（仅拿到 401 RTT，不是业务成功样本） | `raw/p24-auth-baseline.json` |
| DoD6 | 安全审计（JWT、无明文密码）通过 | BLOCKED（待联调后复核） | 待补 `auth/` 与 `logs/` |

### 结论
- **本轮完成了 P2.4 Sentinel 的“方案 + 脚本 + 证据目录”入场条件。**
- 下一步关键是先解除 Access/JWT 的 401 阻塞，再执行 full-run 压测并出最终验收判定。
