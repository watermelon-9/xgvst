# xgvst 仓库规范（Sub-A）

## 命名规范
- 仓库（项目目录）统一使用：`xgvst`
- 前端应用包名：`@xgvst/web`
- 后端服务包名（预留）：`xgvst-api`

## 分支策略
- `main`：生产分支（Production）
- `develop`：开发分支（Development）

## 合并前强制检查
1. `corepack pnpm build`
2. 本地预览可访问
3. 不得引入大体积二进制文件（受 `.gitignore` 与 Code Review 双重约束）
