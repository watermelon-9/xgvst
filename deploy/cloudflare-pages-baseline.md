# Cloudflare Pages 配置基线（P1.2）

本文件用于固化 `apps/web` 在 Cloudflare Pages 的部署基线，避免控制台配置漂移。

## 项目设置

- **Root directory**: `apps/web`
- **Build command**: `pnpm --filter web build`
- **Build output directory**: `.svelte-kit/cloudflare`
- **Preview command**: `pnpm --filter web dev`

## 说明

1. 该基线对应当前 SvelteKit + Cloudflare 产物路径。
2. 任何部署参数变更，需同步更新本文件并在变更记录中注明原因。
3. 合并前请执行：
   - `pnpm --filter web check`
   - `pnpm --filter web build`
