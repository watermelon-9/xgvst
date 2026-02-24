# P2.4_A / R1 Infra 认证与 v2 迁移方案（Sub-A）

更新时间：2026-02-25（Asia/Shanghai）  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 第一段｜Cloudflare Access/JWT 中间件最小可执行方案（含本地模拟）

### 1) 落地内容

已在 Workers 侧新增并接入 Access/JWT 中间件：

- 新增：`packages/workers/src/auth/accessJwt.ts`
  - 支持身份来源：
    - `cf-access-jwt-assertion`
    - `Authorization: Bearer <jwt>`
    - （可选信任）`cf-access-authenticated-user-email`
  - 支持能力：
    - `exp` 过期校验
    - 可选 `iss/aud` 严格校验
    - 可选 HS256 本地签名验证（`ACCESS_JWT_HS256_SECRET`）
- 接入保护路由：
  - `/api/self-selects` + `/api/self-selects/*`
  - `/api/v2/self-selects` + `/api/v2/self-selects/*`
- 新增 v2 路由注册（与 v1 共用 handler），完成最小迁移闭环：
  - `GET/PUT/POST/DELETE /api/v2/self-selects`
  - `GET /api/v2/self-selects/history`
- `resolveUserId` 优先读取中间件注入身份（`c.get('auth')`），再兼容 query/header。

### 2) 配置面

已补充环境变量声明与 wrangler vars：

- `ACCESS_AUTH_REQUIRED`（默认 `1`）
- `ACCESS_TRUST_CF_HEADERS`（默认 `0`）
- `ACCESS_JWT_ISS` / `ACCESS_JWT_AUD`
- `ACCESS_JWT_HS256_SECRET`（secret，示例写入 `.env.example`）

涉及文件：
- `packages/workers/src/env.d.ts`
- `packages/workers/wrangler.toml`
- `.env.example`

### 3) 本地可模拟验证

新增脚本：`scripts/p24-auth-smoke.mjs`

实测证据：`reports/lighthouse/P2.4_A/raw/p24-auth-smoke.json`

结果摘要：
- 无 token 访问 `/api/v2/self-selects` → `401`（符合预期）
- Bearer JWT 访问 PUT/GET/history → 全部 `200`（符合预期）

---

## 第二段｜D1 users/self_selects 索引与迁移脚本对接路径核对

### 1) 索引核对

迁移 SQL：`packages/workers/migrations/0001_p23_proto_d1.sql`

本轮补充：
- `idx_users_updated_at ON users(updated_at DESC)`

已存在并确认：
- `self_selects` 主键 `(user_id, symbol)`
- `idx_self_selects_user_symbol`
- `idx_self_selects_user_updated`

本地 D1 索引证据：
- `reports/lighthouse/P2.4_A/raw/d1-users-indexes.txt`
- `reports/lighthouse/P2.4_A/raw/d1-self_selects-indexes.txt`

### 2) 迁移脚本路径对接

已更新脚本：`scripts/p23-d1-migrate.sh`

改动要点：
- 不再硬编码单一文件名；默认自动选择 `migrations/` 最新 SQL。
- 支持 `MIGRATION_REL` 覆盖。
- 输出本地 index 检查命令模板，便于验收后复核。

执行证据：
- `reports/lighthouse/P2.4_A/raw/p23-d1-migrate-run.log`

---

## 第三段｜DoD 映射（P2.4-Infra 维度）

> 注：仅对 Sub-A（Infra）负责范围判定。

1. **Access/JWT 中间件具备最小可执行能力并可本地模拟**  
   - 结论：✅ PASS
2. **v2 路由迁移路径可用且与现有存储链路一致**  
   - 结论：✅ PASS（v1/v2 共用 handler）
3. **D1 users/self_selects 索引与迁移路径清晰、可执行**  
   - 结论：✅ PASS
4. **静态检查通过（不破坏主线构建）**  
   - 结论：✅ PASS（`pnpm --filter workers check` 通过）

---

## 第四段｜风险、回滚与下一步

### 风险

1. **Cloudflare Access 公钥验签未接入（当前最小版）**  
   当前是“可选 HS256 + claim 校验 + header 信任模式”的最小方案；生产建议升级为 Access JWK/issuer 强校验。
2. **`ACCESS_AUTH_REQUIRED=1` 后，旧脚本若仅依赖 `x-user-id` 会被拦截**  
   需逐步改造压测/冒烟脚本为 Bearer/JWT 或在本地临时置 `ACCESS_AUTH_REQUIRED=0`。
3. **v1/v2 双栈阶段的口径一致性**  
   需在网关层明确切流比例与退回策略，避免部分客户端仅打 v1。

### 回滚点

- 路由层可快速回退到仅 v1：移除 `/api/v2/self-selects*` 注册。
- 认证可临时降级：`ACCESS_AUTH_REQUIRED=0`（仅限本地/灰度排障，不建议生产长期开启）。

### 下一步建议（P2.4 后续）

- 接入 Cloudflare Access JWK 验签（替代最小 HS256 模式）。
- 对现有 p23/p24 脚本补齐 Bearer token 注入，形成统一压测基线。
- 增加 v1/v2 命中率与鉴权失败率指标（便于迁移窗口观测）。
