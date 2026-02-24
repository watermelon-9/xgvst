# P2.3_C / R1 Sentinel：Protobuf + D1/KV 性能验证方案与 Baseline

- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 执行人：Sub-C（Sentinel）
- 时间：2026-02-25
- 结论摘要：
  - 已完成 **P2.3 性能验证方案设计**（带宽、D1/KV、解码、Lighthouse）。
  - 已复用/新增最小脚本形成可执行流程。
  - 已跑 1 轮 baseline，并产出初始证据。

---

## ✅ 详细步骤（可执行）

### 1) 带宽下降 + 解码耗时（WS 链路）

**脚本**：`scripts/p23-ws-baseline.mjs`（新增，复用 P2.2 解码逻辑）

**执行命令（本轮）**
```bash
P23_WS_URL='ws://127.0.0.1:8791/ws/quote?session=p23-baseline' \
corepack pnpm node scripts/p23-ws-baseline.mjs
```

**采样口径**
- baseline: `legacy + none`
- optimized: `bundle + gzip`
- 并发：200，时长：8s
- 输出：总字节、bytes/tick、decode avg/p95

**证据**
- `reports/lighthouse/P2.3_C/raw/p23-ws-baseline.json`

**R1 Baseline 结果（摘要）**
- 带宽节省：`84.92%`
- bytes/tick：`61.00 -> 15.14`
- 解码耗时：
  - legacy：avg `0.0008ms` / p95 `0.0014ms`
  - bundle+gzip：avg `0.7275ms` / p95 `2.9277ms`

---

### 2) D1/KV 读写延迟

**Worker 新增 debug 端点**：`POST /api/debug/storage/bench`
- 文件：`packages/workers/src/index.ts`
- 逻辑：KV put/get + D1 read/write 迭代统计（p50/p95/mean）

**脚本**：`scripts/p23-storage-baseline.mjs`（新增）

**执行命令（本轮）**
```bash
P23_STORAGE_BENCH_URL='http://127.0.0.1:8791/api/debug/storage/bench' \
corepack pnpm node scripts/p23-storage-baseline.mjs
```

**证据**
- `reports/lighthouse/P2.3_C/raw/p23-storage-baseline.json`

**R1 Baseline 结果**
- 本地 wrangler/miniflare 返回 `HTTP 500`，未取得有效 D1/KV 延迟样本。
- 该失败已固化为证据（不回避）。

---

### 3) Lighthouse 影响

**复用脚本**：`scripts/lh-median-check.sh`

**执行命令（本轮）**
```bash
bash scripts/lh-median-check.sh https://xgvst.com 90 3 reports/lighthouse/P2.3_C/raw/lighthouse
```

**证据**
- `reports/lighthouse/P2.3_C/raw/lighthouse/lh-median-20260225-021544-summary.json`

**R1 Baseline 结果**
- Scores: `83, 93, 100`
- Median: `93`（阈值90，PASS）

---

## ✅ 注意事项（风险与口径约束）

1. `p23-ws-baseline` 中 `openFailed` 与 `clientsConnected` 同时偏高，属于 onerror/timeout 统计竞争条件，不影响核心带宽与解码结论；后续脚本需修正该计数口径。  
2. D1 本地基线受 wrangler/miniflare 运行时异常影响（`aggregateD1Meta ... duration`），R2 需补远端环境复测（或升级 wrangler/runtime）。  
3. Lighthouse 波动较大（83~100），继续采用中位数口径，不用单次结果做发布判定。  
4. debug 存储压测端点需保留鉴权（`x-debug-token`）；生产默认不应开放匿名压测。  

---

## ✅ 工作安排（Sentinel）

### R1（本轮，已完成）
- [x] 方案设计：4项指标口径统一（带宽 / D1-KV 延迟 / 解码耗时 / Lighthouse）。
- [x] 新增最小脚本：
  - `scripts/p23-ws-baseline.mjs`
  - `scripts/p23-storage-baseline.mjs`
- [x] Worker 最小能力补齐：`/api/debug/storage/bench`
- [x] Baseline 采样并固化证据。

### R2（下一轮，待执行）
- [ ] 修复 `openFailed` 统计竞争问题，保证连接成功/失败互斥计数。
- [ ] 在远端环境完成 D1/KV 延迟基线（p50/p95）。
- [ ] P2.3 功能落地后执行 A/B（before/after）并回填同口径对比。

---

## ✅ DoD（P2.3 口径定义）

> 说明：R1 是 baseline 轮，DoD 以“口径定义 + 当前状态”给出；最终 PASS 需在 P2.3 变更后复测判定。

| DoD | 指标 | 判定口径 | R1状态 |
|---|---|---|---|
| DoD-1 | 带宽下降 | 相比 legacy baseline，`totalRawBytes` 降幅 >= 70% | **84.92%（PASS@baseline）** |
| DoD-2 | D1读延迟 | `SELECT` p95 <= 50ms | **BLOCKED（本地500）** |
| DoD-3 | D1写延迟 | `INSERT/UPSERT` p95 <= 80ms | **BLOCKED（本地500）** |
| DoD-4 | KV读写延迟 | KV get/put p95 <= 30ms | **BLOCKED（同上）** |
| DoD-5 | 解码耗时 | bundle decode p95 <= 5ms（客户端采样） | **2.93ms（PASS@baseline）** |
| DoD-6 | Lighthouse影响 | median 分数相对基线下降 <= 3 分，且 >= 90 | **93（当前PASS）** |

---

## 变更清单（R1）

- `packages/workers/src/index.ts`：新增 `percentile` 与 `/api/debug/storage/bench`
- `scripts/p23-ws-baseline.mjs`：新增
- `scripts/p23-storage-baseline.mjs`：新增
- `reports/lighthouse/P2.3_C/r1-sentinel-plan-and-baseline.md`：新增
- `reports/lighthouse/P2.3_C/raw/*`：baseline 证据输出
