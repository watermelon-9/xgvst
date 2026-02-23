# xgvst

西瓜说股 v3.0 monorepo。

## 目录结构

- `apps/`：应用层项目
- `packages/`：共享包与基础模块

## 开发

使用 pnpm workspace 管理多包结构。

## Agent 协作机制（已固化）

- 运行机制 / 交流协议 / 工作纪律：`team/AGENT_RUNTIME_CHARTER.md`
- 执行基线任务清单：`/Users/mac/.openclaw/workspace/西瓜说股_v3.0_详细任务安排_修订版_2026-02-23.md`
- 文件边界：与 v3 新项目相关的所有文件统一存放在 `xgvst/` 目录。
- 运行守护：`scripts/sentry_heartbeat.sh`（由 launchd 每 300 秒巡检一次）。
- 强制播报：任务发布/领取/完成/阻塞/心跳五类消息必须对用户可见（见 `team/AGENT_RUNTIME_CHARTER.md`）。
- 心跳主线：每次5分钟心跳需同步“当前主线任务”一句话。
