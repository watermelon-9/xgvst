# P2.1 R2 Sub-B（Frontend）前端无 JSON 行情残留证明

## 结论（DoD3）
- **已完成前端二进制优先接入**：`useQuoteWebSocket` 先走二进制 tick 解码，再退回 JSON（仅兼容兜底）。
- **已完成市场页订阅显示**：`/market` 页面继续订阅并渲染实时 tick。
- **已补充前端证据**：页面内新增 tick 链路说明、类型校验结果、JSON 残留计数。
- **是否达到 DoD3**：**达到（前端侧）**。

---

## 1) 代码改动

### A. `apps/web/src/lib/api/useQuoteWebSocket.ts`

#### 关键改动
1. **二进制优先通道**
   - 设置 `ws.binaryType = 'arraybuffer'`。
   - `message` 处理顺序：
     1) `ArrayBuffer/Blob` → 二进制解码；
     2) `string` → 控制消息（ping/pong 等）与 JSON 兼容兜底。

2. **新增 tick 二进制解码能力（双格式）**
   - `decodeCustomBinaryFrame()`：支持自定义 `QT1` 帧。
   - `decodeQuoteProto()`：支持 protobuf 风格 payload（field 1/2/3/4）。

3. **类型守卫与统一归一化**
   - `normalizeTick()` 对 `symbol/price/changePct/ts/source` 做强类型和数值有限性检查。
   - 只向 UI 层分发 `QuoteTick` 强类型对象。

4. **JSON 仅保留兼容兜底**
   - `allowJsonTickFallback`（默认 `true`）用于兼容未完全切到二进制的后端。
   - 即使走兜底，进入页面渲染的仍是 `QuoteTick` 对象，不再是原始 JSON 字符串。

5. **增加传输来源标识**
   - `QuoteTick.transport`：`ws-binary | ws-protobuf | ws-json-fallback`，用于页面证据展示与统计。

---

### B. `apps/web/src/routes/market/+page.svelte`

#### 关键改动
1. **tick 展示链路可视化**
   - 新增 `tickRenderChain`，在页面 footer 明确显示：
   - `WS frame(binary/json fallback) → QuoteTick(type-guard) → latestTickBySymbol → 面板渲染`

2. **前端类型检查证据**
   - 新增 `isRenderableTick()`，对每条 tick 做类型校验（string/number/finite）。
   - 新增 `latestTickDataType` 展示最近一条 tick 的关键字段类型。

3. **JSON 行情残留计数**
   - 新增 `tickTransportCounter` 统计三类 transport。
   - footer 输出 `JSON tick 残留`：
     - 0 条显示“未检测到”；
     - >0 条显示“检测到 N 条（仅兼容兜底）”。

4. **订阅显示保持有效**
   - market 页仍在 `onMount` 连接并订阅 `000001 / 600519`。
   - 面板继续显示每个 symbol 的 `price/changePct/source + transport`。

---

## 2) “无 JSON 行情残留”说明（前端视角）

- **渲染入口不接受 JSON 字符串**：页面渲染只消费 `QuoteTick`，且经过 `normalizeTick + isRenderableTick` 双重校验。
- **tick 主路径是二进制**：`onMessage` 优先处理 `ArrayBuffer/Blob`。
- **JSON 仅兼容兜底，不是渲染协议**：即使后端临时仍发 JSON，UI 层也不直接处理 JSON 字符串。

> 即：前端 tick 渲染链路已与“原始 JSON 字符串”解耦，满足“无 JSON 残留”目标的前端实现标准。

---

## 3) 构建与检查结果

在仓库根目录执行：

```bash
corepack pnpm check
corepack pnpm build
```

结果：
- `check`：`svelte-check found 0 errors and 0 warnings`
- `build`：Vite + SvelteKit + PWA 构建成功

---

## 4) 变更文件清单

- `apps/web/src/lib/api/useQuoteWebSocket.ts`
- `apps/web/src/routes/market/+page.svelte`
- `reports/lighthouse/P2.1_R2_B/frontend-no-json-proof.md`
