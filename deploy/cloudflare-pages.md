# Cloudflare Pages 配置（P1.2）

## 项目
- Project Name: `xgvst-web`
- Root Directory: `apps/web`
- Framework preset: `None`（或 Vite）

## 构建配置（强制）
- Build command: `corepack pnpm build`（可简写 `pnpm build`）
- Build output directory: `dist`

## 环境变量（建议）
- `NODE_VERSION=24`
- `PNPM_VERSION=10.7.0`

## 分支发布
- Production branch: `main`
- Preview branch: `develop`

## 验收清单
- [ ] `corepack pnpm build` 本地通过
- [ ] Pages 预览地址可访问
- [ ] 主页面显示“西瓜说股 v3”
- [ ] 无大文件误入仓库
