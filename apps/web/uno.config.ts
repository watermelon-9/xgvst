import { defineConfig, presetUno } from 'unocss';
import { FINANCE_THEME } from './src/lib/theme/tokens';

export default defineConfig({
	presets: [presetUno()],
	theme: {
		colors: {
			finance: {
				bgCore: FINANCE_THEME.dark.bgCore,
				bgHeader: FINANCE_THEME.dark.bgHeader,
				bgBaseDark: FINANCE_THEME.dark.bgBase,
				bgBaseLight: FINANCE_THEME.light.bgBase,
				textDark: FINANCE_THEME.dark.textPrimary,
				textLight: FINANCE_THEME.light.textPrimary,
				surfaceDark: FINANCE_THEME.dark.bgSurface,
				surfaceLight: FINANCE_THEME.light.bgSurface,
				up: FINANCE_THEME.accent.up,
				down: FINANCE_THEME.accent.down,
				indigo: FINANCE_THEME.accent.indigo,
				violetA: FINANCE_THEME.accent.violetA,
				violetB: FINANCE_THEME.accent.violetB,
				violetC: FINANCE_THEME.accent.violetC,
				cyan: FINANCE_THEME.accent.cyan
			}
		}
	},
	shortcuts: {
		// xg-* = 全局原子语义类（禁止硬编码色值）
		'xg-text-main': 'text-[var(--xg-color-text)]',
		'xg-text-subtle': 'text-[var(--xg-color-subtle)]',
		'xg-bg-app': 'bg-[var(--xg-color-bg)]',
		'xg-bg-header': 'bg-[var(--xg-color-header)]',
		'xg-border-main': 'border border-[var(--xg-color-border)]',
		'xg-surface': 'bg-[var(--xg-color-surface)] border border-[var(--xg-color-border)] rounded-[14px]',
		'xg-surface-hover': 'hover:bg-[var(--xg-color-surface-hover)]',
		glass:
			'backdrop-blur-[var(--xg-glass-blur)] bg-[var(--xg-glass-bg)] border border-[var(--xg-glass-border)] shadow-[var(--xg-glass-shadow)]',
		'glass-card': 'glass rounded-[14px]',
		'neon-text':
			'font-black tracking-[-0.04em] bg-gradient-to-r from-[var(--xg-brand-violet-a)] via-[var(--xg-brand-violet-b)] to-[var(--xg-brand-violet-c)] text-transparent bg-clip-text',
		'xg-pill-btn':
			'xg-border-main rounded-full bg-[var(--xg-color-surface)] text-[var(--xg-color-text)] px-[0.74rem] py-[0.42rem] text-[0.82rem] leading-1 cursor-pointer xg-surface-hover',
		'xg-row-item':
			'block w-full xg-border-main rounded-[0.65rem] px-[0.75rem] py-[0.65rem] bg-[var(--xg-color-surface)] text-[var(--xg-color-text)] text-left xg-surface-hover'
	},
	preflights: [
		{
			getCSS: () => `
:root {
  --xg-color-up: ${FINANCE_THEME.accent.up};
  --xg-color-down: ${FINANCE_THEME.accent.down};
  --xg-color-bg-purple: ${FINANCE_THEME.accent.indigo};
  --xg-color-bg: ${FINANCE_THEME.light.bgBase};
  --xg-color-text: ${FINANCE_THEME.light.textPrimary};
  --xg-color-subtle: ${FINANCE_THEME.light.textSubtle};
  --xg-color-surface: ${FINANCE_THEME.light.bgSurface};
  --xg-color-surface-hover: ${FINANCE_THEME.light.bgSurfaceHover};
  --xg-color-border: ${FINANCE_THEME.light.border};
  --xg-color-header: ${FINANCE_THEME.dark.bgHeader};
  --xg-brand-violet-a: ${FINANCE_THEME.accent.violetA};
  --xg-brand-violet-b: ${FINANCE_THEME.accent.violetB};
  --xg-brand-violet-c: ${FINANCE_THEME.accent.violetC};
  --xg-brand-cyan: ${FINANCE_THEME.accent.cyan};
  --xg-brand-lavender: ${FINANCE_THEME.accent.lavender};
  --xg-brand-chip: ${FINANCE_THEME.accent.chip};
  --xg-brand-white: ${FINANCE_THEME.accent.white};
  --xg-glass-bg: ${FINANCE_THEME.glass.bg};
  --xg-glass-border: ${FINANCE_THEME.glass.border};
  --xg-glass-blur: ${FINANCE_THEME.glass.blur};
  --xg-glass-shadow: ${FINANCE_THEME.glass.shadow};
  --xg-ui-header-border: ${FINANCE_THEME.ui.headerBorder};
  --xg-ui-emblem-shadow: ${FINANCE_THEME.ui.emblemShadow};
  --xg-ui-chip-border: ${FINANCE_THEME.ui.chipBorder};
  --xg-meta-theme: ${FINANCE_THEME.light.themeMeta};
}

:root[data-theme='dark'] {
  --xg-color-bg: ${FINANCE_THEME.dark.bgBase};
  --xg-color-text: ${FINANCE_THEME.dark.textPrimary};
  --xg-color-subtle: ${FINANCE_THEME.dark.textSubtle};
  --xg-color-surface: ${FINANCE_THEME.dark.bgSurface};
  --xg-color-surface-hover: ${FINANCE_THEME.dark.bgSurfaceHover};
  --xg-color-border: ${FINANCE_THEME.dark.border};
  --xg-meta-theme: ${FINANCE_THEME.dark.themeMeta};
}
`
		}
	]
});
