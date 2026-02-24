# P3.1 Sub-A 重跑 R1.1（Infra + PWA + Theme）

## 0) 任务映射结论
- 任务书 3.1-1（Uno 金融主题 + 全局原子类 + 禁止硬编码色）：**PASS**
- 任务书 3.1-2（PWA 亮/暗主题样式缓存策略 + 验证）：**PASS**
- 任务书 3.1-3（THEME 环境变量预留 + 本地验证脚本）：**PASS**
- 任务书 3.1-4（报告与 DoD）：**PASS**

---

## 1) 详细步骤（逐条映射）

### 3.1-1 Uno 金融主题、全局原子类规范、禁止硬编码色
#### 文件级改动
1. `apps/web/src/lib/theme/tokens.ts`
   - 新增 `ui` 语义令牌：`headerBorder / emblemShadow / chipBorder`。
2. `apps/web/uno.config.ts`
   - 统一金融主题 token 输出到 CSS 变量（`--xg-*`）。
   - 增加全局原子语义 shortcuts（`xg-*` 前缀），例如：
     - `xg-text-main / xg-text-subtle`
     - `xg-surface / xg-surface-hover`
     - `xg-pill-btn / xg-row-item`
   - `glass / glass-card / neon-text` 改为仅引用变量，不再写硬编码色值。
3. `apps/web/src/app.css`
   - 全量替换色值为 `var(--xg-...)`；移除硬编码 `#xxxxxx`/`rgba(...)`。
   - 补齐首页三栏与移动 Tab 所需样式类（`market-grid / pane-* / mobile-tabs / quote-* / kline-*`）。
4. `apps/web/src/routes/+layout.svelte`
   - meta 主题色改为 token 引用（`FINANCE_THEME.*.themeMeta`），去除硬编码。

#### 验证
- 扫描结果（排除 token 定义文件）无硬编码色残留：
  - `grep -RIn "rgba" src ... --exclude='tokens.ts'` => **无输出**

---

### 3.1-2 PWA 亮/暗样式缓存策略（落地+验证）
#### 文件级改动
1. `apps/web/static/theme-light.css`
2. `apps/web/static/theme-dark.css`
   - 提供独立亮/暗主题样式资源（用于 SW 分主题缓存）。
3. `apps/web/src/routes/+layout.svelte`
   - 注入并动态切换 `<link id="xg-theme-style" ...>`：
     - `/theme-light.css?v=xgvst-finance-v1`
     - `/theme-dark.css?v=xgvst-finance-v1`
4. `apps/web/vite.config.ts`
   - Workbox 新增主题样式缓存规则：
     - `urlPattern: /^\/theme-(light|dark)\.css$/`
     - `handler: CacheFirst`
     - `cacheName: theme-style-v1`
     - `matchOptions.ignoreSearch = true`
     - `maxAgeSeconds = 30d`

#### 验证命令与输出
1. 构建：
   - `corepack pnpm --filter web build`
   - 输出关键项：
     - `PWA v1.2.0`
     - `mode generateSW`
     - `files generated: sw.js`
2. SW 规则核验：
   - `grep -n "theme-style-v1\|theme-(light|dark)" .svelte-kit/output/client/sw.js`
   - 输出命中：
     - precache 含 `theme-light.css` 与 `theme-dark.css`
     - runtime route 含 `cacheName:"theme-style-v1"`

---

### 3.1-3 THEME 环境变量预留方案 + 本地验证脚本
#### 文件级改动
1. `apps/web/src/lib/theme/env.ts`
   - 新增 `resolveThemeModeFromEnv()`：
     - `system -> system`
     - `finance-light|light -> light`
     - `finance-dark|dark -> dark`
     - 其他值回退 `system`
2. `apps/web/src/routes/+layout.svelte`
   - 引入 `PUBLIC_THEME` 默认模式（允许 localStorage 覆盖）。
3. `apps/web/.env.example`
   - 增加：`PUBLIC_THEME=system` 与注释说明。
4. `apps/web/scripts/verify-theme-env.mjs`
   - 本地验证脚本：校验 `.env.example` + 主题映射矩阵。
5. `apps/web/package.json`
   - 新增脚本：`verify:theme-env`。

#### 本地验证命令与输出
- `corepack pnpm --filter web verify:theme-env`
- 输出：
  - `✅ .env.example includes PUBLIC_THEME=system`
  - 矩阵 6 组全部 `✅`
  - `🎉 theme env verify passed`

---

## 2) 注意事项
1. `tokens.ts` 是唯一允许定义原始颜色值的位置；业务样式仅可消费 `--xg-*` 变量或 `xg-*` 原子类。
2. `theme-style-v1` 开启 `ignoreSearch: true`，允许 `?v=` 滚动版本同时避免重复缓存条目。
3. `PUBLIC_THEME` 为“默认模式”，若用户主动切换主题会由 `localStorage` 覆盖（符合产品预期）。
4. `theme-light.css / theme-dark.css` 已进入 precache，首屏离线可直接命中。

---

## 3) 工作安排（本轮执行顺序）
1. 先收敛 token 与 Uno 变量体系（避免后续 CSS 反复改）。
2. 再改全局样式与布局，确保无硬编码色。
3. 再接入 PWA 主题资源与 SW 缓存规则。
4. 最后补 `PUBLIC_THEME` 预留 + 验证脚本，并执行 check/build/grep 证据链。

---

## 4) DoD（含 PASS/FAIL）
- [x] Uno 金融主题落地，样式改为 token/变量驱动：**PASS**
- [x] 全局原子类规范（`xg-*`）可用：**PASS**
- [x] 非 token 文件不出现硬编码色（检索验证）：**PASS**
- [x] PWA 亮/暗主题独立资源缓存策略：**PASS**
- [x] SW 生成文件中可见主题缓存规则证据：**PASS**
- [x] `PUBLIC_THEME` 预留、默认、覆盖逻辑完整：**PASS**
- [x] 本地验证脚本可运行且通过：**PASS**
- [x] `pnpm --filter web check` 通过：**PASS**
- [x] `pnpm --filter web build` 通过：**PASS**

---

## 5) 本轮改动清单
- `apps/web/src/lib/theme/tokens.ts`
- `apps/web/uno.config.ts`
- `apps/web/src/app.css`
- `apps/web/src/lib/theme/env.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/static/theme-light.css`
- `apps/web/static/theme-dark.css`
- `apps/web/vite.config.ts`
- `apps/web/.env.example`
- `apps/web/scripts/verify-theme-env.mjs`
- `apps/web/package.json`
- `reports/lighthouse/P3.1_A/r1_1-infra-pwa-theme.md`
