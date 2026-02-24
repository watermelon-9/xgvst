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
				<path
					fill="#33d5b4"
					d="M8 14h13l13 18-13 18H8l13-18L8 14zm10.8 8.8h4.8L29 32l-5.4 9.2h-4.8L24.2 32l-5.4-9.2z"
				/>
				<path
					fill="#f8fafc"
					d="M49.5 19.2c-4.9-4.9-12.9-4.9-17.9 0l-5.1 5.1 5.9 5.9 5.1-5.1c1.7-1.7 4.4-1.7 6.1 0 1.7 1.7 1.7 4.4 0 6.1l-7.5 7.5c-1.7 1.7-4.4 1.7-6.1 0l-2.1-2.1-5.9 5.9 2.1 2.1c4.9 4.9 12.9 4.9 17.9 0l7.5-7.5c5-5 5-13 0-17.9z"
				/>
				<rect x="35" y="30" width="12" height="5" rx="2.5" fill="#f8fafc" transform="rotate(-45 41 32.5)" />
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
