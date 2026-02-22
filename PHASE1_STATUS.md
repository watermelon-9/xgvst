# xgvst v3 执行状态（Phase 1）

## 当前阶段
- P1.1 Vitesse 工程初始化：**已完成**
- P1.2 Cloudflare Pages 静态部署：**进行中（鉴权与远程仓库待接入）**

## 已完成
- [x] 在 `xgvst/apps/web` 初始化 Vitesse 脚手架
- [x] 安装依赖（`corepack pnpm install`）
- [x] 本地开发服务可启动（`http://127.0.0.1:5174/`）
- [x] 健康检查返回 `HTTP/1.1 200 OK`
- [x] 清理 Vitesse Demo 页面（移除 `about` 与 `hi` 路由，首页改为 v3 项目落地页）
- [x] 建立 UnoCSS 全局颜色变量（CSS Variables + Uno Theme）
- [x] 建立高频状态基线：`Pinia + shallowRef + requestAnimationFrame`（`src/stores/market.ts`）
- [x] 建立 CF Pages 配置文档与 `wrangler.toml`
- [x] 建立 Monorepo 后端预留目录：`apps/server/`
- [x] 建立首屏 Loading 骨架屏（CF 部署后可见验证点）
- [x] 在 `index.html` 注入启动态背景+加载指示（降低白屏感知）
- [x] 新增 Pages 自动化流水线草案：`.github/workflows/cloudflare-pages.yml`
- [x] 锁定构建要求：`build` 内置 `vue-tsc --noEmit`
- [x] 增加 `engines` 约束与示例环境文件（`.env.production.example`）
- [x] 本地 `pnpm build` 再次通过（作为提交前门禁）
- [x] 完成首版公网审计脚本：`scripts/check_ttfb_and_compression.sh`

## 兼容性修复
- 由于当前环境访问字体源异常（TLS/ECONNRESET），已移除 UnoCSS `presetWebFonts` 远程字体处理，改为本地系统字体策略，保证 `pnpm dev` 稳定启动。

## 当前阻塞（P1.2）
1. 本地仓库尚未配置 `origin`（GitHub 远程缺失），无法把 `develop` 直接绑定到 Pages 预览。
2. `wrangler whoami` 显示未登录，且在当前非交互环境执行 `wrangler pages project list` 报错要求 `CLOUDFLARE_API_TOKEN`；需完成 Cloudflare 鉴权后才能创建/关联 Pages 项目并拿到 `*.pages.dev` 预览地址。

## 下一步（待主Agent继续）
1. 接入 GitHub 远程并推送 `main/develop`。
2. 完成 Cloudflare 鉴权后执行 Pages 首次部署，回传 `*.pages.dev` URL。
3. 拿到预览 URL 后执行 Sub-C 公网 TTFB 与压缩生效审计。
4. 初始化 Go API 骨架与 proto（P2 前置，目录固定 `apps/server`）。
