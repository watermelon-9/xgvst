# P2.4_A / R2 认证门禁 e2e 联调验收报告（Sub-A Infra）

更新时间：2026-02-25（Asia/Shanghai）  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 第一段｜/api/self-selects 与 /api/v2/self-selects JWT 门禁 e2e 批量证据

### 执行内容
- 新增批量验证脚本：`scripts/p24-r2-auth-e2e.mjs`
- 目标端点：
  - `GET /api/self-selects`
  - `GET /api/v2/self-selects`
- 每个场景统一验证三类请求：
  1. 无 token（预期 401）
  2. 有效 token（预期 200）
  3. 探针 token（按场景预期 200/401）

### 证据文件
- 批量矩阵总证据：`reports/lighthouse/P2.4_A/raw/r2-auth-e2e-matrix.json`
- D1 本地迁移日志：`reports/lighthouse/P2.4_A/raw/p23-d1-migrate-run.log`
- 场景运行日志：`reports/lighthouse/P2.4_A/raw/r2-auth-e2e-*.log`

### 结果摘要
- 场景总数：8
- 通过：8 / 8
- 两条接口在所有场景均满足基础门禁：
  - 无 token → 401
  - 有效 token → 200

---

## 第二段｜exp/iss/aud/HS256 可开关路径核对（配置矩阵）

| 场景 | 关键配置 | 探针 token | 预期 | 实际 |
|---|---|---|---:|---:|
| exp-off-no-claim | `ACCESS_JWT_ISS=""` `ACCESS_JWT_AUD=""` `ACCESS_JWT_HS256_SECRET=""` | 不带 `exp` | 200 | 200 |
| exp-on-expired | 同上 | 过期 `exp` | 401 | 401 |
| iss-off-mismatch | `ACCESS_JWT_ISS=""` | `iss` 不匹配 | 200 | 200 |
| iss-on-mismatch | `ACCESS_JWT_ISS="trusted-issuer"` | `iss` 不匹配 | 401 | 401 |
| aud-off-mismatch | `ACCESS_JWT_AUD=""` | `aud` 不匹配 | 200 | 200 |
| aud-on-mismatch | `ACCESS_JWT_AUD="trusted-aud"` | `aud` 不匹配 | 401 | 401 |
| hs256-off-wrong-signature | `ACCESS_JWT_HS256_SECRET=""` | 错签名 | 200 | 200 |
| hs256-on-wrong-signature | `ACCESS_JWT_HS256_SECRET="dev-access-secret"` | 错签名 | 401 | 401 |

结论：`exp/iss/aud/HS256` 四条路径均验证到“可开/可关”行为，且与代码实现一致。

---

## 第三段｜DoD 映射（R2 Infra）

1. **/api/self-selects 与 /api/v2/self-selects 完成 JWT 门禁 e2e（无 token 401、有 token 200）批量证据**  
   - 结论：✅ PASS  
   - 证据：`raw/r2-auth-e2e-matrix.json`（8 场景 × 2 端点）

2. **exp/iss/aud 与本地 HS256 验签路径可开关运行并输出配置矩阵**  
   - 结论：✅ PASS  
   - 证据：本报告第二段矩阵 + `raw/r2-auth-e2e-matrix.json`

3. **形成可验收联调文档（四段+DoD）**  
   - 结论：✅ PASS  
   - 证据：`reports/lighthouse/P2.4_A/r2-auth-e2e.md`

---

## 第四段｜风险、回滚与后续建议

### 风险
- 当前 HS256 验签是“本地模拟/联调”路径，生产仍建议升级为 Cloudflare Access JWK 公钥验签。
- 当 `ACCESS_JWT_ISS/AUD` 开启严格匹配后，历史脚本如未同步 claim 生成策略会集中出现 401。

### 回滚
- 联调阻塞时，可临时清空 `ACCESS_JWT_ISS/AUD` 或 `ACCESS_JWT_HS256_SECRET` 回到宽松模式；
- 仅本地排障可使用 `ACCESS_AUTH_REQUIRED=0`（不建议生产启用）。

### 后续建议
- 将 `scripts/p24-r2-auth-e2e.mjs` 接入 CI 夜间任务，固定回归认证门禁；
- 在后续 R3/R4 统一将 p23/p24 相关脚本全部迁移到 Bearer/JWT 口径，避免“header 用户ID直传”残留。
