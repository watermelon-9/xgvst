# P2.5 HOME A / R1：v2.039 首页源码定位与 v3 1:1 映射清单

## 一、详细步骤（含可追溯证据）

### 1) 源码定位（按“旧项目源码目录/技能目录优先”）
- 在 workspace 内先检索 `v2.039 / xgshuogu / 首页`，确认 `xgvst` 仓库内无完整 v2 源码，仅有 v3 与验收脚本。
- 在可访问技能目录定位到旧项目备份：
  - ` /Users/mac/Applications/openclaw/skills/xgshuogu/backups/v2.039-20260223-051830/xgshuogu.py `
- 该文件包含：
  - 首页 `/` 的完整 HTML/CSS/JS（非片段）
  - 登录/注册/忘记密码页源码（可用于统一视觉 token 提炼）

### 2) v2.039 首页核心证据位
- 首页入口与标题：`xgshuogu.py:2966-2975`
- 首页主色/暗色变量（整站视觉 token）：`xgshuogu.py:2977-3027`
- 页面底色、容器、Hero、侧栏、三栏网格、面板、表格、图表区样式：`xgshuogu.py:3029-3230`
- 首页结构（Hero + 侧栏 + 三栏内容 + 指标弹窗）：`xgshuogu.py:3233-3360`
- 交互态关键逻辑：
  - 主题切换：`xgshuogu.py:3967-3973`
  - 侧栏展开/收起：`xgshuogu.py:4171-4183`
  - 模块聚焦高亮（boards/watchlist/charts）：`xgshuogu.py:4185-4224`
  - K线周期切换：`xgshuogu.py:4226-4238`
  - 顶部搜索联动跳转：`xgshuogu.py:4450-4494`

### 3) v3 对照位（当前首页实现）
- 首页结构：`xgvst/apps/web/src/routes/+page.svelte:22-114`
- 三栏/移动 Tab 结构组件：`xgvst/apps/web/src/lib/components/MarketLayout.svelte:31-59`
- v3 全局视觉与首页相关样式：`xgvst/apps/web/src/app.css:4-446`

### 4) v2.039 → v3 映射清单（可执行）

| 维度 | v2.039 基线（来源） | v3 当前（来源） | 1:1 还原执行映射（建议落点） |
|---|---|---|---|
| 布局结构 | `Hero + 侧栏 + 三栏`，三栏比重 `1.02 / 1.2 / 1.85`，并强制 PC 布局（`2977-3230`, `3257-3342`） | `顶部 toolbar + 三栏`，比例 `1.15 / 1.7 / 1.25`（`+page.svelte`, `app.css:322-327`） | v3 首页改为 v2 结构：新增 `hero`、`shell/sidenav`、`main-area/grid/col-*`；`market-grid` 列宽改为 v2 比例。建议在 `+page.svelte` 直接重建 DOM，`app.css` 引入对应 class。 |
| 色板（亮/暗） | 主背景 `#3f102f/#6b1456/#f5f1fa`；暗色 `#180712/#30103a/#0b1020`；强调 `#8e2de2/#ff416c`（`2983-3026`） | 以 `#4f46e5/#1a1633` 紫蓝玻璃风（`app.css:13-47`） | 新增 `--v2039-*` token（亮/暗双套），首页 route 级优先覆盖（避免全局破坏 auth/其他页）。 |
| 字号体系 | 标题 `24/800`；副标题 `13`；面板标题 `14`；表格用 `clamp(10~14)`（`2979`,`3033-3034`,`3086`,`3100`） | toolbar/pane 文本偏小（`0.95rem/0.84rem/0.82rem`）（`app.css:297-377`） | 首页路由下覆盖字体：`hero-title 24px`、`subtitle 13px`、`panel h3 14px`、`table font-size var(--panel-font)`。 |
| 间距节奏 | 页面 `padding 14`、模块 gap `10`、panel `padding 10`、圆角 `12/14`（`3029-3030`,`3079-3086`） | `page padding 2rem`、panel/pane 更“卡片化”紧凑（`app.css:82-85,329-350`） | 首页专用 spacing token：`--home-gap:10px`、`--home-panel-pad:10px`、`--home-radius:12px`；统一替换。 |
| 按钮状态 | 主按钮紫粉渐变；`hover brightness(1.06)`；ghost 半透明白边；tab active 渐变（`3058-3060`,`3126-3128`） | 多为纯 surface hover，无强渐变 active（`app.css:379-423`） | 将首页按钮态按 v2 分层：`primary/ghost/tab/chip` 四类；active/hover 还原到渐变与亮度策略。 |
| 卡片/面板样式 | 实底 panel + 边框 + 阴影；focus 有 2px 高亮环+轻上浮（`3085-3089`） | 玻璃态 `glass-card` 为主（`app.css:69-80`） | 首页从 glass 改为 v2 panel 体系；保留 glass 仅给非首页或可配。新增 `.panel.focus/.pulse` 动画。 |
| 列表/表格样式 | sticky 表头 + sticky 前3列 + 拖拽滚动 + hover/active 行色（`3097-3110`,`4258-4305`） | 当前为 button list，不是完整 table（`+page.svelte:36-93`） | 首页左/中列改为 table 语义与固定列策略；至少先实现结构/样式一致，再补拖拽列与排序。 |
| 关键文案 | `西瓜说股 v2.039`、`Dashboard · 概念 / 同花顺行业 / 地域 联动监控`、`实时行情/VAR7/内网版`、`①②③④`（`3236-3339`） | `西瓜说股 v3.0（v2 对齐模式）`、`主市场...`（`+page.svelte:26-32`） | 文案按 v2 逐字替换，保留版本号可配置（默认显示 v2.039 文案）。 |
| 交互态 | 顶搜可命中版块/股票并自动聚焦对应面板（`4450-4494`）；侧栏 mode 切换触发 panel focus（`4205-4224`）；主题切换（`3967-3973`） | 当前只有列表点击切换 symbol/board，缺少“场景模式”与 hero 搜索 | 首页补齐 `runHeroSearch/activateNav/toggleTheme` 同等行为；交互函数可迁移为 Svelte store + action。 |
| K线操作区 | 周期按钮 10 档（FS/D/W/M/120/60/30/15/5/1）+ 指标按钮 MA/VOL/VAR7（`3314-3338`） | 仅 4 档按钮，偏 skeleton（`+page.svelte:99-104`） | 先扩按钮矩阵到 v2 档位；再接指标开关与样式状态（`active/disabled`）。 |

