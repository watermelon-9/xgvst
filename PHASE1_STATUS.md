# xgvst v3 执行状态（Phase 1）

## 当前阶段
- P1.1 Vitesse 工程初始化：**已完成**
- P1.2 Cloudflare Pages 静态部署：**已完成**
- P1.3 API Tunnel 联通：**进行中（核心链路已打通，等待你最终验收）**

## P1.2 完成证据
- 生产站点：`https://xgvst-web.pages.dev`
- 预览站点：`https://develop.xgvst-web.pages.dev`
- Brotli 生效：`content-encoding: br`
- 首屏体验：用户手机 5G 反馈“几乎秒开，白屏 < 0.6s”

## P1.3 已完成
- [x] 新建并启动 API 隧道：`xgvst-api`（Cloudflare Tunnel）
- [x] Public Hostname 绑定：`api.xgvst.com`
- [x] 本地 Go/Gin 服务启动并由 launchd 保活：`com.xgvst.api.server`
- [x] API 隧道守护进程保活：`com.xgvst.api.cloudflared`
- [x] 后端健康接口：`GET /v3/health` -> `{"status":"ok","version":"v3.0.0","tunnel":"Cloudflare"}`
- [x] 前端环境变量接入：
  - `.env.production` -> `https://api.xgvst.com` / `wss://api.xgvst.com/ws`
  - `.env.development` -> 本地 `127.0.0.1:8080`
- [x] API 客户端封装：`src/api/client.ts`（fetch + timeout）
- [x] 首页状态灯对接 `/v3/health` 联通检测
- [x] 回归门禁：`pnpm build` 前执行 `scripts/check-env.mjs`（变量缺失即失败）

## Sub-C 审计摘要（P1.3）
- API 连通性：`https://api.xgvst.com/v3/health` 返回 200
- 证书：Cloudflare 边缘证书链有效（见审计报告）
- 延迟抽样（本地到公网 API，HTTP/1.1）：
  - 15 次中 14 次成功（1 次 TLS 瞬时失败）
  - 成功样本平均 TTFB ≈ `0.179s`（p50≈0.166s，p95≈0.256s）
- 断连演练：停掉 tunnel 后返回 530，恢复后回到 200

## 待你确认
1. 你侧手机访问：`https://api.xgvst.com/v3/health`
2. 你确认 P1.3 通过后，我进入 P1.4（边缘协议与稳定性优化）。
