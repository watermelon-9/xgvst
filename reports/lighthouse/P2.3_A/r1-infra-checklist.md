# P2.3_A / R1 Infra Checklist（Sub-A）

更新时间：2026-02-25（Asia/Shanghai）  
仓库：`/Users/mac/.openclaw/workspace/xgvst`

---

## 0) 本轮目标对照（Sub-A）

1. workers 侧 proto 目录与编解码管道梳理：`quote.proto`、`codec` 单例、二进制主路径确认。  
2. wrangler 绑定核对与补全：D1/KV；给出迁移脚本/表结构建议并落地最小可执行版本。  
3. KV 快照写入路径核验（`key=quote:${symbol}`、TTL 策略）与 D1 自选持久化路径设计/实现草案。  
4. 输出 infra 证据与风险。  
5. 代码与报告提交。

---

## 1) ✅详细步骤（已执行）

### 1.1 Protobuf 目录与编解码管道梳理

- 更新 `packages/workers/src/proto/quote.proto`：
  - 新增 `Ticker` / `QuoteSnapshot` / `SelfSelectItem` / `SelfSelectList`。
  - 保留 `QuotePayload`（向后兼容别名），统一 proto3 字段编号策略。
- 重写 `packages/workers/src/proto/quote.ts`：
  - 补齐 `encode/decode`（Ticker、QuoteSnapshot、SelfSelectList）。
- 新增 `packages/workers/src/proto/codec.ts`：
  - `ProtobufCodec` 单例（`protobufCodec`）统一入口：
    - `encodeQuoteTick/decodeTicker`
    - `encodeSnapshot/decodeSnapshot`
    - `encodeSelfSelectList/decodeSelfSelectList`
- 接入路径：
  - `packages/workers/src/durable/QuoteDO.ts`：广播编码、KV 快照读写走 `protobufCodec`。
  - `packages/workers/src/index.ts`：mock 编码 & pool 广播编码走 `protobufCodec`。

### 1.2 Wrangler 绑定核对与补全（D1/KV）

核对文件：`packages/workers/wrangler.toml`

- 已存在并保留：
  - `[[kv_namespaces]]` 绑定 `QUOTE_KV`
  - `[[d1_databases]]` 绑定 `QUOTE_DB`
  - `[[durable_objects.bindings]]` 绑定 `QUOTE_DO`
- 新增变量：
  - `[vars] QUOTE_SNAPSHOT_TTL_SECONDS = "300"`

### 1.3 D1 迁移脚本与最小可执行表结构

- 新增迁移 SQL：
  - `packages/workers/migrations/0001_p23_proto_d1.sql`
- 覆盖表：
  - `users`
  - `self_selects`（主键 `user_id + symbol`，并加索引）
  - `quote_history`（用于自选变更历史查询）
- 新增执行脚本：
  - `scripts/p23-d1-migrate.sh`
  - 提供本地执行 + 远端备份/迁移建议命令（`wrangler d1 export/execute`）。

### 1.4 KV 快照路径核验 + TTL 策略落地

在 `QuoteDO` 中完成：

- key 从历史 `quote:snapshot:${symbol}` 调整为 `quote:${symbol}`。
- value 从 JSON 调整为 Protobuf 二进制（`encodeSnapshot`）。
- `put(..., { expirationTtl })` 启用 TTL，默认 300 秒，可通过环境变量覆盖。
- 读取走 `arrayBuffer` + `decodeSnapshot`，并恢复为 `QuoteTickSnapshot`。

### 1.5 D1 自选持久化路径（实现草案 + 可运行 API）

在 `packages/workers/src/index.ts` 新增 API：

- `GET /api/self-selects`：按用户读当前自选列表
- `PUT /api/self-selects`：全量覆盖自选（replace）
- `POST /api/self-selects`：新增单 symbol
- `DELETE /api/self-selects/:symbol`：删除单 symbol
- `GET /api/self-selects/history`：按用户查询历史（`quote_history`）

用户 ID 解析策略：`userId query -> cf-access-authenticated-user-email -> x-user-id`。

---

## 2) ✅注意事项（逐条落实情况）

