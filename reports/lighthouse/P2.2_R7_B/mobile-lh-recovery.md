# P2.2 R7 Sub-B（Frontend）移动端 Lighthouse 回升报告

- 仓库：`/Users/mac/.openclaw/workspace/xgvst`
- 时间：2026-02-24
- 范围：首页 `/`、市场页 `/market`（mobile）

## 1) 首页移动端 LH 下降点定位（脚本 / 渲染 / 资源）

### 1.1 线上下降根因（脚本侧）
基于既有证据 `reports/lighthouse/P2.2_R6_C/lh-mobile-home.json`：

- Home score：`82`
- TBT：`583ms`
- Bootup 最大来源：`https://xgvst.com/cdn-cgi/challenge-platform/scripts/jsd/main.js`（约 `1268ms`）

见：`reports/lighthouse/P2.2_R7_B/home-drop-root-cause.json`

结论：首页回退的主导因素是 **Cloudflare challenge/analytics 注入脚本**，而不是页面业务 JS 本体。

### 1.2 本地构建对照（排除业务代码重负载）
在本地 preview（无上述 CDN challenge 干扰）下：

- Home score：`100`
- TBT：`0ms`
- bootup 不存在重型第三方脚本

说明：首页业务代码本身不构成显著主线程阻塞，前端可控优化应聚焦关键路径与非关键脚本时机。

---

## 2) 最小改动优化（不影响功能）

### 2.1 关键渲染路径：延后 market 首屏非关键实时链路初始化
文件：`apps/web/src/routes/market/+page.svelte`

改动：将以下逻辑从 `onMount` 立即执行改为 `requestIdleCallback`（fallback `setTimeout`）调度：
- `mountQuoteStore()`（WS 实时链路）
- `fetchUniverse()`（首轮市场数据拉取）

目的：让首屏结构先渲染，再在空闲期挂载实时能力，降低首屏主线程竞争。

### 2.2 脚本加载：保持功能、降低首屏竞争
同上改动实质把实时链路相关 JS 执行推迟到 idle，避免与 FCP/LCP 关键阶段抢占主线程。

### 2.3 静态资源策略：提前建立 Workers 连接
文件：`apps/web/src/routes/+layout.svelte`

新增：
- `<link rel="dns-prefetch" href="//xgvst-workers.viehh642.workers.dev" />`
- `<link rel="preconnect" href="https://xgvst-workers.viehh642.workers.dev" crossorigin="anonymous" />`

目的：减少 market 首次跨域 API/WS 链路建连抖动成本。

---

## 3) Lighthouse（mobile）前后对比

测试环境：`vite preview`（`http://127.0.0.1:4173`）

原始结果：
- Before: `lh-mobile-home-before.json` / `lh-mobile-market-before.json`
- After: `lh-mobile-home-after.json` / `lh-mobile-market-after.json`
- 汇总: `mobile-lh-comparison.json`

### 3.1 Home `/`
- Score: `100 -> 100`
- FCP: `760ms -> 753ms`
- LCP: `760ms -> 753ms`
- TBT: `0ms -> 0ms`
- Main-thread work: `232ms -> 225ms`

### 3.2 Market `/market`
- Score: `99 -> 100`
- FCP: `1440ms -> 1263ms`（`-177ms`）
- LCP: `1723ms -> 1263ms`（`-460ms`）
- TBT: `0ms -> 0ms`
- Main-thread work: `435ms -> 239ms`（`-196ms`）
- Bootup: `146ms -> 25ms`（`-121ms`）

---

## 4) 结论

1. 首页移动端 LH 回退点已定位：**主要由 Cloudflare challenge 脚本注入导致**（非页面业务 JS 主导）。
2. 在前端可控范围内完成最小改动：
   - 延后 market 实时链路初始化（关键渲染路径优化）
   - 预连接 workers 域名（静态资源/网络策略优化）
3. 回归结果：
   - Home 保持 `100`
   - Market `99 -> 100`，关键指标显著收敛

---

## 5) 本次产物

- `reports/lighthouse/P2.2_R7_B/lh-mobile-home-before.json`
- `reports/lighthouse/P2.2_R7_B/lh-mobile-market-before.json`
- `reports/lighthouse/P2.2_R7_B/lh-mobile-home-after.json`
- `reports/lighthouse/P2.2_R7_B/lh-mobile-market-after.json`
- `reports/lighthouse/P2.2_R7_B/mobile-lh-comparison.json`
- `reports/lighthouse/P2.2_R7_B/home-drop-root-cause.json`
- `reports/lighthouse/P2.2_R7_B/mobile-lh-recovery.md`
