# xgvst server

P1.3 使用 Go + Gin 提供占位动态接口（后续替换为完整行情服务）。

## 启动

```bash
cd /Users/mac/.openclaw/workspace/xgvst/apps/server
PATH=/Users/mac/.local/go/bin:$PATH go mod tidy
PATH=/Users/mac/.local/go/bin:$PATH go run .
```

## 接口
- `GET /status` -> `{ "status": "connected", ... }`
- `GET /v3/health` -> `{ "status":"ok", "version":"v3.0.0", "tunnel":"Cloudflare" }`
- `GET /v3/blob?bytes=1048576` -> 返回 1MB 测试数据（吞吐审计用）
- `GET /healthz` -> `{ "ok": true }`
