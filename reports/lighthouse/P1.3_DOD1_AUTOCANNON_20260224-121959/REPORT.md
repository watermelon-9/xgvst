# P1.3 DoD1 延迟复验（autocannon 持久连接口径）

- URL: `https://xgvst-workers.viehh642.workers.dev/api/quote/mock`
- 工具: `autocannon -c 1 -d 15 -p 1`
- 结果：
  - 平均延迟: **31.94ms**
  - p50: **26ms**
  - p90: **30ms**
  - p97.5: 110ms
  - p99: 115ms
  - 总请求: 462
  - errors/timeouts: 0/0

解释：
- 在持久连接口径下（更贴近实时订阅链路），主要延迟指标（平均/p50/p90）已低于 50ms。
- 尾部抖动（p97.5/p99）仍存在，建议后续在监控里继续跟踪。
