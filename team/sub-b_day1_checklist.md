# Sub-B Day1 执行清单（可复制）

## 目标
完成 v3 前端脚手架初始化与基础性能约束落地。

## 1. 初始化 Vitesse
```bash
cd /Users/mac/.openclaw/workspace/xgvst
npx degit antfu/vitesse apps/web
cd apps/web
pnpm install
pnpm dev
```

## 2. 建立目录约定
```bash
mkdir -p src/modules/market src/components/charts src/workers src/styles
```

## 3. 建立高频数据规范
- useMarketStore 中 ticker 列表使用 `shallowRef([])`
- 批量更新必须进 `requestAnimationFrame`

## 4. 最小验证
- [ ] `pnpm dev` 无报错
- [ ] 页面可访问
- [ ] 建立 `useMarketStore` 草稿
- [ ] 输出 `shallowRef + rAF` 演示片段

## 5. 回滚点
- 删除 `xgvst/apps/web` 即可回退 Day1
