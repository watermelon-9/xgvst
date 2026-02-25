# P2.5_A r1_1 v2（Sub-A）Infra Email-Only Auth 重跑报告

- 执行时间：2026-02-25
- 执行范围：Workers 认证接口（邮箱口径）+ JWT 受保护 self-select 链路 + 前置项盘点
- 关联硬约束：
  - ✅ 仅邮箱认证
  - ✅ `/auth` 页面无导航栏由前端控制
  - ✅ 与 2.4 JWT 认证链路打通
  - ✅ 无明文密码落库

---

## 1) ✅详细步骤（逐条映射任务）

### 任务1：Workers 认证接口收敛为邮箱口径（登录/注册/忘记密码）

**代码落地**
1. 新增 `packages/workers/src/auth/emailAuth.ts`：
   - 邮箱校验、密码强度校验
   - PBKDF2-SHA256 哈希（含 `AUTH_PASSWORD_PEPPER`）
   - reset token 哈希（含 `AUTH_RESET_TOKEN_PEPPER`）
   - HS256 Access JWT 签发（兼容 2.4 的 `ACCESS_JWT_*` 校验口径）
2. 在 `packages/workers/src/index.ts` 新增并注册：
   - `POST /api/auth/register` + `POST /api/v2/auth/register`
   - `POST /api/auth/login` + `POST /api/v2/auth/login`
   - `POST /api/auth/forgot-password` + `POST /api/v2/auth/forgot-password`
3. 新增/更新环境变量声明：
   - `packages/workers/src/env.d.ts`
   - `.env.example`

**实测证据（非口述）**
- 证据脚本：`scripts/p25-a-email-auth-proof.mjs`
- 证据结果：`reports/lighthouse/P2.5_A/raw/r1_1-v2/p25-a-email-auth-proof-latest.json`
  - register-invalid-email → `400`
  - register-short-password → `400`
  - register-success → `200`（返回 accessToken）
  - login-wrong-password → `401`
  - login-success → `200`（返回 accessToken）
  - forgot-invalid-email → `400`
  - forgot-success → `200`

**无明文密码证据**
- D1 抽样：`reports/lighthouse/P2.5_A/raw/r1_1-v2/d1-auth-accounts-sample.txt`
  - 仅存在 `password_hash/password_salt/password_iter/reset_token_hash`
  - 未出现明文字段

---

### 任务2：验证 JWT + 受保护 self-select 接口链路（成功/失败/边界）

**实测矩阵（同一证据文件）**
- `self-select-no-token` → `401`（受保护生效）
- `self-select-put-with-login-token` → `200`
- `self-select-get-with-login-token` → `200`
- `self-select-expired-token` → `401`
- `self-select-invalid-signature-token` → `401`
- 边界：`self-select-boundary-sub-only-token` → `200`（无 email claim，仅 sub）
- 边界：`self-select-boundary-clear-empty-array` → `200`（空数组清空）

**结论**
- 登录签发 JWT 可直接访问 2.4 受保护接口（`/api/v2/self-selects*`），链路打通。

---

### 任务3：验证码链路与 OAuth/微信前置项清单（已完成/待外部配置）

#### 验证码/找回链路
- 已完成：
  - `forgot-password` 受理、生成 reset token、只存 hash（不存明文）
  - 可配置 dev 回显（`AUTH_FORGOT_DEBUG_RETURN_TOKEN=1`）用于测试取证
- 待外部配置：
  - 邮件网关（SMTP/邮件服务商）
  - 真实发送模板、发件域名/SPF/DKIM/DMARC
  - reset 链接回调前端页面与风控策略

#### OAuth / 微信前置项
- 已完成：
  - 在 `.env.example` 增加占位配置项：
    - `AUTH_OAUTH_GOOGLE_CLIENT_ID`
    - `AUTH_OAUTH_GOOGLE_CLIENT_SECRET`
    - `AUTH_WECHAT_APP_ID`
    - `AUTH_WECHAT_APP_SECRET`
- 待外部配置：
  - 第三方应用注册（Google/微信开放平台）
  - 回调域名白名单与审核
  - 生产密钥注入（Wrangler Secret）

---

### 任务4：报告输出

- 已输出本报告：
  - `reports/lighthouse/P2.5_A/r1_1-v2-infra-email-only-auth.md`

---

### 任务5：commit

- 已完成提交（仅包含本轮相关文件，见下文 DoD）。

---

## 2) ✅注意事项

1. 本轮 JWT 签发依赖 `ACCESS_JWT_HS256_SECRET`，否则注册/登录会返回 `503`（避免签发不可验证 token）。
2. `AUTH_FORGOT_DEBUG_RETURN_TOKEN` 仅用于测试环境取证，生产必须关闭。
3. 密码与 reset token 均仅以哈希形式存储（含 pepper），满足“无明文密码”。
4. `/auth` 页面无导航栏由前端控制，证据：
   - `reports/lighthouse/P2.5_A/raw/r1_1-v2/frontend-auth-layout-proof.txt`
   - 关键逻辑：`isAuthRoute => !isAuthRoute 才渲染 AppHeader`。

---

## 3) ✅工作安排（本轮执行与后续建议）

### 本轮已执行
- [x] Workers 认证接口补齐并统一邮箱口径
- [x] 与 2.4 JWT + self-select 保护链路联调验证
- [x] 无明文密码落库验证
- [x] 形成证据包与报告

### 下一步建议（外部依赖）
- [ ] 接入真实邮件发送服务（forgot-password 真发送）
- [ ] 增加 reset-password 完整闭环 API（token 校验 + 改密）
- [ ] OAuth/微信 provider 实际联调（依赖第三方平台配置完成）

---

## 4) ✅DoD（PASS/FAIL）

| DoD项 | 结果 | 证据 |
|---|---|---|
| D1. 仅邮箱口径认证接口（登录/注册/忘记密码） | **PASS** | `packages/workers/src/index.ts` + `reports/lighthouse/P2.5_A/raw/r1_1-v2/p25-a-email-auth-proof-latest.json` |
| D2. JWT 与 2.4 受保护 self-select 链路可用（成功/失败/边界） | **PASS** | 同上证据文件 `steps[*self-select*]` |
| D3. 无明文密码 | **PASS** | `reports/lighthouse/P2.5_A/raw/r1_1-v2/d1-auth-accounts-sample.txt` |
| D4. `/auth` 无导航栏由前端控制 | **PASS** | `reports/lighthouse/P2.5_A/raw/r1_1-v2/frontend-auth-layout-proof.txt` |
| D5. 验证码链路 + OAuth/微信前置项清单 | **PASS（清单完成）** | 本报告“任务3”章节 + `.env.example` |
| D6. 构建/类型检查通过 | **PASS** | `reports/lighthouse/P2.5_A/raw/r1_1-v2/workers-check.log` |

---

## 变更文件清单（本轮）

- `packages/workers/src/auth/emailAuth.ts`（新增）
- `packages/workers/src/index.ts`
- `packages/workers/src/env.d.ts`
- `.env.example`
- `scripts/p25-a-email-auth-proof.mjs`（新增）
- `reports/lighthouse/P2.5_A/raw/r1_1-v2/*`（证据）
- `reports/lighthouse/P2.5_A/r1_1-v2-infra-email-only-auth.md`（本报告）