### 5) 登录页 token（兜底映射，满足“若仅有登录页源码”）
> 本次已拿到完整首页源码；但仍补充兜底 token，可在首页缺失时快速落地视觉统一。

来源：`xgshuogu.py:5855-5884`
- 渐变主色：`--bgA #ff4e5f`、`--bgB #9b4dff`
- 文本：`--text #1c2230`、`--muted #69758c`
- 边框：`--border #eadcf7`
- CTA：`linear-gradient(90deg,#ff4e5f,#9b4dff)`
- 输入 focus：`#b987f3` + `rgba(155,77,255,.16)`

兜底执行：在 v3 先建立 `v2039-auth/home shared tokens`，保证首页/登录页渐变、边框、焦点环一致，不会出现“首页是蓝紫玻璃、登录是红紫渐变”的割裂。

---

## 二、注意事项

1. **隔离原则**：仅输出映射与证据，不直接跨仓挪用运行时代码；v3 需按 Svelte 组件化重写，避免把 Flask 模板 JS 直接粘贴进生产。  
2. **验收优先级**：票2.5验收强调 auth 闭环与稳定性，首页 1:1 还原时不得破坏 `/auth/*` 当前可用性与规则（邮箱体系、无第三方入口）。  
3. **响应式策略冲突**：v2 为“强制 PC 布局 + 横向滚动”；v3 现有 mobile tab。若按“1:1”严格执行，应以 v2 为准，移动端也维持 PC 视觉逻辑（必要时保留 feature flag）。  
4. **文本与语义一致性**：标题、分区编号（①②③④）、按钮文案、状态提示需逐字对齐；这部分是最容易被验收人工比对发现的差异。  
5. **状态样式完整性**：至少覆盖 default / hover / active / focus / disabled 五态，尤其是侧栏、行项、K线周期按钮、指标按钮。  

---

## 三、工作安排（给实现同学的最小可执行分解）

- **W1 结构对齐（半天）**  
  - `+page.svelte`：按 v2 重建 `hero + shell + sidenav + grid(三列)` 骨架。  
  - `MarketLayout.svelte`：仅保留/复用必要逻辑，避免与新骨架重复。

- **W2 视觉 token 与样式对齐（半天）**  
  - `app.css` 新增 `--v2039-*` token（亮/暗两套），首页作用域覆盖。  
  - 完成 panel/table/button/chip/kline toolbar 样式 1:1。

- **W3 交互对齐（0.5~1天）**  
  - 补 `activateNav`（侧栏模式聚焦）、`runHeroSearch`（版块/个股跳转）、`setChartPeriod` 10档。  
  - 补默认 active 态与状态回显（当前版块/当前个股）。

- **W4 回归与验收（半天）**  
  - 桌面端逐项比对映射清单；  
  - 检查不影响 auth 页与 P2.5 既有 DoD；  
  - 输出 before/after 截图与差异记录。

---

## 四、DoD（本报告交付定义）

- [x] 在可访问范围内定位到 **v2.039 首页完整源码**（非仅截图），并给出绝对路径与行号证据。  
- [x] 产出 **v2.039 → v3 首页映射清单**，覆盖：布局结构、色板、字号、间距、按钮状态、卡片样式、关键文案、交互态。  
- [x] 给出 **登录页兜底 token 映射**（即使只有登录页源码也可执行）。  
- [x] 报告写入目标路径：`reports/lighthouse/P2.5_HOME_A/r1-v2039-home-source-mapping.md`。  
- [x] 已提交 commit（非空提交）。
