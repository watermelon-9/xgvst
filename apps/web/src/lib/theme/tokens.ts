export const FINANCE_THEME = {
	name: 'xgvst-finance-v1',
	baseline: {
		uiVersion: 'xg-v2',
		reference: '西瓜说股 v2 界面设计',
		requirement: 'P3.1 必须对齐 v2 体验基线'
	},
	light: {
		bgBase: '#f4f6fb',
		bgSurface: 'rgba(255,255,255,0.9)',
		bgSurfaceHover: 'rgba(255,255,255,1)',
		textPrimary: '#111827',
		textSubtle: 'rgba(17,24,39,0.72)',
		border: 'rgba(79,70,229,0.16)',
		themeMeta: '#f4f6fb'
	},
	dark: {
		bgCore: '#1a1633',
		bgHeader: '#0f0b1f',
		bgBase: '#111827',
		bgSurface: 'rgba(255,255,255,0.1)',
		bgSurfaceHover: 'rgba(255,255,255,0.16)',
		textPrimary: '#f9fafb',
		textSubtle: 'rgba(249,250,251,0.72)',
		border: 'rgba(255,255,255,0.12)',
		themeMeta: '#111827'
	},
	accent: {
		up: '#ef4444',
		down: '#22c55e',
		violetA: '#a855f7',
		violetB: '#c084fc',
		violetC: '#e9d5ff',
		cyan: '#22d3ee',
		indigo: '#4f46e5',
		lavender: '#c4b5fd',
		white: '#ffffff',
		chip: '#f3e8ff'
	},
	glass: {
		bg: 'rgba(255,255,255,0.12)',
		border: 'rgba(255,255,255,0.2)',
		blur: '20px',
		shadow: '0 10px 40px rgba(0,0,0,0.2)'
	},
	ui: {
		headerBorder: 'rgba(147,51,234,0.2)',
		emblemShadow: '0 0 20px rgba(168,85,247,0.35)',
		chipBorder: 'rgba(255,255,255,0.14)'
	}
} as const;

export type ThemeMode = 'light' | 'dark';
