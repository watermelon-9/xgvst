# P2.4 R5 Sub-B：DoD4 Web + PWA 秒级一致性复验

日期：2026-02-25  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

## 1) 本轮目标

按 R5 要求，针对“自选同步”做 Web/PWA（模拟双端）复跑，给出可复验证据：

- 写入端（Web）完成写入；
- 读取端（PWA）在另一会话可见；
- 记录 `写入 -> 另一端可见` 延迟；
- 输出日志 + 图像（截图化证据）+ JSON 原始样本。

---

## 2) 复验环境与口径

- Workers(local): `http://127.0.0.1:8791`
- Web(dev): `http://localhost:5175`（本轮用于本地联调可达性，核心时延证据以 API 双端会话仿真采集）
- DoD4 目标阈值：`p95 <= 1000ms`

双端仿真口径（可复验）：
- Web 端会话头：`x-session-id: web-write-*`
- PWA 端会话头：`x-session-id: pwa-read-*`
- 同一 `userId` 下，Web 先 `PUT` 写入 marker symbol，PWA 轮询 `GET` 直到读到 marker，记录耗时。

---

## 3) 执行与产物

### A. 基线复跑（含 sync 指标）

命令（已执行）：

```bash
P24_BASE_URL='http://127.0.0.1:8791' \
P24_OUT_DIR='reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency' \
P24_LOGIN_ITERATIONS=10 \
P24_MIGRATION_ITERATIONS=5 \
P24_SYNC_ITERATIONS=20 \
P24_SYNC_POLL_MS=50 \
node scripts/p24-auth-baseline.mjs
```

结果摘要（`p24-auth-baseline.json`）：
- login p95: **32.749ms**
- migration(200 symbols/user) p95: **18.186ms**
- sync p95: **6.853ms**（20/20 成功）

证据：
- `reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/p24-auth-baseline.json`
- `reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/p24-evidence-manifest.json`

### B. 聚焦 DoD4：Web 写入 -> PWA 可见延迟

命令（已执行）：

```bash
node scripts/p24-r5-web-pwa-consistency.mjs
```

额外执行了专项双端仿真（12 次）：
- 场景：`web-write-to-pwa-visible-latency`
- 成功率：**12/12**
- p50：**14.231ms**
- p95：**33.689ms**
- max：**33.689ms**
- 所有样本 `pollCount=1`（首次读即观察到新 marker）

证据：
- JSON：`reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/web-pwa-sync-latency.json`
- 样本 CSV：`reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/sync-latency-samples.csv`
- 图像：`reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/web-pwa-sync-latency-chart.png`

### C. 图像证据（截图化）

- `reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/web-pwa-sync-latency-chart.png`
- `reports/lighthouse/P2.4_B/raw/r5-web-pwa-consistency/sync-latency-chart.png`

> 图中红线为 DoD4 阈值 1000ms；全部样本远低于阈值。

---

## 4) 判定（DoD4）

- **DoD4（Web/PWA 自选同步秒级一致）: PASS**
- 依据：
  - 专项双端仿真 p95 = **33.689ms** << 1000ms
  - 成功率 100%（12/12）
  - 基线 sync 也为 100%（20/20），p95=6.853ms

---

## 5) 复验者备注

- 本次“PWA”采用独立会话模拟（`x-session-id` 区分读写端），符合任务说明“可模拟”。
- 证据已按可复验形式落盘：原始 JSON、逐次日志、CSV、图像。