# PERFORMANCE 基线与对比规则（P1.1）

> 作用：固化 P1.1 性能基线，作为后续阶段（P1.2+）对比锚点。  
> 范围：工程可用性（build/check/dev ready）+ Lighthouse 指标。  
> 更新时间：2026-02-23

---

## 1) P1.1 基线快照（Baseline）

### 1.1 工程可用性基线

| 维度 | 基线结果 | 证据来源 |
|---|---:|---|
| `pnpm build` | 通过 | `reports/lighthouse/P1.1_Sentinel_Audit_2026-02-23.md` |
| `pnpm check` | 通过（`svelte-check found 0 errors and 0 warnings`） | `reports/lighthouse/P1.1_Sentinel_Audit_2026-02-23.md` |
| `pnpm dev` ready | Vite ready `816 ms`；脚本墙钟 `READY_MS=962`（未达 `<800ms` 目标） | `reports/lighthouse/P1.1_Sentinel_Audit_2026-02-23.md` |

### 1.2 Lighthouse 基线

采样页：`http://127.0.0.1:4174/`

| 分类 | 基线分数 |
|---|---:|
| Performance | 55 |
| Accessibility | 90 |
| Best Practices | 96 |
| SEO | 91 |

关键指标（P1.1 首次采样）：

- LCP: `25.2 s`
- FCP: `12.9 s`
- TBT: `60 ms`
- CLS: `0`
- Speed Index: `12.9 s`

数据来源：
- `reports/lighthouse/西瓜说股_v3.0_P1.1_初始性能报告.md`
- `reports/p1.1-lighthouse.json`

---

## 2) 后续对比规则（必须遵守）

### 2.1 对比前提（保证可比性）

1. **同页面**：默认对比首页（`/`）。
2. **同命令**：
   - `corepack pnpm build`
   - `corepack pnpm check`
   - `corepack pnpm --filter web dev --host 127.0.0.1 --port 4173`
   - Lighthouse 继续对 `http://127.0.0.1:4174/` 采样（除非明确变更并记录）。
3. **同口径记录**：每次记录 `Vite ready(ms)` 与 `READY_MS(ms)` 两个值。
4. **同文档归档**：新增结果必须写入 `reports/`，并在本文件“报告索引”补充路径。

### 2.2 判定规则（回归/通过）

1. **Build / Check 门禁**
   - 任一失败即判定为回归（阻断）。

2. **Dev Ready 门禁（分层）**
   - 冷启动参考：`Vite ready < 1200ms`（用于识别环境抖动，不作唯一阻断）。
   - 热启动门禁：5次刷新中位数 `< 800ms`（DoD-1 主判定）。

3. **Lighthouse 门禁（统一口径）**
   - **仅在 `build + preview` 环境验收**（禁止用 `pnpm dev` 作为 DoD-4 判定）。
   - 阶段目标（DoD）：移动端/桌面端 Performance `>= 98`。

4. **核心指标门禁（LCP/FCP/TBT/CLS/SI）**
   - LCP/FCP/SI：较基线上升超过 `10%` 视为回归。
   - TBT：较基线上升超过 `20%` 视为回归。
   - CLS：若从 `0` 变为 `>0.05` 视为回归。

### 2.3 统一验收脚本（强制）

- 统一命令：`./scripts/verify-p1.1.sh`
- 统一产物：
  - `reports/lighthouse/p1.1-verify-*.log`
  - `reports/lighthouse/p1.1-verify-mobile.json`
  - `reports/lighthouse/p1.1-verify-desktop.json`
  - `reports/lighthouse/P1.1_统一口径验收报告_YYYY-MM-DD.md`
- 统一规则：
  - 同一份代码仅认可同一脚本产出的结论，禁止“手工口径”与“脚本口径”混用。

---

## 3) 报告索引（统一入口）

### 3.1 P1.1 基线与审计

- `reports/lighthouse/P1.1_Sentinel_Audit_2026-02-23.md`
- `reports/lighthouse/西瓜说股_v3.0_P1.1_初始性能报告.md`
- `reports/p1.1-lighthouse.json`

### 3.2 历史采样与排障记录（不直接作为评分基线）

- `reports/lighthouse/p1.1-r1-before.json`（CHROME_INTERSTITIAL_ERROR 的失败采样）
- `reports/lighthouse/p1.3-heartbeat.log`

---

## 4) 后续新增报告模板（建议）

新增报告建议命名：

- `reports/lighthouse/Px.y_Perf_YYYY-MM-DD.md`
- `reports/lighthouse/Px.y_Sentinel_Audit_YYYY-MM-DD.md`
- `reports/px.y-lighthouse.json`

并至少包含：

1. 执行环境（Node/pnpm/浏览器版本）
2. build/check/dev ready 结果
3. Lighthouse 分类分数 + 关键指标
4. 与本文件基线的差值结论（↑/↓，是否回归）
