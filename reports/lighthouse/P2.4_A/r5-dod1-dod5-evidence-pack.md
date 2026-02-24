# P2.4 R5 Sub-A：DoD1 / DoD5 证据包（补齐版）

更新时间：2026-02-25（Asia/Shanghai）  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 0) 统一口径（本包采用）

- **DoD1（登录方式）**：按“同一受保护 API（`/api/v2/self-selects`）在不同认证入口下可稳定通过”判定；至少覆盖 2 种入口。
- **DoD5（性能）**：
  - 登录 p95 `< 800ms`
  - 迁移（单用户导入）p95 `< 3000ms`
- 证据分两层：
  - **业务口径**（API 端到端耗时）
  - **远端基础设施口径**（D1 `--remote` 迁移执行与远端路径）

---

## 1) DoD1：Access / JWT 两种登录方式证据现状

### 1.1 已有证据（JWT 主路径，已充足）

1. `reports/lighthouse/P2.4_A/raw/r2-auth-e2e-matrix.json`  
   - 8 组场景 × 2 端点（`/api/self-selects`、`/api/v2/self-selects`）
   - 覆盖：无 token 401；Bearer JWT 200；exp/iss/aud/HS256 开关行为
2. `reports/lighthouse/P2.4_A/raw/p24-auth-smoke.json`  
   - `unauthorized-check=401`、`authorized-put/get/history=200`
3. `reports/lighthouse/P2.4_A/r2-auth-e2e.md`  
   - 对上述矩阵进行归档与 DoD 映射

结论：**JWT（Authorization Bearer）路径 PASS**。

### 1.2 Access 路径现状（原缺口 + R5 最小替代验证）

#### 原缺口（截至 R4）
- 缺“真实 Cloudflare Access 交互登录（同账号）”闭环证据（如 Access 门户登录态、回注 header/cookie 的浏览器链路截图与日志）。

#### R5 最小可执行替代验证（本次新增）
- 新增脚本：`scripts/p24-r5-auth-dual-mode.mjs`
- 新增证据：`reports/lighthouse/P2.4_A/raw/r5-auth-dual-mode.json`
- 验证同一端点：`GET /api/v2/self-selects`
- 四组结果（4/4 通过）：
  - 无认证头 → `401`
  - `Authorization: Bearer <jwt>` → `200`
  - `cf-access-jwt-assertion: <jwt>` → `200`
  - `cf-access-authenticated-user-email`（`ACCESS_TRUST_CF_HEADERS=1`）→ `200`

结论：
- **两类认证入口（JWT Bearer 与 Access Header）在代码路径上均已可执行验证并通过**；
- 但“真实 Access 门户登录交互证据”仍属于残余缺口（见下）。

### 1.3 DoD1 当前判定与缺口说明

- 当前按“至少两种登录方式可执行并可复核”口径：**条件性 PASS**（JWT + Access Header 替代验证已具备）。
- 残余缺口（需后续补齐以达强审计口径）：
  1. 真实 Cloudflare Access 登录态证据（浏览器链路）；
  2. 同账号跨两种方式切换的端到端截图/日志闭环。

---

## 2) DoD5：登录 <800ms、迁移 <3s 证据重整（含远端路径）

### 2.1 业务性能主证据（统一来源）

来源文件：`reports/lighthouse/P2.4_C/raw/p24-auth-baseline.json`

- 登录（30 次）
  - p95 = **3.382ms**（阈值 800ms）
  - 结论：✅ PASS
- 迁移（10 用户 × 200 symbols）
  - p95 = **15.444ms**（阈值 3000ms）
  - 结论：✅ PASS

拆分证据文件：
- 登录：`reports/lighthouse/P2.4_C/raw/auth/login-latency-2026-02-24T19-08-14-884Z.json`
- 迁移：`reports/lighthouse/P2.4_C/raw/migration/migration-latency-2026-02-24T19-08-14-884Z.json`
- 清单：`reports/lighthouse/P2.4_C/raw/p24-evidence-manifest.json`

### 2.2 远端路径证据（D1 `--remote`）

远端目录：
- `reports/lighthouse/P2.4_C/raw/migration/r4-remote-2026-02-24T19-26-35Z/`

关键文件：
1. `00-wrangler-whoami.txt`
2. `01-remote-migration-execute.txt`
   - 数据库：`xgvst_quote`
   - DB ID：`9db19911-21e7-4245-8c94-6571aa7a35fb`
   - `Processed 9 queries`
   - `success: true`
   - `sql_duration_ms: 2.16`
3. `02~04-remote-index-*.txt`（远端索引复验）
4. `05-remote-table-counts.txt`（远端表计数快照）

说明：
- DoD5“<3s”主判定采用 API 端到端迁移 p95（15.444ms）；
- 远端 D1 执行证据作为基础设施补强，证明迁移脚本在 `--remote` 路径已成功执行并可复核。

### 2.3 DoD5 判定

- 登录 p95 < 800ms：✅ PASS（3.382ms）
- 迁移 p95 < 3s：✅ PASS（15.444ms）
- 远端路径证据：✅ 已附（r4-remote 目录）

---

## 3) 最终结论（R5 Sub-A）

1. **DoD1**：完成 Access/JWT 证据现状梳理；对缺失的“第二方式”补了可执行最小替代验证（`r5-auth-dual-mode.json`），并明确真实 Access 交互证据缺口。  
2. **DoD5**：按统一口径重整“登录<800ms、迁移<3s”证据，且补齐远端路径引用（`r4-remote-*`）。  
3. 本证据包文件已生成：`reports/lighthouse/P2.4_A/r5-dod1-dod5-evidence-pack.md`。
