# P1.4_A Infra Status（主Agent手动核验）

时间：2026-02-24

## 结论总览
- HTTP/3 (QUIC)：**PASS**（数据面存在 h3 广告）
- 0-RTT Resumption：**PASS（已在控制台开启）**
- WebSockets：**PASS（控制台开关已启用）**
- TLS 1.3：**PASS（控制台显示启用，数据面 TLS1.3 握手）**
- 跨 Pages 与 Workers WebSocket 联通：**部分通过 / 需补路由**
  - `wss://xgvst-workers.viehh642.workers.dev/ws/quote`：可连通
  - `wss://xgvst.com/ws/quote`：当前不可连通（报错/404）

## 关键证据

### 1) h3 数据面证据
- 文件：`reports/lighthouse/P1.4_A/evidence/20260224-132552/xgvst-headers.txt`
- 关键字段：`alt-svc: h3=":443"; ma=86400`

### 2) TLS 1.3 数据面证据
- 文件：`reports/lighthouse/P1.4_A/evidence/xgvst-tls13-sclient.txt`
- 关键字段：`Protocol : TLSv1.3`

### 3) WebSocket 握手实测（Node WebSocket）
- 文件：`reports/lighthouse/P1.4_A/evidence/20260224-132552/ws-handshake-node-summary.json`
- 结果：
  - `wss://xgvst-workers.viehh642.workers.dev/ws/quote`：15/15 成功，p50=168ms，p95=234ms
  - `wss://xgvst.com/ws/quote`：0/15 成功

## 风险 / 阻塞
1. 虽然协议开关已在控制台处理，但自动化控制面 API 证据仍缺凭据：
   - `reports/lighthouse/P1.4_A/evidence/cf-env-check.txt` 显示 `CF_API_TOKEN_SET=0`、`CF_ZONE_ID_SET=0`
2. 生产域 `xgvst.com` 的 `/ws/quote` 仍未连通，说明 Pages 与 Workers 的 WS 路由尚未完全打通。

## 下一步（最短闭环）
1. 在 Cloudflare 路由层补齐 `xgvst.com/ws/*` 到 Workers（或在 Pages 层显式透传）。
2. 复测 `wss://xgvst.com/ws/quote`，目标：成功率>95%，并统计 p50/p95。
3. 进入 P1.4 DoD 第5项与第6项收口（0-RTT 命中率报告 + 移动端真实设备 h3 回退验证）。
