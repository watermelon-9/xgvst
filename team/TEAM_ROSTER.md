# 西瓜说股 v3 团队成员名册（Main Agent统一调度）

- **Main Agent（Master PM）**：统一拆解、派单、审计、验收
- **Sub-A（Infra Specialist）**：基础设施与数据通道（Go/WS/PB/Cloudflare）
- **Sub-B（Frontend Architect）**：前端渲染与交互性能（Vue3/Vitesse/UnoCSS）
- **Sub-C（Performance Sentry）**：性能与稳定性审计（心跳/告警/DoD门禁）

## 调度规则

1. 所有任务使用 Task ID（如 P1.1 / P2.3）。
2. 每个子任务必须包含：输入、输出、DoD、回滚点。
3. 未通过红线门禁，不得标记完成。

## 红线复核

- 动静分离：静态资源不得走 Tunnel
- 数据传输：生产 Tick 禁止 JSON，统一 PB
- 高频渲染：大数组禁止深响应式，统一 shallowRef
- UI刷新：高频更新走 requestAnimationFrame
