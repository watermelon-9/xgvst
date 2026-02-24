# P2.3_C / R2 Sentinel：Storage Baseline 500 解阻与性能补证

- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 执行人：Sub-C（Sentinel）
- 时间：2026-02-25

---

## 第一段：500 阻塞根因定位（runtime / 接口 / 绑定）

### 结论
`p23-storage-baseline` 的 `HTTP 500` 根因是 **本地 wrangler/miniflare D1 runtime 聚合元数据异常**，不是 KV/D1 绑定缺失。

### 证据
在 `wrangler dev` 日志中稳定复现：

- 报错：`TypeError: Cannot read properties of undefined (reading 'duration')`
- 位置：`aggregateD1Meta (cloudflare-internal:d1-api:482:41)`
- 触发请求：`POST /api/debug/storage/bench`

绑定检查显示均已存在并本地可用：

- `env.QUOTE_KV`（local）
- `env.QUOTE_DB`（local）
- `env.QUOTE_DO`（local）

### 修复动作
对接口实现做兼容性修复，避免触发该 runtime 路径：

- 文件：`packages/workers/src/index.ts`
- 调整：将建表语句从 `c.env.QUOTE_DB.exec(...)` 改为 `c.env.QUOTE_DB.prepare(...).run()`

修复后同接口返回 `200`，`p23-storage-baseline` 脚本可正常产出样本。

---

## 第二段：D1/KV 读写延迟 Baseline（平均 / p95）与 Lighthouse 对比

### 执行命令

```bash
P23_STORAGE_BENCH_URL='http://127.0.0.1:8791/api/debug/storage/bench' \
corepack pnpm node scripts/p23-storage-baseline.mjs
```

### Storage 基线结果（30 iterations, valueSize=256）
来源：`reports/lighthouse/P2.3_C/raw/p23-storage-baseline.json`

| 指标 | 平均延迟 (meanMs) | p95 (p95Ms) |
|---|---:|---:|
| KV 写（put） | 0.4000 ms | 1 ms |
| KV 读（get） | 0.1667 ms | 1 ms |
| D1 读（SELECT） | 0.3333 ms | 1 ms |
| D1 写（INSERT/REPLACE） | 0.4667 ms | 1 ms |

### 与 Lighthouse 对比（同阶段证据）
来源：`reports/lighthouse/P2.3_C/raw/lighthouse/lh-median-20260225-021544-summary.json`

- Lighthouse median：`93`（scores: `83, 93, 100`，阈值 90，PASS）
- 对比结论：在 Storage 基线解阻并拿到 D1/KV 延迟证据后，未出现 Lighthouse 口径的负向迹象（仍处 PASS 区间）。

---

## 第三段：交付物更新

本轮已更新：

1. `packages/workers/src/index.ts`（storage bench 兼容性修复）
2. `reports/lighthouse/P2.3_C/raw/p23-storage-baseline.json`（500 -> 200 的新基线证据）
3. `reports/lighthouse/P2.3_C/r2-storage-unblock-and-baseline.md`（本报告）

---

## 第四段：风险、替代方案与结论

### 风险
- 当前根因属于本地 runtime 的 D1 元数据聚合异常路径；未来 wrangler/miniflare 升级后，`exec` 路径可能恢复正常。

### 可执行替代方案（已验证可用）
- 在压测/诊断接口中统一优先采用 `prepare(...).run()` 代替 `exec(...)`，规避本地 runtime 不稳定分支。

### 结论
- D1/KV baseline 的 500 阻塞已解除。
- D1/KV 读写延迟（平均 / p95）证据已补齐。
- Lighthouse 对比证据保持 PASS，可继续推进 P2.3 后续 A/B 与 DoD 复核。
