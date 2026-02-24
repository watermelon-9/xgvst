# P2.4 R7 Sub-A：DoD1 最后闭环尝试（真实 Cloudflare Access 门户交互登录）

日期：2026-02-25（Asia/Shanghai）  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 1) 执行范围（按 R6 runbook 复跑）

本轮按 R6 口径执行一次“真实 Access 门户链路核验”，目标为：

1. 访问受保护 API 时进入 Cloudflare Access 门户（重定向/门户页）；
2. 门户可见至少 2 种登录方式；
3. 登录后回到同一受保护 API 并成功 200（含 cookie/header 证据）。

本轮证据目录：

- `reports/lighthouse/P2.4_A/raw/r7-access-closure-20260225-040011/`

---

## 2) 本轮产出证据（可复验）

### 2.1 Header / Location / Cookie 跳转链证据

目标 URL（与 R6 同类）：

- `https://xgvst-workers.viehh642.workers.dev/api/v2/self-selects`
- `https://xgvst-workers.viehh642.workers.dev/api/source/status`
- `https://xgvst-workers.viehh642.workers.dev/ws/quote`
- `https://xgvst.com/api/v2/self-selects`
- `https://xgvst.com/api/source/status`
- `https://xgvst.com/ws/quote`

对应证据文件（每个 URL 都有）：

- `*.head.txt`（首次响应头）
- `*.follow-headers.txt`（`curl -L` 跟随链路）
- `*.cookies.txt`（cookie jar）
- `*.curl-stderr.txt`（含 verbose 跳转与 TLS/HTTP 细节）
- `*.fakecfauth.head.txt` / `*.fakecfauth.body.txt`（伪 `CF_Authorization` 试探）
- 汇总：`90-grep-summary.txt`

关键结果：

- 未命中 `Location: https://<team>.cloudflareaccess.com/...`；
- 未出现 `CF_Authorization` / `cf-access-*` 的 `Set-Cookie` 或跳转链痕迹；
- `90-grep-summary.txt` 对 location/cloudflareaccess/cf-access/CF_Authorization 检索为空命中。

### 2.2 浏览器真实访问观察（门户是否出现）

- 文件：`20-browser-observation.txt`
- 观察结果：
  - workers 受保护 API 直返 JSON：`{"ok":false,"error":"unauthorized: missing or invalid access jwt"}`
  - `xgvst.com/api/v2/self-selects` 为站点 404 页面（非 Access 门户）
  - 未出现可交互 Access 登录控件（OTP/Google/Microsoft/GitHub 等）

### 2.3 登录后访问受保护 API 成功（闭环目标）

本轮**未能达成**。原因：链路未进入 Access 门户，无法完成门户登录并获得真实 Access 会话 cookie。

补充试探：

- `10-api-no-auth.*`、`11-api-fake-cookie.*`、`12-api-fake-cf-header.*`
- 均为 `401` + `unauthorized: missing or invalid access jwt`

说明伪 cookie/header 不会被当作真实 Access 登录态。

---

## 3) 判定（R7 DoD1 严格口径）

结论：**本轮仍未闭环 DoD1 严格证据**。

根因不是“采证动作缺失”，而是“目标链路当前未被 Cloudflare Access 门户接管”，因此无法产生“门户交互登录 -> 回跳受保护 API -> 200”的强审计闭环。

---

## 4) 最小外部前置条件清单（缺一不可）

1. Cloudflare Zero Trust Access Application 已创建，且 `Include` 策略覆盖目标 API 路径（至少 `/api/v2/self-selects`）。
2. 目标域名（建议 `api.xgvst.com` 或明确受保护子域）流量经过 Cloudflare 并绑定 Access App。
3. Access 登录 IdP 至少启用两种（例如 OTP + Google）。
4. 测试账号在两种 IdP 均可登录（或准备两账号）。
5. 目标 Worker/上游允许在 Access 放行后返回业务 200（而非路由 404）。

---

## 5) “可立即执行的一步到位操作清单”（用户/平台侧）

> 目标：一次配置后，立刻可让下轮采证拿到 DoD1 严格闭环。

1. 在 Cloudflare Access 把受保护地址统一为一个明确 API 域名（推荐：`https://api.xgvst.com/api/v2/self-selects`），避免当前 `xgvst.com/api/*` 命中站点 404。
2. 在该 Access App 的 Policy 中启用至少两种登录方式（例如 One-time PIN + Google Workspace）。
3. 执行一次未登录探测，确认出现 `cloudflareaccess.com` 跳转：
   ```bash
   curl -sSI https://api.xgvst.com/api/v2/self-selects
   curl -sSL -D access-follow.headers -o access-login.html https://api.xgvst.com/api/v2/self-selects
   ```
4. 用浏览器完成方式A与方式B两次登录（分别用隐私窗口），登录后从 DevTools 导出 cURL（含 cookie）。
5. 回放两份 cURL，请求同一 API，拿到两份 `200` 响应并保存头/body，作为 DoD1 最终闭环。

---

## 6) 结语

R7 已完成“按 R6 runbook 的真实链路复核与证据落盘”，并明确当前阻塞点与最小外部前置条件。待 Access 门户接管配置到位后，可按第 5 节流程一次性补齐 DoD1 严格闭环证据。