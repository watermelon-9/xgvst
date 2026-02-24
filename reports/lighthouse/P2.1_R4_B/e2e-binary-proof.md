# P2.1 R4-B 服务端到前端 Binary 端到端证明

- 生成时间：2026-02-24T11:09:44.874Z
- WS 采样地址：`ws://localhost:8788/ws/quote`
- Status 地址：`http://localhost:8788/api/source/status`
- 订阅标的：000001, 600519

## 结论

- 服务端帧增量：binary **+4** / fallback **+0**
- 前端侧抓包：binary frames **4** / JSON tick frames **0**
- 前端解码：binary decoded ticks **4** / fallback decoded ticks **0**
- 判定：✅ 主路径为 binary，非 JSON 字符串依赖

## 证据链（server -> wire -> frontend decode）

- UI 同步项：market WS 面板新增 `binary frames vs fallback frames` 行，直接读取 `QuoteSocketStats.binaryFrames/fallbackFrames` 快照。

1. **server 计数（/api/source/status）**：记录 `wsFrameStats.sentBinaryFrames/sentFallbackFrames` 前后差值。
2. **wire 抓包（WS onmessage）**：按 `event.data` 类型统计 binary/string。
3. **frontend decode 等价验证**：按与 `useQuoteWebSocket` 同逻辑尝试 `QT1 -> protobuf` 解码并计数。

## 样本（binary frame head hex）

- bytes=60 | 51 54 31 06 30 30 30 30 30 31 3d 0a d7 a3 70 bd 25 40 0a d7 a3 70 3d 0a b7 bf 18 00 32 30 32 36 2d 30 32 2d 32 34 54 31 31 3a 30 39 3a 34 34 2e 39 31 31 5a 07 61 6c 6c 74 69 63 6b
- bytes=60 | 51 54 31 06 36 30 30 35 31 39 00 00 00 00 00 71 99 40 00 00 00 00 00 00 00 80 18 00 32 30 32 36 2d 30 32 2d 32 34 54 31 31 3a 30 39 3a 34 34 2e 39 31 38 5a 07 61 6c 6c 74 69 63 6b
- bytes=60 | 51 54 31 06 30 30 30 30 30 31 33 33 33 33 33 b3 25 40 ec 51 b8 1e 85 eb d1 bf 18 00 32 30 32 36 2d 30 32 2d 32 34 54 31 31 3a 30 39 3a 34 34 2e 39 31 38 5a 07 61 6c 6c 74 69 63 6b

## 备注

- 本报告由 `scripts/p21-e2e-binary-proof.mjs` 自动生成。
