# P2.3_B R2 Frontend E2E Protobuf 证据补齐与 JSON fallback 收敛

日期：2026-02-25  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 1) 详细步骤（按任务书）

### Step 1. 复核 quoteCodec / useQuoteWebSocket / quoteStore / 页面消费一致性

复核文件：
- `apps/web/src/lib/api/quoteCodec.ts`
- `apps/web/src/lib/api/useQuoteWebSocket.ts`
- `apps/web/src/lib/runes/quote-store.svelte.ts`
- `apps/web/src/routes/market/+page.svelte`

复核要点：
- `decodeQuote` 作为统一类型出口（`symbol/price/changePct/ts/source`）。
- `useQuoteWebSocket` 二进制路径（protobuf/legacy）统一经 `decodeQuote` 进入下游。
- `quoteStore` 统一消费 `QuoteTick`，并以 `isQuoteTickViewConsistent` 做视图一致性门禁。
- 页面 footer 显示链路、类型签名一致性、JSON fallback 状态与残留计数。

代码证据：
- `reports/lighthouse/P2.3_B/evidence/r2-frontend-e2e-proto/code-path-audit.log`

### Step 2. 补齐前端 E2E 截图与日志证据

本地联调：
- Workers：`wrangler dev --local --port 8787`
- Web：`PUBLIC_WORKER_API_URL=http://127.0.0.1:8787 pnpm --filter web dev --host 127.0.0.1 --port 4173`

E2E 证据（默认关闭 fallback）：
- 截图：`reports/lighthouse/P2.3_B/evidence/r2-frontend-e2e-proto/e2e-protobuf-default-off.jpg`
- DOM快照：`reports/lighthouse/P2.3_B/evidence/r2-frontend-e2e-proto/e2e-snapshot-default-off.json`
  - `连接状态 open`
  - `binary frames vs fallback frames 186 vs 0`
  - `protobuf decode success 186`
  - `JSON fallback 开关：关闭（默认）`
  - `JSON tick 残留：未检测到`

E2E 证据（调试开启 fallback）：
- 截图：`reports/lighthouse/P2.3_B/evidence/r2-frontend-e2e-proto/e2e-protobuf-debug-fallback-on.jpg`
- DOM快照：`reports/lighthouse/P2.3_B/evidence/r2-frontend-e2e-proto/e2e-snapshot-debug-fallback-on.json`
  - `连接状态 open`
  - `protobuf decode success 513`
  - `JSON fallback 开关：开启（调试）`
  - `JSON tick 残留：检测到 3 条（仅兼容兜底）`

服务端握手证据：
- `reports/lighthouse/P2.3_B/evidence/r2-frontend-e2e-proto/workers-ws-log-excerpt.log`
  - 含 `GET /ws/quote 101 Switching Protocols`

补充预检日志（非最终失败）：
- `reports/lighthouse/P2.3_B/evidence/r2-frontend-e2e-proto/browser-console-precheck.log`

### Step 3. 在不破坏现有行为前提下收敛 JSON fallback（默认关闭，调试可控）

本轮新增“调试可控”能力，不改变默认行为：
- 默认仍为关闭：`quoteJsonFallback=0` / 未配置。
- 可通过调试参数开启：`?quoteJsonFallback=1`。
- 可通过调试参数覆写 WS 地址用于本地联调：`?quoteWsUrl=ws://127.0.0.1:8787/ws/quote`。

落地点：
- `apps/web/src/lib/runes/quote-store.svelte.ts`
  - 新增 `resolveJsonTickFallbackEnabled()`
  - 新增 `resolveQuoteWsUrl()`
  - 新增 store 字段：`jsonTickFallbackEnabled`、`quoteWsUrl`
- `apps/web/src/routes/market/+page.svelte`
  - footer 增加 `WS URL` 可视化，便于 e2e 取证。

### Step 4. 验证与产物归档

编译与类型检查：
- `reports/lighthouse/P2.3_B/evidence/r2-frontend-e2e-proto/pnpm-web-check.log`
- `reports/lighthouse/P2.3_B/evidence/r2-frontend-e2e-proto/pnpm-web-build.log`

结论：`check/build` 均通过，且 E2E 显示 protobuf 主链路稳定生效。

---

## 2) 注意事项

1. `resync_ack / ping` 控制消息仍是 JSON 协议，不应误删。  
2. 本轮只收敛“tick 进入渲染链路”的 JSON fallback；默认关闭保持不变。  
3. 调试参数仅用于联调与取证，线上默认路径仍是二进制/protobuf。  
4. 通过 `quoteWsUrl` 仅影响客户端连接目标，不改变后端协议与订阅语义。

---

## 3) 工作安排（R2 Sub-B 实绩）

- [x] 复核 quoteCodec / useQuoteWebSocket / quoteStore / 页面一致性
- [x] 补齐默认关闭与调试开启两套 E2E 截图与日志证据
- [x] 收敛 JSON fallback：默认关闭 + 调试可控（query/localStorage）
- [x] 输出 R2 报告与证据索引
- [x] 完成 `pnpm --filter web check/build` 验证

---

## 4) DoD 映射（含证据路径）

### DoD-1：前端端到端 protobuf 证据补齐
- 证据：
  - `.../e2e-protobuf-default-off.jpg`
  - `.../e2e-snapshot-default-off.json`
  - `.../workers-ws-log-excerpt.log`
- 判定：**通过**（open + 101 + protobuf decode success 持续增长）

### DoD-2：quoteCodec/useQuoteWebSocket/quoteStore 页面消费一致性复核
- 证据：
  - `.../code-path-audit.log`
  - `apps/web/src/lib/api/quoteCodec.ts`
  - `apps/web/src/lib/api/useQuoteWebSocket.ts`
  - `apps/web/src/lib/runes/quote-store.svelte.ts`
  - `apps/web/src/routes/market/+page.svelte`
- 判定：**通过**（统一 decode + 类型签名校验 + 页面可视化一致）

### DoD-3：JSON fallback 进一步收敛（默认关闭，调试可控）
- 证据：
  - 默认关闭快照：`.../e2e-snapshot-default-off.json`（JSON tick 残留未检测）
  - 调试开启快照：`.../e2e-snapshot-debug-fallback-on.json`（可控开启后有计数）
- 判定：**通过**

### DoD-4：报告输出到指定路径
- 证据：`reports/lighthouse/P2.3_B/r2-frontend-e2e-proto.md`
- 判定：**通过**
