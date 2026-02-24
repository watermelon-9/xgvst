# P1.3 DoD1 延迟复验（2026-02-24 12:18）

- 目标口径：`https://xgvst-workers.viehh642.workers.dev/api/quote/mock`
- 采样次数：30
- 成功次数：29
- 结果：
  - min: 121.93ms
  - p50: 164.41ms
  - p95: 200.486ms
  - 阈值: <50ms
- 判定：**FAIL**

附加对照（15次快速采样）：
- `/health`：min 115.56ms / p50 139.71ms / p95 237.14ms
- `/api/quote/mock`：min 104.68ms / p50 137.20ms / p95 208.12ms

结论：当前 DoD1 的“<50ms”门槛仍未达成；该门槛与测试源地域/网络链路强相关，非仅业务逻辑耗时。
