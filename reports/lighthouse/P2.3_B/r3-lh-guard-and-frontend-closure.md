# P2.3 R3 Sub-B（Frontend）LH 守护与前端收口证据

日期：2026-02-25  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 1) 执行范围与口径

本次按任务书执行：
- Lighthouse 基线复测：**mobile + desktop**，页面至少覆盖 **home(`/`) + market(`/market`)**。
- 口径：本地 `build + preview`（`http://127.0.0.1:4173`），`performance` 单分类。
- 每个维度执行 2 次，使用中位/均中值（2 次取平均）作为本轮分数。

原始证据目录：
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/`
- 汇总：`reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-summary.json`

---

## 2) 复测结果（home + market，mobile + desktop）

### Mobile
- Home：`[100, 100]` → median `100`
- Market：`[99, 99]` → median `99`

对比基线（P2.2 R8：home=100, market=99）：
- Home：`0`
- Market：`0`

### Desktop
- Home：`[100, 100]` → median `100`
- Market：`[100, 100]` → median `100`

对比基线：
- Home：对比 `reports/lighthouse/p1.1-verify-desktop.json`（100）→ `0`
- Market：历史仓内无同口径显式基线，记为 **N/A**（本轮建立基线 100）

结论：本轮未出现任何 **>3 分回退**。

---

## 3) 回退阈值判定与修复动作

- 触发条件：任一维度（mobile/desktop × home/market）相对基线下降 >3。
- 本轮判定：`lh-summary.json` 中 `needFix=false`、`regressions=[]`。
- 处理结果：**未触发最小修复**（无需补丁，保持当前实现）。

---

## 4) DoD 口径收口

结合 P2.3_B R1/R2 与本次 R3：

- DoD-1（前端 protobuf 主链路证据）
  - 继承 R2 证据：`reports/lighthouse/P2.3_B/r2-frontend-e2e-proto.md`
  - 判定：通过

- DoD-2（quoteCodec/useQuoteWebSocket/quoteStore 页面消费一致性）
  - 继承 R2 代码路径审计与页面证据
  - 判定：通过

- DoD-3（JSON fallback 收敛：默认关闭，调试可控）
  - 继承 R2 双态快照与日志证据
  - 判定：通过

- DoD-4（R3 LH 守护：P2.3 改动下性能不回退）
  - 本轮新增证据：`reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-summary.json`
  - 判定：通过（无 >3 分下降）

最终结论：**P2.3_B 前端侧收口完成（R3）**。

---

## 5) 产物清单

- `reports/lighthouse/P2.3_B/r3-lh-guard-and-frontend-closure.md`
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-summary.json`
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-mobile-home-run1.json`
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-mobile-home-run2.json`
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-mobile-market-run1.json`
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-mobile-market-run2.json`
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-desktop-home-run1.json`
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-desktop-home-run2.json`
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-desktop-market-run1.json`
- `reports/lighthouse/P2.3_B/raw/r3-lh-guard-20260225-023227/lh-desktop-market-run2.json`
