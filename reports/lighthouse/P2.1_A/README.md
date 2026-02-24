# P2.1 Sub-A（Infra）执行证据

## 变更范围
- `packages/workers/wrangler.toml`
  - 明确约定：
    - `CORS_ALLOW_ORIGINS` 为非敏感变量（可放 `[vars]`）
    - `ALLTICK_TOKEN/SINA_COOKIE/EASTMONEY_TOKEN/TENCENT_TOKEN` 仅允许 `wrangler secret put` 注入
  - 未写入任何明文 secret
- `packages/workers/src/env.d.ts`
  - 补充以上变量类型与注释约定
- `.env.example`
  - 新增四个数据源 token/cookie 占位与 secret 注入说明（仅占位，无明文）
- `scripts/source-failover-test.mjs`
  - 新增可执行故障注入压测脚本，支持：
    - WS 订阅行情
    - 手动触发 `force_failover`
    - 3s SLA 内切换到备用源校验
    - 结果落盘 `source-failover-test.json`
- `package.json`
  - 修复 `workers:deploy`（改为 `pnpm --filter workers run deploy`，避免 pnpm deploy 子命令歧义）
  - 新增脚本：`workers:failover-test`

## 验证命令
```bash
corepack pnpm workers:check
corepack pnpm --filter workers run deploy
corepack pnpm workers:failover-test
```

## 验证结果摘要
- check：通过（见 `01-workers-check.log`）
- deploy：成功，Version ID: `1d9e6047-8ed0-4cbf-a14d-36cb6ea2f06e`（见 `02-workers-deploy.log`）
- failover：通过（见 `03-source-failover-test.log` / `source-failover-test.json`）
  - `initialSource`: `alltick`
  - `switchedTo`: `sina`
  - `switchedMs`: `1916`
  - 结论：手动触发后 3s 内切到备用源（PASS）

## 证据文件
- `reports/lighthouse/P2.1_A/01-workers-check.log`
- `reports/lighthouse/P2.1_A/02-workers-deploy.log`
- `reports/lighthouse/P2.1_A/03-source-failover-test.log`
- `reports/lighthouse/P2.1_A/source-failover-test.json`
- `reports/lighthouse/P2.1_A/README.md`
