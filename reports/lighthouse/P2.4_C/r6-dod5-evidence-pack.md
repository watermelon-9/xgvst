# P2.4 R6 Sub-C：DoD5 证据包（登录 <800ms、迁移 <3s、Lighthouse 无新下降）

- 产出时间：2026-02-25（Asia/Shanghai）
- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 判定口径：**严格验收（仅按已落盘证据；三项子条件全部满足才判 PASS）**

---

## 1) 登录/迁移时延复核与固化

### 1.1 复核执行与产物

执行命令：

```bash
P24_BASE_URL=http://127.0.0.1:8787 corepack pnpm workers:p24-auth-baseline
```

核心产物（本次重跑）：

- `reports/lighthouse/P2.4_C/raw/p24-auth-baseline.json`
- `reports/lighthouse/P2.4_C/raw/p24-evidence-manifest.json`
- `reports/lighthouse/P2.4_C/raw/auth/login-latency-2026-02-24T19-45-35-670Z.json`
- `reports/lighthouse/P2.4_C/raw/migration/migration-latency-2026-02-24T19-45-35-670Z.json`
- `reports/lighthouse/P2.4_C/raw/sync/sync-latency-2026-02-24T19-45-35-670Z.json`
- `reports/lighthouse/P2.4_C/raw/logs/wrangler-tail-2026-02-24T19-45-35-670Z.log`

### 1.2 登录 KPI 严格判定（目标：<800ms）

来自 `p24-auth-baseline.json`：

- iterations: `30`
- success: `30/30`（100%）
- p95: `2.932ms`
- p50: `1.845ms`
- max: `25.913ms`

**判定：PASS**（`2.932ms < 800ms`，且成功率 100%）

### 1.3 迁移 KPI 严格判定（目标：单用户 <3s）

来自 `p24-auth-baseline.json` + `migration-latency-*.json`：

- iterations: `10`
- success: `10/10`（100%）
- symbolCountPerUser: `200`
- p95: `17.584ms`
- p50: `14.216ms`
- 每个样本均满足 `importedCount == expectedCount == 200`

补充远端迁移执行证据（沿用已验收链路）：

- `reports/lighthouse/P2.4_C/raw/migration/r4-remote-2026-02-24T19-26-35Z/01-remote-migration-execute.txt`
- `reports/lighthouse/P2.4_C/raw/migration/r4-remote-2026-02-24T19-26-35Z/02-remote-index-users.txt`
- `reports/lighthouse/P2.4_C/raw/migration/r4-remote-2026-02-24T19-26-35Z/03-remote-index-self_selects.txt`
- `reports/lighthouse/P2.4_C/raw/migration/r4-remote-2026-02-24T19-26-35Z/04-remote-index-quote_history.txt`

**判定：PASS**（`17.584ms < 3000ms`，且导入正确性 100%）

---

## 2) Lighthouse 对比补齐与“无新下降”严格判定

### 2.1 对比基线与本次采样

基线（上轮已落盘）：

- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-summary.json`
- baseline score：
  - mobile/home = 100
  - mobile/market = 99
  - desktop/home = 100
  - desktop/market = 100（由该批次 run 结果固定）

本次采样原始文件：

- Mobile（2 次）：`reports/lighthouse/P2.4_C/raw/r6-lh-guard-20260225-034613/*`
- Desktop（2 次）：`reports/lighthouse/P2.4_C/raw/r6-lh-desktop-smoke-20260225-034901/*`

本次汇总：

- `reports/lighthouse/P2.4_C/raw/r6-lighthouse-compare-summary.json`

### 2.2 严格规则

`noNewRegression == true` 当且仅当：

- 对每个场景（mobile/desktop × home/market），`当前 median(score) >= baseline(score)`。
- 任一场景 `delta < 0` 则判 FAIL。

### 2.3 对比结果

- mobile/home: 当前中位数 `100` vs 基线 `100`，delta `0`
- mobile/market: 当前中位数 `99` vs 基线 `99`，delta `0`
- desktop/home: 当前中位数 `100` vs 基线 `100`，delta `0`
- desktop/market: 当前中位数 `100` vs 基线 `100`，delta `0`
- regressions: `[]`
- noNewRegression: `true`

**判定：PASS（无新下降）**

---

## 3) DoD5 最终严格结论

DoD5 要求：
1. 登录 <800ms
2. 迁移单用户 <3s
3. Lighthouse 无新下降

本包结论：

- 子项1：PASS
- 子项2：PASS
- 子项3：PASS

## ✅ DoD5 严格判定：**PASS**

> 备注：本次已将登录/迁移时延证据与 Lighthouse 对比证据全部落盘，形成可复核证据链。