# Sub-C 审计清单（SLA + 预警）

## 审计SLA
- 每 5 分钟一次活跃度扫描
- 300s 无更新：黄警
- 连续 3 次失败重试：红警并升级主 Agent

## 预警等级定义

### 绿（Green）
- tunnel 有活跃连接
- TTFB < 400ms（同区域正常波动）
- 无明显 Long Task（>50ms）

### 黄（Yellow）
- tunnel 边缘漂移导致 TTFB 400~1000ms
- 单模块偶发卡顿
- 子任务汇报超时 300s

### 红（Red）
- tunnel 无活跃连接或连续 530/SSL 错误
- TTFB > 1000ms 持续 3 轮
- 前端 Long Task 高频出现
- 子任务连续失败 >= 3 次

## 发布前门禁
- [ ] 动静分离合规
- [ ] PB 传输链路可用
- [ ] 高频模块使用 shallowRef
- [ ] rAF 更新链路生效
- [ ] 关键接口压测通过

## 日志建议
- `xgvst/logs/audit-YYYYMMDD.md`
- 记录：时间、指标、状态、处理动作、结果
