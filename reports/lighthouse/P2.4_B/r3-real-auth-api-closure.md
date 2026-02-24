# P2.4_B R3 前端严格收口：真实 Auth API 拉取/合并链路（Sub-B）

日期：2026-02-25  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 第一段｜执行范围与收口目标

本轮只做 P2.4 R3 Sub-B 前端严格收口：

1. 在 **可达 auth API** 条件下，复测 `useAuth` 的真实拉取/合并链路；
2. 去掉“仅本地模拟依赖”的口径，确保证据显示 `remote` 来源；
3. 输出截图 + 日志 + 快照，并形成可验收文档。

本次联调服务：
- Workers（local）：`http://127.0.0.1:8791`
- Web（dev）：`http://127.0.0.1:4173`

---

## 第二段｜代码与链路调整（R3）

### 1) useAuth 真实接口口径对齐
文件：`apps/web/src/lib/auth/useAuth.svelte.ts`

- 新增 `withUserId(endpoint, userId)`，请求参数显式携带 `?userId=`；
- 真实拉取/同步优先端点调整为：
  - `GET/PUT /api/v2/self-selects?userId=...`
  - 失败再回退 `GET/PUT /api/self-selects?userId=...`

> 说明：workers 路由实际为 `/api/v2/self-selects`（而非 `/v2/self-selects`），R3 已完成前端对齐。

### 2) 本轮检查
- `corepack pnpm --filter web check` 通过（0 error / 0 warning）
- 证据：`evidence/r3-real-auth-api/09-pnpm-check.log`

---

## 第三段｜真实链路证据（截图 + 日志 + 快照）

### A. API 可达与数据种子（真实 auth API）
- D1 迁移日志：`01-d1-migrate.log`
- workers 运行日志：`02-workers-dev.log`
- v2 写入/读取（200）：
  - `15-put-self-selects-v2.headers`
  - `16-put-self-selects-v2.body.json`
  - `17-get-self-selects-v2.headers`
  - `18-get-self-selects-v2.body.json`

### B. 页面真实拉取/合并证据
- 截图：`14-market-real-auth-api.jpg`
- 快照要点：`19-browser-snapshot-keypoints.txt`

关键观测（截图 + 快照一致）：
1. `当前状态 = authenticated`
2. `最近自动拉取 = remote @ http://127.0.0.1:8791/api/v2/self-selects`
3. `合并结果（新增 symbols）= 002594, 688001`
4. 自选列表出现 `自选 002594 / 自选 688001`
5. `当前订阅 symbols` 扩展为 `000001,600519,300750,002594,688001`

结论：`useAuth` 已经走到真实 API 拉取并完成前端合并展示，满足“去掉仅本地模拟依赖”的 R3 目标。

---

## 第四段｜DoD 映射与遗留说明

| DoD | 要求 | 结果 |
|---|---|---|
| DoD-3（前端） | 登录后自动拉取并合并自选可见 | ✅ PASS（remote source + 合并证据） |
| DoD-4（可演示） | 页面状态流与同步链路可复核 | ✅ PASS（截图+快照+日志齐全） |
| DoD-5（稳定性） | 前端改动不引入类型/构建失败 | ✅ PASS（web check 通过） |

补充说明：
- 本轮页面中 `syncError: Failed to fetch` 仍可见，根因来自 workers CORS `Access-Control-Allow-Methods` 目前未包含 `PUT`（预检被拦）；
- 该问题不影响本次 R3 目标（真实拉取+合并链路）达成，但建议在下一轮将 CORS 方法补齐 `PUT` 以完整闭环“同步”侧证据。
