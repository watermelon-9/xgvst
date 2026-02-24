# P2.4 R6 Sub-A：DoD1「真实 Cloudflare Access 门户交互登录链路」严格证据

日期：2026-02-25（Asia/Shanghai）  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 1) 任务目标与口径

本轮仅攻坚 DoD1 严格口径缺口：

- 在既有 JWT 证据之外，补齐「**真实 Cloudflare Access 门户交互登录链路**」可复验证据；
- 若环境受限，给出可执行替代方案，并把缺口最小化。

严格口径定义（本报告采用）：
1. 目标受保护 API 请求会被 Cloudflare Access 网关接管（出现 Access 跳转/门户页）；
2. 门户可见并可操作至少 2 种登录方式（如 OTP + Google/Microsoft/GitHub）；
3. 登录后回到同一受保护 API，出现 Access 认证态（cookie/header）并返回 200。

---

## 2) 本轮新增证据（已落盘）

目录：`reports/lighthouse/P2.4_A/raw/r6-real-access/`

- `00-timestamp.txt`
- `01-env.txt`
- `10-head-*.txt`：目标 URL 首次响应头
- `11-follow-*.txt`：`curl -L` 跟随链路响应头
- `20-auth-dual-mode-reuse-r5.json`：复用 R5 双认证入口通过证据
- `21-auth-dual-mode-reuse-r5.log`
- `30-header-grep-summary.txt`：`Location` / `cf-access` 关键头检索结果

---

## 3) 真实 Access 门户链路探测结果（本环境）

### 3.1 探测 URL

- `https://xgvst-workers.viehh642.workers.dev/api/v2/self-selects`
- `https://xgvst-workers.viehh642.workers.dev/api/source/status`
- `https://xgvst-workers.viehh642.workers.dev/ws/quote`
- `https://xgvst.com/api/v2/self-selects`
- `https://xgvst.com/api/source/status`
- `https://xgvst.com/ws/quote`

### 3.2 关键观测

1. workers API 路径返回业务状态（`401/200/426`），未出现 Access 跳转：  
   见 `10-head-https___xgvst-workers.viehh642.workers.dev_api_v2_self-selects.txt` 等。
2. `xgvst.com/api/*` 为站点路由 404（Svelte 页面），并非 Access 门户：  
   见 `10-head-https___xgvst.com_api_v2_self-selects.txt`。
3. `curl -L` 全链路无 `Location: https://*.cloudflareaccess.com/...`，也无 `CF_Authorization` / `cf-access-*` 回注证据：  
   见 `30-header-grep-summary.txt`（为空命中）。

### 3.3 结论（严格口径）

- **本环境无法产出“真实 Cloudflare Access 门户交互登录”闭环证据**；
- 原因是当前探测到的目标链路并未被 Access 门户接管（未进入 Access 交互页）。

---

## 4) DoD1「至少2种登录方式」现有可复核证据（补充引用）

在“真实 Access 门户”缺失情况下，当前已稳定复核的两类认证入口为：

1. JWT Bearer：`Authorization: Bearer <jwt>` -> `200`
2. Access Header 入口（代码路径）：
   - `cf-access-jwt-assertion: <jwt>` -> `200`
   - `cf-access-authenticated-user-email`（受 `ACCESS_TRUST_CF_HEADERS=1`）-> `200`

证据：
- `reports/lighthouse/P2.4_A/raw/r6-real-access/20-auth-dual-mode-reuse-r5.json`
- `reports/lighthouse/P2.4_A/raw/r5-auth-dual-mode.json`

> 说明：上述为“可执行替代/联调级”双方式证据，不等价于“真实 Access 门户交互”强审计证据。

---

## 5) 可执行替代方案（缺口最小化，下一步直接可跑）

当 Access 应用与策略就位后，按以下步骤补齐强审计闭环：

### Step A：确认 Access 接管已生效

```bash
PROTECTED_URL='https://<your-protected-domain>/api/v2/self-selects'
curl -sSI "$PROTECTED_URL" | tee 01-access-head.txt
curl -sSL -D 02-access-follow-headers.txt -o 02-access-login-page.html "$PROTECTED_URL"
```

验收点：
- 出现 `Location: https://<team>.cloudflareaccess.com/...` 或 Access 门户 HTML；
- 响应链路中出现 Access 相关头/挑战字段。

### Step B：门户「至少2种登录方式」截图证据

- 在同一门户页捕获登录方式按钮（如 OTP + Google），保存：
  - `03-portal-login-options.png`
  - `04-portal-login-options-dom.txt`（按钮文字/DOM 摘录）

### Step C：完成两种方式登录并回证受保护 API

分别使用方式 A、方式 B（建议两个独立隐私窗口），登录后抓取：

```bash
# 浏览器会话已登录后，导出 cookie 到 cookieA.txt / cookieB.txt（或 devtools copy as cURL）
curl -sS -b cookieA.txt -D 05-methodA-auth-head.txt "$PROTECTED_URL" -o 05-methodA-auth-body.json
curl -sS -b cookieB.txt -D 06-methodB-auth-head.txt "$PROTECTED_URL" -o 06-methodB-auth-body.json
```

验收点：
- 两次均返回 `200`；
- 能看到 Access 认证态（如 `CF_Authorization` cookie 生效、或后端识别 Access 身份头）。

---

## 6) 本轮最终判定（R6 Sub-A）

- **已完成**：
  - 对当前环境做了真实 Access 门户链路探测，并落盘可复核证据；
  - 明确证明当前链路未进入 Access 门户（非“主观缺失”，而是“链路未接管”）；
  - 复用并固化了 JWT + Access Header 双方式通过证据。
- **仍缺**（严格 DoD1）：
  - 真实 Cloudflare Access 门户交互登录（至少2种方式）闭环证据。

结论：
- 以“严格审计口径”看，**DoD1 仍待最终闭环**；
- 以“可执行替代 + 缺口最小化”看，已提供可直接执行的补齐路径与验收点。
