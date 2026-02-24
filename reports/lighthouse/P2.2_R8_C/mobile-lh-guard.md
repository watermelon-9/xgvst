# P2.2 R8 Sub-C（Frontend/Sentinel）移动端 Lighthouse 守护复测

- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 复测时间：2026-02-24
- 测试页面（mobile）：`/`（home）+ `/market`（market）
- 运行环境：本地 `vite preview`（`http://127.0.0.1:4173`）

## 1) 复测执行

执行步骤：
1. `corepack pnpm build`
2. `corepack pnpm --filter web preview --host 127.0.0.1 --port 4173`
3. 每页执行 Lighthouse mobile 3 次（performance only），结果落盘到：
   - `reports/lighthouse/P2.2_R8_C/lh-mobile-home-run{1..3}.json`
   - `reports/lighthouse/P2.2_R8_C/lh-mobile-market-run{1..3}.json`
4. 汇总文件：`reports/lighthouse/P2.2_R8_C/mobile-lh-guard-summary.json`

## 2) 与优化后基线对比（R7_B after）

基线（来自 `P2.2_R7_B`）：
- Home：100
- Market：100

本次复测（median of 3 runs）：
- Home：100
- Market：99

分数变化（本次 - 基线）：
- Home：`0`
- Market：`-1`

判定：**未出现 >3 分回退**，守护通过。

## 3) 关键指标（本次 3 次）

### Home `/`
- score：`[100, 100, 100]`（median `100`）
- FCP：`757 / 752 / 754 ms`
- LCP：`907 / 902 / 904 ms`
- TBT：`0 / 0 / 0 ms`

### Market `/market`
- score：`[99, 99, 99]`（median `99`）
- FCP：`1435 / 1434 / 1432 ms`
- LCP：`1688 / 1687 / 1685 ms`
- TBT：`0 / 0 / 0 ms`

## 4) 回退处理

- 触发条件：回退 >3 分。
- 本次结果：最大回退 1 分（market），**未触发修复阈值**。
- 因此本次未做额外代码变更，仅完成守护复测与记录。

## 5) 产物清单

- `reports/lighthouse/P2.2_R8_C/lh-mobile-home-run1.json`
- `reports/lighthouse/P2.2_R8_C/lh-mobile-home-run2.json`
- `reports/lighthouse/P2.2_R8_C/lh-mobile-home-run3.json`
- `reports/lighthouse/P2.2_R8_C/lh-mobile-market-run1.json`
- `reports/lighthouse/P2.2_R8_C/lh-mobile-market-run2.json`
- `reports/lighthouse/P2.2_R8_C/lh-mobile-market-run3.json`
- `reports/lighthouse/P2.2_R8_C/mobile-lh-guard-summary.json`
- `reports/lighthouse/P2.2_R8_C/mobile-lh-guard.md`
