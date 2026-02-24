# P2.4_C Raw Evidence

建议将证据按以下结构落盘：

- `p24-auth-baseline.json`：基线压测总结果（登录耗时/迁移耗时/同步延迟）
- `p24-evidence-manifest.json`：证据清单与阈值
- `auth/`：登录链路样本、Access/JWT 校验日志
- `migration/`：v2 迁移样本（成功/幂等/冲突）
- `sync/`：多端同步延迟样本
- `logs/`：wrangler tail / Cloudflare 日志导出

> Sentinel 执行脚本：`node scripts/p24-auth-baseline.mjs`
