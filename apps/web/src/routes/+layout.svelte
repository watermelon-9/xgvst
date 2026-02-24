<script lang="ts">
	import { onMount } from 'svelte';
	import { initPwa } from '$lib/pwa';
	import '../app.css';

	let { children } = $props();
	let theme = $state<'light' | 'dark'>('dark');
	let themeMeta: HTMLMetaElement | null = null;

	const resolveInitialTheme = (): 'light' | 'dark' => {
		if (typeof document === 'undefined') return 'dark';
		return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
	};

	const applyTheme = (value: 'light' | 'dark') => {
		theme = value;
		document.documentElement.dataset.theme = value;
		themeMeta?.setAttribute('content', value === 'dark' ? '#111827' : '#f4f6fb');
	};

	onMount(() => {
		themeMeta = document.querySelector('meta[name="theme-color"]');
		theme = resolveInitialTheme();
		initPwa();
	});

	const toggleTheme = () => {
		const next = theme === 'light' ? 'dark' : 'light';
		applyTheme(next);
		localStorage.setItem('xgvst-theme', next);
	};
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta
		name="description"
		content="XGVST — Master Volatility. Master Markets. 提供市场总览、行情追踪与个股分析。"
	/>
	<meta name="theme-color" content="#111827" />
	<title>XGVST — Master Volatility. Master Markets.</title>
</svelte:head>

<header class="app-header">
	<a class="brand-link" href="/" aria-label="返回首页">
		<div class="brand-emblem" aria-hidden="true">
			<svg class="xg-mark" viewBox="0 0 64 64" role="img" aria-label="XG logo">
				<path fill="#37d7bf" d="M11 16h12l10 16-10 16H11l10-16z" />
				<path fill="#21bda7" d="M20 24h5l5 8-5 8h-5l5-8z" />
				<path
					fill="#f8fafc"
					d="M40 18c7.7 0 14 6.3 14 14s-6.3 14-14 14c-4.1 0-7.8-1.8-10.4-4.6l6-4.3A6 6 0 1 0 40 26h-3.3l4.9-8H40z"
				/>
				<rect x="34.6" y="30.4" width="12.8" height="5.4" rx="2.7" fill="#f8fafc" transform="rotate(-39 41 33.1)" />
			</svg>
		</div>
		<div class="brand-copy">
			<div class="brand-main">XGVST</div>
			<div class="brand-sub">Master Volatility. Master Markets.</div>
		</div>
	</a>

	<div class="header-actions">
		<div class="user-chip">Hoeltu ▼</div>
		<button type="button" class="theme-toggle" onclick={toggleTheme} aria-label="切换明暗主题">
			<span>{theme === 'light' ? '🌙 暗黑' : '☀️ 亮色'}</span>
		</button>
	</div>
</header>

{@render children()}
