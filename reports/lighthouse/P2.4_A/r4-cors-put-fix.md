# P2.4_A R4：CORS PUT 预检放行修复（Sub-A）

日期：2026-02-25  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 1) 修复内容

目标：修复 workers CORS `Access-Control-Allow-Methods`，确保 `PUT/DELETE` 预检可通过。

- 修改文件：`packages/workers/src/index.ts`
- 修改点：`buildCorsHeaders()`
- 变更前：
  - `Access-Control-Allow-Methods: GET,POST,OPTIONS`
- 变更后：
  - `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`

---

## 2) 复测范围与方式

复测场景：`/api/v2/self-selects` 的「web 跨域 PUT」链路（含预检 OPTIONS）。

本地联调地址：
- workers：`http://127.0.0.1:8791`
- web origin（模拟浏览器来源）：`http://127.0.0.1:4173`

请求方式：
1. 先发 CORS 预检：`OPTIONS /api/v2/self-selects`
2. 再发实际请求：`PUT /api/v2/self-selects`（带 `Origin` + `Authorization` + JSON body）
3. 补充 `GET /api/v2/self-selects` 验证写入结果与响应头

---

## 3) 请求/响应证据

### 3.1 预检（OPTIONS）证据

证据文件：`reports/lighthouse/P2.4_A/raw/r4-cors-options-put.txt`

关键响应：
- `HTTP/1.1 204 No Content`
- `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS` ✅
- `Access-Control-Allow-Headers: Content-Type, Authorization, Upgrade, X-Debug-Token`
- `Access-Control-Allow-Origin: *`

### 3.2 实际 PUT 证据

证据文件：`reports/lighthouse/P2.4_A/raw/r4-put-v2-self-selects.txt`

关键响应：
- `HTTP/1.1 200 OK` ✅
- 响应头包含：`access-control-allow-methods: GET,POST,PUT,DELETE,OPTIONS`
- 响应体：

```json
{"ok":true,"userId":"p24-r4@example.com","symbols":["000001","600519","300750"],"diff":{"added":["000001","600519","300750"],"removed":[]}}
```

### 3.3 PUT 后 GET 验证

证据文件：`reports/lighthouse/P2.4_A/raw/r4-get-v2-self-selects.txt`

关键响应：
- `HTTP/1.1 200 OK` ✅
- 返回 symbols 已包含 PUT 写入值（`000001/300750/600519`）

---

## 4) 结论

- `PUT/DELETE` 已进入 CORS 允许方法列表；
- `/api/v2/self-selects` 的 web 跨域 PUT 场景已完成「预检通过 + 实际请求成功」闭环；
- 本轮小阻塞（PUT 预检 CORS 未放行）已修复。
