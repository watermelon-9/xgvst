# UI_GLOBAL_C · R1 品牌一致性与质感验收（首页 + Auth 三页）

## 第一段｜范围与方法
本轮审计覆盖 4 个页面：`/`、`/auth/login`、`/auth/register`、`/auth/forgot-password`。审计维度为：**色彩系统、字体系统、信息层级、组件状态**。代码侧以 `apps/web/src/app.css` 与四个路由页面为依据；回归侧执行了移动端 Lighthouse（含 Performance/Accessibility/Best Practices/SEO）与 Pa11y（WCAG2AA）扫描。原始证据位于：`reports/lighthouse/UI_GLOBAL_C/raw/`。

## 第二段｜品牌一致性审计结果（色彩/字体/层级/组件态）
- **色彩（PASS，存在轻微漂移）**：首页与 Auth 均沿用红紫品牌主轴（`#ff4e5f` ↔ `#9b4dff`）及玻璃化高光语义，整体品牌记忆点一致。差异在于 Auth 三页背景渐变和亮部强度略有不同（register/forgot 更亮），属于可接受的同系扩展，但建议收敛为 token 化渐变预设，降低视觉漂移。
- **字体（PASS）**：全局 `:root` 统一使用 Inter + 中文回退栈，字号层级（标题/正文/辅助）遵循一致的比例节奏，未发现跨页字体族分叉。
- **层级（PARTIAL FAIL）**：登录页为双栏品牌叙事（左品牌右表单），注册/找回为单卡片纯表单，导致 Auth 内部“主叙事层”不一致；首页是重信息密度交易台，Auth 是单任务流程，跨模块语义合理，但 Auth 内部建议统一容器骨架（要么都双栏，要么都单栏 + 品牌侧边条）。
- **组件态（PARTIAL FAIL）**：输入框、按钮、错误态、焦点态总体同源；但登录页存在 `auth-card-login` 专属样式体系，注册/找回走 `auth-card-simple`，组件视觉厚度、阴影和分区方式不一致。建议将 Auth 表单容器收敛为 1 套主组件 + 变体 token（brand-panel on/off）。

## 第三段｜LH 与 A11y 回归结果（PASS/FAIL）
来源：`reports/lighthouse/UI_GLOBAL_C/raw/r1-lh-a11y-summary.json`

- `/`：LH Perf 99 / A11y 100 / BP 100 / SEO 100；Pa11y error=0 → **PASS**
- `/auth/login`：LH Perf 99 / A11y 95 / BP 96 / SEO 100；Pa11y error=4（文本对比度不足）→ **FAIL**
- `/auth/register`：LH Perf 100 / A11y 100 / BP 96 / SEO 100；Pa11y error=0 → **PASS**
- `/auth/forgot-password`：LH Perf 100 / A11y 100 / BP 96 / SEO 100；Pa11y error=0 → **PASS**

回归总判定：
- **Lighthouse 回归：PASS**（四页性能与可访问性分数整体稳定，无性能回退）
- **A11y 回归：FAIL**（登录页出现 4 条 WCAG2AA 对比度错误，需修复后复扫）

## 第四段｜结论与整改建议
当前版本在品牌主色、字体体系、页面质感上已形成统一基调，但 Auth 内部容器层级/组件态存在“登录页 vs 其余两页”的结构分叉；更关键的是登录页可访问性对比度不达标，阻断严格验收。建议优先修复登录页文案与错误态文字对比度（目标 ≥ 4.5:1），并在下一轮把 Auth 容器抽象为统一骨架组件，减少后续样式漂移与维护成本。

---

## DoD Checklist
- [x] 首页 + Auth 三页品牌一致性审计（色彩、字体、层级、组件态）已完成
- [x] Lighthouse 回归已执行并给出 PASS/FAIL
- [x] A11y 回归已执行并给出 PASS/FAIL
- [x] 报告已落盘：`reports/lighthouse/UI_GLOBAL_C/r1-brand-consistency-audit.md`
- [x] 原始证据已落盘：`reports/lighthouse/UI_GLOBAL_C/raw/r1-lh-*.json`、`reports/lighthouse/UI_GLOBAL_C/raw/r1-a11y-*.json`、`reports/lighthouse/UI_GLOBAL_C/raw/r1-lh-a11y-summary.json`

## FINAL
**FINAL: FAIL（阻断项：`/auth/login` 存在 4 条 WCAG2AA 对比度错误；其余页面通过）**