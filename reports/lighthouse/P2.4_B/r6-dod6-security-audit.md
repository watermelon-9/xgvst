# P2.4 R6 Sub-B｜DoD6 安全审计证据（JWT 验证、无明文密码）

日期：2026-02-25  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 0. 审计结论（先给结论）

**结论：DoD6 通过（PASS）**

1. **JWT 验证链路完整且生效**：受保护路由已挂载 `accessJwtMiddleware`，支持 `cf-access-jwt-assertion` / `Authorization: Bearer` /（可配置）`cf-access-authenticated-user-email`，并包含 `exp`、`iss`、`aud`、HS256 验签分支。  
2. **未发现明文密码存储链路**：D1 schema 与写入 SQL 中无 `password/passwd/pwd` 字段；用户相关写入仅 `user_id + symbol + 时间戳 + action`。  
3. **运行级验证通过**：`scripts/p24-r5-auth-dual-mode.mjs` 实测 4/4 场景通过（无 token=401；Bearer JWT=200；CF Access JWT=200；受信 Email 头=200）。

---

## 1. 代码级审计清单

### 1.1 JWT 门禁挂载（路由层）

- 文件：`packages/workers/src/index.ts`
- 证据：`361-364` 行
  - `/api/self-selects*` 与 `/api/v2/self-selects*` 全量挂载 `accessJwtMiddleware`

判定：✅ 受保护 API 已路由级强制鉴权。

### 1.2 JWT 解析与验签（中间件层）

- 文件：`packages/workers/src/auth/accessJwt.ts`
- 关键证据：
  - Token 来源解析：`118` 行（`cf-access-jwt-assertion` 或 Bearer）
  - HS256 验签：`51-67`、`124-127` 行
  - 过期校验 `exp`：`129-131` 行
  - `iss` 校验：`133-136` 行
  - `aud` 校验：`137-139` 行
  - 鉴权失败返回 401：`94-99`、`163-165` 行

判定：✅ JWT 校验链路具备完整拒绝路径（invalid/missing/expired/claim mismatch）。

### 1.3 身份注入与业务使用（业务层）

- 文件：`packages/workers/src/auth/accessJwt.ts`
  - `identity` 注入上下文：`167` 行（`c.set('auth', identity)`）
- 文件：`packages/workers/src/index.ts`
  - `resolveUserId` 优先读取 `auth.userId`：`561-563` 行
  - 无 userId 的业务拒绝：`589`、`598`、`622`、`680`、`713`、`735` 行

判定：✅ JWT 身份已实质进入业务查询/写入链路，不是“仅校验不使用”。

### 1.4 无明文密码存储（Schema + SQL 写入）

- 文件：`packages/workers/migrations/0001_p23_proto_d1.sql`
  - `users` 表仅 `user_id/created_at/updated_at`：`8-12` 行
  - `self_selects` 表仅 `user_id/symbol/created_at/updated_at`：`15-22` 行
  - `quote_history` 表仅 `user_id/symbol/action/ts`：`30-36` 行
- 文件：`packages/workers/src/index.ts`
  - 业务写入 SQL 仅上述字段：`582`、`636-637`、`644-645`、`693-697` 行

判定：✅ 数据模型与写入语句均无密码字段，无明文密码落库路径。

### 1.5 Secret 管理约束（配置层）

- 文件：`packages/workers/wrangler.toml`
  - 明确“no plaintext secrets in repo”：`10-14` 行
- 文件：`.env.example`
  - `ACCESS_JWT_HS256_SECRET` 标注仅本地模拟：`39-40` 行
  - 上游凭据要求 `wrangler secret put`：`45-54` 行

判定：✅ 密钥治理策略明确，仓库内未见实际明文 secret 值。

---

## 2. 运行级审计清单

### 2.1 JWT 门禁实测

执行：

```bash
node scripts/p24-r5-auth-dual-mode.mjs
```

结果（本次）：

```json
{
  "ok": true,
  "outFile": "/Users/mac/.openclaw/workspace/xgvst/reports/lighthouse/P2.4_A/raw/r5-auth-dual-mode.json",
  "passCount": 4,
  "total": 4
}
```

运行证据文件：`reports/lighthouse/P2.4_A/raw/r5-auth-dual-mode.json`

- `unauthorized-no-token` -> `401`（PASS）
- `jwt-authorization-bearer` -> `200`（PASS）
- `access-cf-access-jwt-assertion` -> `200`（PASS）
- `access-cf-email-header-trusted` -> `200`（PASS）

判定：✅ 运行态 JWT 门禁与多身份入口均按预期工作。

### 2.2 明文密码排查（代码库扫描）

执行：

```bash
grep -RIn "password\|passwd\|pwd" packages/workers/src packages/workers/migrations || true
```

结果：`(no output)`

判定：✅ workers 核心源码与 DB 迁移未出现密码字段关键词。

---

## 3. DoD6 验收映射

| DoD6 要求 | 证据 | 结论 |
|---|---|---|
| JWT 验证链路可证明 | `accessJwt.ts` 校验逻辑 + 路由挂载 + 运行 4 场景验证 | ✅ PASS |
| 无明文密码存储可证明 | D1 schema + SQL 写入 + grep 扫描无 password 字段 | ✅ PASS |

---

## 4. 风险与建议（审计附注）

1. 当前 `ACCESS_TRUST_CF_HEADERS=1` 仅应在 Access 保护链路后启用（代码已支持开关，继续保持）。
2. 若后续引入账号密码体系，应新增：哈希算法基线（Argon2/bcrypt）、盐策略、迁移脚本与脱敏审计项，避免偏离本次“无密码存储”前提。

---

## 5. 审计签名

- 审计类型：代码级 + 运行级
- 审计结论：**DoD6 PASS**
- 输出文件：`reports/lighthouse/P2.4_B/r6-dod6-security-audit.md`
