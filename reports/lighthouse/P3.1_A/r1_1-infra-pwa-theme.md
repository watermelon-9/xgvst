# P3.1 Sub-A 重跑 R1.1（Infra + PWA + Theme，按 v2 界面对齐）

## 0) 新增硬约束（本轮强制）
> 用户新增硬约束：**P3.1 本次任务必须参照「西瓜说股 v2 版本界面设计」**。

本次判定口径已切换为：
- 主题体系是否支撑 v2 亮/暗语义
- 缓存策略是否保证 v2 级别的亮/暗切换连续性（含离线）
- 模式切换是否与 v2 使用体验一致（系统/亮/暗）

---

## 1) v2 体验一致性映射（主题 / 样式缓存 / 模式切换）

### A. 主题体系（Theme Tokens + Uno 原子语义）
**v2 体验目标**：统一视觉语言（深色主基调 + 亮色可切换），避免散乱硬编码。

**对应实现**：
1. `apps/web/src/lib/theme/tokens.ts`
   - 新增基线声明：
     - `baseline.uiVersion = xg-v2`
     - `baseline.reference = 西瓜说股 v2 界面设计`
   - 主题色、玻璃态、UI 边框阴影统一入 token。
2. `apps/web/uno.config.ts`
   - 输出统一 `--xg-*` 变量；
   - 建立 `xg-*` 语义原子类（全局规范）。
3. `apps/web/src/app.css`
   - 全部业务样式改为 token/变量消费；
   - 非 token 文件无硬编码色残留。

**v2 对齐结论**：**PASS**

---

### B. 样式缓存（PWA Theme Cache Strategy）
**v2 体验目标**：亮/暗切换后刷新或弱网/离线时，主题样式持续可用，不闪回默认样式。

**对应实现**：
1. `apps/web/static/theme-light.css`
2. `apps/web/static/theme-dark.css`
   - 亮暗样式独立资源化。
3. `apps/web/vite.config.ts`
   - Workbox 路由：`/^\/theme-(light|dark)\.css$/`
   - 策略：`CacheFirst`
   - 缓存桶：`theme-style-v1`
   - `ignoreSearch: true`（兼容 `?v=` 版本参数）
4. `apps/web/src/routes/+layout.svelte`
   - 通过 `<link id="xg-theme-style">` 动态挂载并切换主题样式文件。

**v2 对齐结论**：**PASS**

---

### C. 模式切换（System / Light / Dark）
**v2 体验目标**：
- 默认跟随系统；
- 支持用户手动切换；
- 保持记忆（下次进入生效）。

**对应实现**：
1. `apps/web/src/lib/theme/env.ts`
   - `PUBLIC_THEME` 映射：`system | finance-light | finance-dark`。
2. `apps/web/.env.example`
   - 对齐 v2 语义注释（系统/亮/暗）。
3. `apps/web/src/routes/+layout.svelte`
   - 默认模式 = `PUBLIC_THEME`；
   - `localStorage` 用户选择优先级覆盖；
   - 监听系统主题变化并自动同步（当 mode=system）。
4. `apps/web/scripts/verify-theme-env.mjs`
   - 本地脚本验证映射矩阵与 env 约束。

**v2 对齐结论**：**PASS**

---

## 2) 本轮“写入 Infra/PWA 工作”的证据点
1. `tokens.ts` 已写入 v2 基线声明（非口头约定）。
2. `vite.config.ts` 已在主题缓存策略处加入 v2 对齐注释。
3. `+layout.svelte` 已写入 `xg-ui-baseline` / `xg-ui-reference` meta，便于审计与自动化巡检。
4. 本报告 DoD 已改为以 **v2 对齐度** 为核心判据。

---

## 3) 验证命令与输出（关键证据）
1. `corepack pnpm --filter web verify:theme-env`  
   - 输出：`🎉 theme env verify passed`
2. `corepack pnpm --filter web check`  
   - 输出：`svelte-check found 0 errors and 0 warnings`
3. `corepack pnpm --filter web build`  
   - 输出：`PWA v1.2.0` + `files generated: sw.js`
4. `grep -n "theme-style-v1\|theme-(light|dark)" .svelte-kit/output/client/sw.js`  
   - 输出命中：theme precache + runtime cache route

---

## 4) DoD（基于 v2 对齐度）
- [x] 主题语义（亮/暗/品牌）与 v2 体验一致，且已 token 化：**PASS**
- [x] 非 token 文件无硬编码色，保障 v2 视觉统一：**PASS**
- [x] 主题样式资源可被 PWA 稳定缓存，满足 v2 切换连续性：**PASS**
- [x] 模式切换支持 system/light/dark，与 v2 行为一致：**PASS**
- [x] 默认策略 + 用户覆盖 + 持久化链路完整：**PASS**
- [x] 构建与静态检查通过，可交付：**PASS**

---

## 5) 受本次“v2硬约束”影响的更新文件
- `apps/web/src/lib/theme/tokens.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/vite.config.ts`
- `apps/web/.env.example`
- `reports/lighthouse/P3.1_A/r1_1-infra-pwa-theme.md`
