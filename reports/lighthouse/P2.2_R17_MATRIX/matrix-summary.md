# P2.2 R17 单变量压测矩阵（连接并发节流参数）

- 变量：`CONNECT_BATCH_GAP_MS`
- 固定：`CONNECT_BATCH_SIZE=80`，`CONCURRENCY=1000`，`RECONNECT_RATIO=0.6`

| gap(ms) | reconnect p50/p95 | recovery p50/p95 | success(reconnect/recovery) |
|---:|---:|---:|---:|
| 20 | 318/416 | 444/556 | 100%/100% |
| 40 | 213/308 | 353/448 | 100%/100% |
| 80 | 274/481 | 409/611 | 100%/100% |
| 120 | 261/365 | 395/508 | 100%/100% |
| 160 | 304/420 | 439/550 | 100%/100% |

**最优点（按 recovery p95 最小）**：gap=40ms，recovery=353/448ms，reconnect=213/308ms。
DoD4 严格判定：FAIL；特批判定：FAIL。