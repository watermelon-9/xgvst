# P2.2_A Durable Objects 订阅基础设施落地证据

## 本轮完成项

- `packages/workers/src/durable/QuoteDO.ts`
  - 实现 DO 内 websocket 连接管理
  - `subscribe/unsubscribe`（内存态订阅表）
  - 100ms 合包广播骨架（`pendingBySymbol` + `flushBatch`）
  - 心跳与断线清理（close/error/timeout 统一回收）
- `packages/workers/src/durable/QuoteDurableObject.ts`
  - 对齐为 `QuoteDO` 导出别名，兼容现有 class_name
- `/ws/quote` 路由改为通过 `env.QUOTE_DO.get(id).fetch('/ws')` 转发
  - 增加会话维度路由键：`session` query / Access email / `x-session-id`
- 新增 `/api/do/metrics` 用于验证 DO 路由链路与聚合广播统计
- `wrangler.toml` 校核：`durable_objects.bindings` + `migrations` 已存在并匹配 `QUOTE_DO` / `QuoteDurableObject`

## 压测脚本与样本

- 脚本：`scripts/p22-do-min-load.mjs`
- 最小并发样本：40 WS 客户端，持续 8s，同会话聚合订阅
- 日志与产物：
  - `01-workers-check.log`
  - `02-workers-deploy.log`
  - `03-do-min-load.log`
  - `p22-do-min-load-latest.json`

## 关键样本结果（latest）

- opened: 39/40
- errors: 1
- binaryFrames: 1249
- DO metrics:
  - `flushCount: 33`
  - `sentBinaryFrames: 1249`
  - `batchFlushMs: 100`
  - 测试结束后 `clients: 0` / `subscriptions: 0`（断线清理生效）

## workers check/deploy

- `corepack pnpm --filter workers check` ✅
- `corepack pnpm --filter workers run deploy` ✅
- 当前版本：`ad8c87f6-f884-471b-a878-226ee42da582`
- Worker URL：`https://xgvst-workers.viehh642.workers.dev`
