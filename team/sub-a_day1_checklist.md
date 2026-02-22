# Sub-A Day1 执行清单（可复制）

## 目标
完成 v3 基础工程与后端通道最小闭环验证。

## 1. 初始化目录结构
```bash
cd /Users/mac/.openclaw/workspace/xgvst
mkdir -p apps/web apps/api proto scripts docs
```

## 2. Go API最小骨架
```bash
cd /Users/mac/.openclaw/workspace/xgvst/apps/api
go mod init xgvst-api
go get github.com/gin-gonic/gin github.com/gorilla/websocket google.golang.org/protobuf/proto
```

## 3. Proto文件草案
```bash
mkdir -p /Users/mac/.openclaw/workspace/xgvst/proto
cat > /Users/mac/.openclaw/workspace/xgvst/proto/market.proto <<'EOF'
syntax = "proto3";
package market;
message TickData { string symbol = 1; double price = 2; int64 ts = 3; }
message MarketUpdate { repeated TickData ticks = 1; }
EOF
```

## 4. 验证 tunnel 状态
```bash
/Users/mac/.local/bin/cloudflared tunnel info dbecfc36-4b79-4c08-b916-90fdfab9f246
```

## 5. DoD（Day1）
- [ ] Go工程可编译
- [ ] proto 文件落地
- [ ] tunnel 可查询状态
- [ ] 产出《风险与回滚》草稿

## 6. 回滚点
- 删除 `xgvst/apps/api` 即可回退 Day1
