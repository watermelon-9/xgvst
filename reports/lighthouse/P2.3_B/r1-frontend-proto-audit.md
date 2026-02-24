# P2.3_B R1 Frontend Protobuf 解码链路审计（Sub-B）

日期：2026-02-25  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 0) 结论先行

- 前端行情主链路已是 **二进制帧 → Protobuf/legacy 二进制解码 → 强类型 QuoteTick → store/page**。
- 发现 1 处 JSON 残留入口：`resync_ack.immediateData` 在 `allowJsonTickFallback=false` 时仍可进入渲染链路。
- 已做最小改动修复：将该入口与 `tick` JSON 入口统一受 `allowJsonTickFallback` 开关控制。
- 已新增 `decodeQuote` 类型层并接入：`useQuoteWebSocket + quoteStore + market 页面` 一致使用同一类型签名校验。
- `pnpm --filter web check` / `pnpm --filter web build` 均通过。

---

## 1) ✅详细步骤

### Step 1. 审计 `$lib/api` 与 `store` 行情消费链路

审计范围：
- `apps/web/src/lib/api/useQuoteWebSocket.ts`
- `apps/web/src/lib/runes/quote-store.svelte.ts`
- `apps/web/src/routes/market/+page.svelte`
- `apps/web/src/lib/api/index.ts`

审计结果：
1. WS 二进制消费存在：`ArrayBuffer/Blob` 分支优先处理，支持 protobuf + legacy binary。
2. store 页面消费存在：`quoteStore.latestTickBySymbol` 驱动市场页渲染。
3. JSON 残留点确认：
   - 控制消息必须 `JSON.parse`（`ping/resync_ack` 等）——保留。
   - 行情残留：`resync_ack.immediateData` 无条件尝试按 tick 渲染（问题点）。

### Step 2. 设计最小改动方案（不破坏稳定性）

方案原则：
- 不改 WS 协议，不改页面订阅逻辑，不改 API provider。
- 只对“行情 JSON 进入渲染链路”的入口做收敛。
- 抽一层可复用 `decodeQuote`，消除重复类型守卫逻辑。

### Step 3. 落地实现

#### 3.1 新增类型/解码层
新增文件：`apps/web/src/lib/api/quoteCodec.ts`
- `QuoteTick` / `QuoteTransport`
- `decodeQuote(value, transport)`：统一校验字段类型与 finite
- `EXPECTED_QUOTE_TICK_TYPE_SIGNATURE`
- `getQuoteTickTypeSignature`
- `isQuoteTickViewConsistent`

#### 3.2 WS 解码链路收敛
修改：`apps/web/src/lib/api/useQuoteWebSocket.ts`
- 二进制 protobuf/legacy 统一通过 `decodeQuote` 出口。
- `resync_ack.immediateData` 增加 `allowJsonTickFallback` 门禁。
- JSON `tick` 分支改用 `decodeQuote`（兼容模式时才生效）。

#### 3.3 store 与页面一致性检查
修改：`apps/web/src/lib/runes/quote-store.svelte.ts`
- 移除本地重复 `isRenderableTick`。
- 使用 `isQuoteTickViewConsistent` + `getQuoteTickTypeSignature`。
- 新增状态：
  - `latestTickTypeExpected`
  - `latestTickTypeConsistent`

修改：`apps/web/src/routes/market/+page.svelte`
- 页脚增加“实际类型/期望类型 + ✅/❌”可视化一致性结果。

#### 3.4 导出整理
修改：`apps/web/src/lib/api/index.ts`
- 对外导出 `QuoteTick/QuoteTransport` 与 codec 方法，统一引用入口。

### Step 4. 验证

执行：
- `corepack pnpm --filter web check`
- `corepack pnpm --filter web build`

结果：均通过（0 error / build success）。

---

## 2) ✅注意事项

1. **控制消息 JSON 不能一刀切删除**：`resync_ack/ping` 仍需 JSON 解析。此次只清理“行情对象 JSON 直入渲染”的残留。  
2. **兼容开关仍保留**：`allowJsonTickFallback` 仍可用于灰度/回滚；默认 `false` 不变。  
3. **最小变更范围**：未改订阅策略、重连策略、页面数据结构，避免引入 P2.2 稳定性回归。  
4. **类型签名检查仅做前端消费一致性门禁**：`number/number/string`，不与后端业务值域规则耦合。  

---

## 3) ✅工作安排（本轮 Sub-B）

- [x] A1 审计并清点 JSON 残留（API + store + page）
- [x] A2 设计并落地最小改动修复（仅行情 JSON 入口）
- [x] A3 实现 decodeQuote/类型层统一
- [x] A4 实现页面消费一致性检查（可视化）
- [x] A5 输出报告并完成 check/build 验证

建议下一步（给主线）：
- 与 Sub-A 对齐 `resync_ack.immediateData` 在服务端的发送策略，逐步退场 JSON fallback。

---

## 4) ✅DoD 映射

### DoD-1：前端 `$lib/api` 与 store 的 protobuf 解码链路审计完成
- 证据：本报告第 1 节 Step1 + 文件审计清单。
- 状态：**已完成**。

### DoD-2：JSON 残留清点并最小改动消除（不破坏稳定性）
- 证据：`useQuoteWebSocket.ts` 对 `resync_ack.immediateData` 加 `allowJsonTickFallback` 门禁。
- 稳定性证据：`pnpm check/build` 通过。
- 状态：**已完成**。

### DoD-3：decodeQuote/类型层与页面消费一致性检查实现
- 证据：新增 `quoteCodec.ts`，store+page 接入，显示 expected/actual + ✅/❌。
- 状态：**已完成**。

### DoD-4：报告输出到指定路径
- 证据：`reports/lighthouse/P2.3_B/r1-frontend-proto-audit.md`
- 状态：**已完成**。

### DoD-5：提交 commit
- 证据：见本轮 commit（Sub-B 前端改动）。
- 状态：**已完成**。

---

## 5) 本轮变更文件

- `apps/web/src/lib/api/quoteCodec.ts` (new)
- `apps/web/src/lib/api/useQuoteWebSocket.ts`
- `apps/web/src/lib/runes/quote-store.svelte.ts`
- `apps/web/src/lib/api/index.ts`
- `apps/web/src/routes/market/+page.svelte`
- `reports/lighthouse/P2.3_B/r1-frontend-proto-audit.md` (new)
