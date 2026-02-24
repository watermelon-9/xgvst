# P2.2 R6-A DoD3 Protobuf 下发验证

- 结果：✅ 达标
- 时间：2026-02-24T14:22:17.963Z
- WS：`wss://xgvst.com/ws/quote?session=p22-r6-a`
- DO Metrics：`https://xgvst-workers.viehh642.workers.dev/api/do/metrics?session=p22-r6-a`

## 关键指标

- DO 计数增量：
  - sentBinaryFrames: **+80**
  - sentProtobufFrames: **+80**
  - sentFallbackFrames: **+0**
- 抓包计数：
  - binaryFrames: **80**
  - protobufFrames: **80**
  - qt1FallbackFrames: **0**
  - jsonFallbackFrames: **0**
  - decodeFailedFrames: **0**

## 判定规则

1. binaryFrames > 0
2. protobufFrames > 0
3. qt1FallbackFrames == 0
4. jsonFallbackFrames == 0
5. DO sentProtobufFrames 增量 > 0

