# UI_GLOBAL_B · R1 Apply Auth + Home

## 1) 改造范围与方法（Token First）
本轮按「高品位国际站」标准，基于统一 token（颜色、字体、间距、圆角、阴影、按钮态）完成 auth 三页（login/register/forgot）与首页关键看盘区（toolbar/pulse/三栏主内容/行情行/快照卡/盘口区）一致性改造。具体落地为：在 `app.css` 顶部新增并收敛 `--xg-font-* / --xg-space-* / --xg-radius-* / --xg-shadow-* / --xg-button-* / --xg-focus-ring` 等语义变量，并在 auth/home 关键样式中替换硬编码值；同时在 `tokens.ts` 的 `ui` 段补齐对应设计 token 字典，保证语义与工程实现双向可追踪。

## 2) 对照变更（Before → After）
- **配色层级**：由分散渐变与局部硬编码，收敛为主按钮梯度、卡片边界透明度、面板背景与 hover/active 高亮统一表达；home 的 toolbar/pulse/pane/row 视觉层级更清晰。  
- **字体体系**：统一 display/body 字体 token，标题、关键数字、正文在 auth + home 维持一致字重与节奏。  
- **间距与卡片层级**：auth 表单与 home 关键区统一使用 spacing/radius/shadow token，卡片层级从「散点阴影」调整为「soft/card/pop」三级。  
- **按钮态与可用性**：auth 提交按钮统一 normal/hover/active/disabled/focus-visible；输入框 focus ring 统一到 token，提升可读性与可操作反馈。

## 3) 基线守护（不回退项）
已确认并保持基线：
1. **auth 无导航栏**：`+layout.svelte` 仍通过 `isAuthRoute` 隐藏 `AppHeader`，未改动路由判定逻辑。  
2. **仅邮箱语义**：login/register/forgot 页面仍保留邮箱校验、`type="email"`、哨兵文案（仅邮箱体系）与无手机号/微信/三方入口语义。  
3. **登录闭环**：login 流程仍保持 `signIn -> syncWatchlist -> sessionStorage 记录 -> goto(/market?authFlow=...)` 完整闭环，逻辑未退化。

## 4) 构建校验与交付状态
- `corepack pnpm check`：通过（0 error / 0 warning）。  
- `corepack pnpm build`：通过（SvelteKit + Cloudflare adapter 构建成功）。  
- 本次改造为 UI 风格统一与 token 化收敛，不涉及 auth 业务协议/接口行为变更。

## DoD
- [x] auth 三页完成 token 化统一（配色、字体、间距、卡片层级、按钮态）。
- [x] 首页关键区完成 token 化统一（toolbar/pulse/三栏主区/行情行/快照/盘口）。
- [x] 基线不回退：auth 无导航栏、仅邮箱语义、登录闭环保持。
- [x] 输出对照报告：`reports/lighthouse/UI_GLOBAL_B/r1-apply-auth-home.md`。
- [x] check/build 通过并可提交。