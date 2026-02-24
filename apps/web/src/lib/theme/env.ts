export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeValue = 'light' | 'dark';
export type ThemeEnvValue = 'system' | 'finance-light' | 'finance-dark';

export const THEME_ENV_KEY = 'PUBLIC_THEME';

export function resolveThemeModeFromEnv(raw: string | undefined | null): ThemeMode {
	const normalized = (raw ?? '').trim().toLowerCase();
	if (normalized === 'finance-light' || normalized === 'light') return 'light';
	if (normalized === 'finance-dark' || normalized === 'dark') return 'dark';
	return 'system';
}
