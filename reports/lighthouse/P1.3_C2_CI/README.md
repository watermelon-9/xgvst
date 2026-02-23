# P1.3-C2 CI 证据集

- `lh-median-20260224-001407-run{1,2,3}.json`：本地 3 次移动端 Lighthouse 原始结果
- `lh-median-20260224-001407-summary.json`：中位数判定结果（threshold=97）
- `mobile-variance-evidence.json`：从 run1~run3 提取的关键波动指标（TBT / cdn-cgi jsd 脚本执行）
- `wrangler-whoami.txt`：Cloudflare 登录态与权限
- `wrangler-tail-xgvst-web.txt`：对 `xgvst-web` tail 尝试结果（失败证据）
- `wrangler-tail-xgvst-workers.txt`：对 `xgvst-workers` tail 尝试结果（失败证据）
