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

## 环境变量与密钥（安全基线）

### Pages（apps/web）

在 Cloudflare Pages 项目设置中维护环境变量：

- `PUBLIC_API_BASE_URL`（非敏感，可明文）
- `API_TOKEN` / 其他业务密钥（敏感，仅在 Pages 环境变量中配置）

要求：

- 仓库内禁止提交真实密钥。
- 示例值仅允许写在 `.env.example`，不得可直接用于生产。

### Workers（packages/workers）

Workers 密钥统一通过 Wrangler 注入，不在 `wrangler.toml` 或代码里明文：

```bash
cd packages/workers
wrangler secret put QUOTE_API_TOKEN
```

`wrangler.toml` 仅保留资源绑定（KV/D1/DO）和迁移定义；密钥使用 `wrangler secret` 管理。
