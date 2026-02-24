<script lang="ts">
	import { onMount } from 'svelte';
	import { initPwa } from '$lib/pwa';
	import { FINANCE_THEME } from '$lib/theme/tokens';
	import { resolveThemeModeFromEnv, type ThemeMode, type ThemeValue } from '$lib/theme/env';
	import '../app.css';

	let { children } = $props();

	const THEME_MODE_KEY = 'xgvst-theme-mode';
	const THEME_CSS_LINK_ID = 'xg-theme-style';
	const THEME_VERSION = FINANCE_THEME.name;
	const ENV_THEME_MODE = resolveThemeModeFromEnv(import.meta.env.PUBLIC_THEME);

	let themeMode = $state<ThemeMode>(ENV_THEME_MODE);
	let resolvedTheme = $state<ThemeValue>('dark');
	let themeMeta: HTMLMetaElement | null = null;
	let themeCssLink: HTMLLinkElement | null = null;
	let mediaQuery: MediaQueryList | null = null;

	const getSystemTheme = (): ThemeValue =>
		typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light';

	const getThemeCssHref = (value: ThemeValue) => `/${value === 'dark' ? 'theme-dark' : 'theme-light'}.css?v=${THEME_VERSION}`;

	const ensureThemeCssLink = () => {
		themeCssLink = (document.getElementById(THEME_CSS_LINK_ID) as HTMLLinkElement | null) ?? null;
		if (themeCssLink) return;

		themeCssLink = document.createElement('link');
		themeCssLink.id = THEME_CSS_LINK_ID;
		themeCssLink.rel = 'stylesheet';
		themeCssLink.href = getThemeCssHref(resolvedTheme);
		document.head.appendChild(themeCssLink);
	};

	const applyResolvedTheme = (value: ThemeValue) => {
		resolvedTheme = value;
		document.documentElement.dataset.theme = value;
		themeMeta?.setAttribute('content', value === 'dark' ? FINANCE_THEME.dark.themeMeta : FINANCE_THEME.light.themeMeta);
		ensureThemeCssLink();
		if (themeCssLink) themeCssLink.href = getThemeCssHref(value);
	};

	const syncTheme = (nextMode: ThemeMode) => {
		themeMode = nextMode;
		const targetTheme = nextMode === 'system' ? getSystemTheme() : nextMode;
		applyResolvedTheme(targetTheme);
	};

	const setThemeMode = (nextMode: ThemeMode) => {
		syncTheme(nextMode);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(THEME_MODE_KEY, nextMode);
		}
	};

	const toggleTheme = () => {
		const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
		setThemeMode(nextTheme);
	};

	onMount(() => {
		themeMeta = document.querySelector('meta[name="theme-color"]');
		const forcedMode = new URLSearchParams(window.location.search).get('theme');
		const savedMode = window.localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
		const initialMode =
			forcedMode === 'light' || forcedMode === 'dark'
				? forcedMode
				: savedMode === 'light' || savedMode === 'dark' || savedMode === 'system'
					? savedMode
					: ENV_THEME_MODE;
		syncTheme(initialMode);
		initPwa();

		mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleSystemThemeChange = () => {
			if (themeMode !== 'system') return;
			syncTheme('system');
		};

		mediaQuery.addEventListener('change', handleSystemThemeChange);
		return () => mediaQuery?.removeEventListener('change', handleSystemThemeChange);
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta
		name="description"
		content="XGVST — Master Volatility. Master Markets. 提供市场总览、行情追踪与个股分析。"
	/>
	<meta name="theme-color" content={FINANCE_THEME.dark.themeMeta} />
	<link id={THEME_CSS_LINK_ID} rel="stylesheet" href={`/theme-dark.css?v=${THEME_VERSION}`} />
	<link rel="dns-prefetch" href="//xgvst-workers.viehh642.workers.dev" />
	<link rel="preconnect" href="https://xgvst-workers.viehh642.workers.dev" crossorigin="anonymous" />
	<title>XGVST — Master Volatility. Master Markets.</title>
</svelte:head>

<header class="app-header glass">
	<a class="brand-link" href="/" aria-label="返回首页">
		<div class="brand-emblem" aria-hidden="true">XG</div>
		<div class="brand-copy">
			<div class="brand-main neon-text">XGVST</div>
			<div class="brand-sub">Master Volatility. Master Markets.</div>
		</div>
	</a>

	<div class="header-actions">
		<div class="user-chip">Hoeltu ▼</div>
		<button type="button" class="theme-toggle" onclick={toggleTheme} aria-label="切换亮暗主题">
			{resolvedTheme === 'light' ? '🌙 暗色' : '☀️ 亮色'}
		</button>
		<button
			type="button"
			class={`theme-toggle ${themeMode === 'system' ? 'is-active' : ''}`}
			onclick={() => setThemeMode('system')}
			aria-label="跟随系统主题"
		>
			系统
		</button>
	</div>
</header>

{@render children()}
