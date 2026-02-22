# 西瓜说股 v3 团队调度总纲（Main Agent）

> 项目根目录：`/Users/mac/.openclaw/workspace/xgvst`
> 隔离红线：严禁修改 v2.039 任何文件。

## 团队成员

- Sub-A（Infra Specialist）
- Sub-B（Frontend Architect）
- Sub-C（Performance Sentry）

## 主 Agent 调度循环

1. 从 v3 计划读取下一任务点（P1~P5）。
2. 任务原子化拆解（Task ID：P?.?）。
3. 派发到对应 Sub-agent。
4. 监工与审计（活跃度、质量门禁、红线拦截）。
5. DoD 验收通过后，更新战报并推进下一项。

## 红线门禁（必须）

- 动静分离：静态资源必须走 Pages，禁止走 Tunnel。
- 高频行情传输：生产禁 JSON，使用 Protobuf 二进制流。
- Vue 高频数据：必须 `shallowRef`，禁深响应式大数组。
- 渲染节奏：高频 UI 更新绑定 `requestAnimationFrame`。

## 任务看板模板

- [ ] P1.1 Vitesse 工程初始化
- [ ] P1.2 CF Pages 静态部署
- [ ] P1.3 Tunnel API 隧道打通
- [ ] P1.4 边缘协议优化
