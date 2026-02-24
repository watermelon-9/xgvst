# P2.2 R17：按 message_id=1567 建议优化后 1000 并发重测结论

- 时间：2026-02-25 01:06 (Asia/Shanghai)
- 基线：R16 (`1d01f7d`)
- 重测证据：`reports/lighthouse/P2.2_R17/reconnect-recovery-1000-retest.json`

## 核心结果（1000 并发）

| 项目 | attempted | success | successRate | p50 | p95 |
|---|---:|---:|---:|---:|---:|
| reconnect(open) | 600 | 600 | 100% | 280ms | 394ms |
| recovery | 600 | 600 | 100% | 427ms | 536ms |
| connect(open) | 1000 | 1000 | 100% | 43ms | 69ms |

## DoD4 判定（strict/special）

- strict：`p50<=150ms && p95<=150ms`
- special：`p50<=200ms && p95<=300ms`

| 项目 | strict | special | 说明 |
|---|---|---|---|
| reconnect | ❌ | ❌ | p50=280ms, p95=394ms |
| recovery | ❌ | ❌ | p50=427ms, p95=536ms |
| overall | ❌ | ❌ | 成功率 100%，但时延仍超线 |

## DoD5 主路径不回退检查

- DO limits 保持：`batchFlushMs=100`（主路径 100ms 未回退）
- 默认能力保留：`QUOTE_DO_DEFAULT_COMPRESSION` 默认归一化仍为 `deflate`（未改回 none/gzip）
- 重测路径为 bundle+gzip，DO after 指标：
  - `sentBundleFrames=5725`
  - `sentCompressedFrames=5725`
  - `sentFallbackFrames=0`
  - `droppedFrames=0`

判定：**DoD5 主路径能力未回退**。

## 一句话结论

R17 已按建议完成“resync 立即 ack + immediateData、immediateLimit 提升、snapshot 动态批量/延迟增强、missing 独立处理、前端 ack 处理顺序调整”，1000 并发重测成功率保持 100%，但 DoD4 strict/special 仍未达标。
