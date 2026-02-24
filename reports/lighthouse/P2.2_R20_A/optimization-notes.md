# P2.2 R20-A 最小可控优化说明（基于 R17V1）

## 目标
在不切版本、不做大改的前提下，针对恢复时延做小步高收益优化：
1. 连接并发节流参数更平滑（减少重连尾部抖动）。
2. 恢复首帧路径更快（优先发出首批可用数据）。
3. 保持 DoD5 主路径不回退（100ms + deflate）。

## 改动清单

### 1) Web 侧：重连节流增加二/三档快车道（小改动）
文件：`apps/web/src/lib/api/useQuoteWebSocket.ts`

- 新增常量：
  - `RECONNECT_SECOND_LANE_MS = 180`
  - `RECONNECT_THIRD_LANE_MS = 420`
- 在 `scheduleReconnect()` 中：
  - 第 1 次重连维持原 fast lane（40ms）
  - 第 2 次重连上限 180ms
  - 第 3 次重连上限 420ms

**意图**：将前 3 次重连延迟限制在可控区间，削减并发场景下“首轮后尾部长拖”问题，同时不改后续指数退避主策略。

---

### 2) Workers 侧：恢复首帧优先 + immediate 限额与恢复规模联动
文件：`packages/workers/src/durable/QuoteDO.ts`

#### 2.1 resync immediate 限额动态化
- `resync` 路径由固定 `snapshotImmediateSymbols` 改为：
  - `computeResyncImmediateLimit(symbolCount)`
  - 计算规则：`max(snapshotImmediateSymbols, ceil(symbolCount*0.25), 12)`，上限 24

**意图**：恢复规模变大时，首批 `immediateData` 同步放大，提升恢复“首屏可见”速度。

#### 2.2 优先使用 pending 快照
- `buildSnapshotPlan()` 内存快照来源由：
  - 仅 `latestTickBySymbol`
  - 改为 `pendingBySymbol ?? latestTickBySymbol`

**意图**：优先发送“尚未 flush 但更新”的最新数据，减少恢复时拿到旧 tick 的概率。

#### 2.3 恢复发送路径首帧前置
- `sendSnapshotTicks()`：
  - 去掉恢复路径的额外排序（避免首帧前 CPU 排序开销）
  - `bundle` 模式先发首批 chunk（`max(8, snapshotImmediateSymbols)`）
  - 其余批次沿用现有背压/动态批次策略

**意图**：把“第一帧到达时间”从整批处理前移到最早可发送时刻，减少恢复感知时延。

## DoD5 主路径确认（未回退）
- `batchFlushMs` 默认仍为 **100ms**（未改）。
- `normalizeCompression()` 默认仍返回 **deflate**（未改）。
- 未引入会绕开 bundle+deflate 主路径的新分支。

## 校验结果
- `corepack pnpm --filter workers check` ✅
- `corepack pnpm --filter web check` ✅

## 风险与回滚面
- 改动仅集中在 `useQuoteWebSocket.ts` 与 `QuoteDO.ts`，无协议大改。
- 均为参数/顺序/优先级级别优化，可快速回滚。
