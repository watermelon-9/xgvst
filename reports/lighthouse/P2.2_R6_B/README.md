# P2.2 R6 Sub-B (Frontend) 证据

## 变更目标
- 前端 WS 二进制主路径改为 **protobuf 解码优先**。
- 保持 `binaryType = 'arraybuffer'`。
- 暴露并展示 `protobuf decode success` 计数（日志 + UI）。
- 旧 binary 帧保留为兜底，不影响主路径。

## 关键变更文件
- `apps/web/src/lib/api/proto/quote.ts`
  - 新增最小可维护 `decodeQuotePayload()`（不走 JSON）。
- `apps/web/src/lib/api/useQuoteWebSocket.ts`
  - 二进制解码顺序：`protobuf -> legacy-binary fallback`。
  - 增加 `QuoteSocketStats.protobufDecodeSuccess`。
  - 每次 protobuf 解码成功打印：`[ws] protobuf decode success: <count>`。
  - 维持 `ws.binaryType = 'arraybuffer'`。
- `apps/web/src/lib/runes/quote-store.svelte.ts`
  - 增加 `socketStats.protobufDecodeSuccess` 状态字段。
- `apps/web/src/routes/market/+page.svelte`
  - UI 新增 `protobuf decode success` 计数展示。

## 校验命令与日志
- `corepack pnpm check`
  - 日志：`reports/lighthouse/P2.2_R6_B/pnpm-check.log`
  - 结果：0 errors / 0 warnings
- `corepack pnpm build`
  - 日志：`reports/lighthouse/P2.2_R6_B/pnpm-build.log`
  - 结果：build success
