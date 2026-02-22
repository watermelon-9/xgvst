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
- `GET /healthz` -> `{ "ok": true }`