1. **行情主链路强制二进制**：已将核心编码入口收敛到 `protobufCodec`（仍存在 debug/兼容 JSON 分支，见风险）。
2. **D1/KV 均在 Workers 层读写**：本轮新增 KV/D1 逻辑全部位于 Workers / DO。
3. **KV value 使用 Protobuf**：已改为二进制 snapshot，不再写 JSON snapshot。
4. **D1 索引预留（user_id+symbol）**：迁移 SQL 已显式创建主键与索引。
5. **DO 广播前编码**：legacy 路径与 bundle 路径均在 DO 编码后发送。
6. **proto3 & 字段编号规则**：`quote.proto` 已统一为 proto3 并固定字段编号。
7. **错误处理与降级**：当前保留 debug fallback（JSON/QT1），生产需进一步收口。
8. **KV 与订阅联动、D1 不阻塞实时链路**：快照写入采用异步 slow task；D1 自选 API 独立于行情 flush。

---

## 3) ✅工作安排映射（Sub-A）

### 3.1 D1 表创建脚本 + KV 绑定声明

- D1 脚本：`packages/workers/migrations/0001_p23_proto_d1.sql`（已落地）
- KV/D1 绑定：`packages/workers/wrangler.toml`（已核对保留）
- KV TTL 变量：`QUOTE_SNAPSHOT_TTL_SECONDS`（已新增）

### 3.2 迁移与备份策略（最小版本）

- 已提供脚本 `scripts/p23-d1-migrate.sh`。
- 策略建议：
  1) 远端执行前先 `wrangler d1 export ... --remote` 做 SQL 备份；
  2) 再执行 migration；
  3) 执行后用自选 CRUD API 做冒烟验证。

---

## 4) ✅DoD 映射（P2.3 1~6）

> 说明：仅根据 Sub-A 当前改动可验证项给出 PASS/FAIL；跨前端与性能专项项需 Sub-B/Sub-C 证据。

1. **Protobuf 编解码管道全链路打通，前端成功接收并解析二进制行情数据**  
   - 现状：Workers/DO 侧编码链路已打通；前端接收解析证据未在本轮提交。  
   - **判定：FAIL（缺前端联调证据）**

2. **KV 快照写入/读取成功（单次操作 < 5ms）**  
   - 现状：路径与 TTL 已实现（`quote:${symbol}` + protobuf + 300s）；<5ms 尚无压测证据。  
   - **判定：FAIL（缺性能实测）**

3. **D1 自选股增删改查正常，跨设备秒级同步**  
   - 现状：CRUD + history API 已落地；跨设备秒级同步需联调验证。  
   - **判定：FAIL（缺跨端验证）**

4. **生产环境无任何 JSON 行情残留（日志验证）**  
   - 现状：仍保留 debug/兼容 JSON fallback 分支。  
   - **判定：FAIL**

5. **性能报告已提交：带宽下降≥70%、D1/KV平均读写<10ms、Lighthouse 无下降**  
   - 现状：本轮未产出该性能报告（属于 Sub-C 主责）。  
   - **判定：FAIL**

6. **5000 Tick/s 场景存储稳定，无内存或延迟抖动**  
   - 现状：无 5000 Tick/s 压测证据。  
   - **判定：FAIL**

---

## 5) Infra 证据清单

### 5.1 代码证据

- `packages/workers/src/proto/quote.proto`
- `packages/workers/src/proto/quote.ts`
- `packages/workers/src/proto/codec.ts`
- `packages/workers/src/durable/QuoteDO.ts`
- `packages/workers/src/index.ts`
- `packages/workers/wrangler.toml`
- `packages/workers/migrations/0001_p23_proto_d1.sql`
- `scripts/p23-d1-migrate.sh`
- `.env.example`

### 5.2 编译检查证据

执行：`corepack pnpm --filter workers check`  
结果：`wrangler types && tsc --noEmit` 通过（无 TypeScript 报错）。

---

## 6) 风险与下一步（给主 Agent / Sub-C）

1. **JSON fallback 未彻底移除**：DoD4 当前 FAIL；建议区分 `dev` 与 `prod` 编译开关，生产硬禁 JSON。
2. **KV/D1 性能指标未实测**：需 Sub-C 跑 P2.3 专项压测并形成报告（DoD2/5/6）。
3. **前端 decode 联调缺失**：DoD1 依赖 Sub-B 前端解码接入和端到端抓包证据。
4. **D1 schema 与 2.4 认证迁移衔接**：后续 Access/JWT 引入后需确认 `user_id` 标准化策略，避免二次迁移。

---

## 7) 本轮结论

- 本轮已完成 P2.3 的 **Infra 最小可执行骨架**（proto/codec、KV 快照、D1 schema + CRUD API、迁移脚本）。
- 但按 P2.3 DoD（1~6）逐项核验，当前仍存在多项 FAIL，**不得宣告阶段完成**。
