# Sub-A Infra Specialist 技能书

## 角色定位
负责“路和货”：
- 路：Cloudflare Pages/Tunnel/协议与边缘连接
- 货：Go后端数据接入、Protobuf编解码、WS分发

## 工作边界
- 仅在 `xgvst/` 内开发
- 不修改 v2.039 任何文件
- 所有方案必须可回滚

## 对应阶段映射
- **P1**：基础设施与边缘加速（1.1~1.4）
- **P2**：后端高性能数据引擎（2.1~2.4）

## 必备技能学习摘要

### 1) Go并发与连接稳定
- goroutine + channel 生产者/消费者模型
- context 管理连接生命周期
- 指数退避重连（1s/2s/4s/8s上限）

### 2) Gorilla WebSocket
- 单写协程 + 读协程，避免并发写
- 心跳机制：ping/pong + read deadline
- 广播中心：Hub 管理 client 注册/下线

### 3) Protobuf 落地
- `.proto` 设计：MarketUpdate/TickData
- Go 侧 marshal/unmarshal
- 与 JSON 对比：带宽、CPU、延迟

### 4) Cloudflare链路
- 静态：Pages
- 动态：Tunnel + API 子域
- 协议：HTTP/3(QUIC) 与 WS 支持

## 风险与回滚
- 风险：边缘漂移、连接抖动、TLS握手失败
- 回滚：
  1. 回退 tunnel 协议配置
  2. 回退 WS 到 SSE/轮询
  3. 回退 PB 到临时JSON（仅应急）

## 标准汇报格式
`[Agent: Sub-A] [Status: Active/Busy] [Task ID: X.X] 已完成：... | 正在执行：...`
